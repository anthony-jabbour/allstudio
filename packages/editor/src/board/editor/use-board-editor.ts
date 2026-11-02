import {
  BOARD_LIMITS,
  type BoardDocumentV1,
  type BoardImageNode,
  type BoardNode,
  type BoardPage,
  createBoardId,
  parseBoardDocument,
} from "@allstudio/project";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  fitBounds,
  screenToWorld,
  type Viewport,
  zoomAt,
} from "../geometry.ts";
import { historyReducer, initialHistory } from "../history.ts";
import { inferLayout, normalizeLayouts, sortForLayout } from "../layout.ts";
import {
  type Alignment,
  absoluteBounds,
  alignNodes,
  type CopiedStyle,
  copyNodes,
  copyStyle,
  distributeNodes,
  duplicateNodes,
  frameAt,
  frameSelection,
  insertNodes,
  locate,
  pasteNodes,
  pasteStyle,
  type Reorder,
  removeNodes,
  reorderNodes,
  selectionBounds,
  topmostIds,
  unframe,
  updateNodes,
  updatePage,
} from "../model.ts";
import { pageBounds } from "../render.tsx";

export type Tool =
  | "select"
  | "hand"
  | "frame"
  | "rect"
  | "ellipse"
  | "text"
  | "image";

export type SaveState = "saved" | "saving" | "error";

const CLIPBOARD_PREFIX = "allstudio-board-nodes:";
const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export interface BoardEditorOptions {
  document: BoardDocumentV1;
  onSave: (doc: BoardDocumentV1) => void;
  appearance: "light" | "dark";
}

/** Validate untrusted nodes (clipboard) by wrapping them in a document. */
export function validateNodes(nodes: unknown): BoardNode[] {
  const doc = parseBoardDocument({
    schemaVersion: 1,
    id: "clipboard",
    name: "Clipboard",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    pages: [{ id: "clip", name: "Clip", background: "transparent", nodes }],
  });
  return doc.pages[0]?.nodes ?? [];
}

function luminance(color: string | null | undefined): number | null {
  const hex = color?.match(/^#([0-9a-f]{3}|[0-9a-f]{6})/i)?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  const [r, g, b] = [0, 2, 4].map(
    (i) => Number.parseInt(full.slice(i, i + 2), 16) / 255,
  );
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

export function useBoardEditor({
  document,
  onSave,
  appearance,
}: BoardEditorOptions) {
  const [history, dispatch] = useReducer(
    historyReducer,
    document,
    initialHistory,
  );
  const doc = history.doc;
  const [pageId, setPageId] = useState(() => document.pages[0]?.id ?? "");
  const page: BoardPage = (doc.pages.find((p) => p.id === pageId) ??
    doc.pages[0]) as BoardPage;
  const [selection, setSelectionState] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [notice, setNotice] = useState<{
    id: number;
    text: string;
    tone: "info" | "error";
  } | null>(null);
  const canvasSize = useRef({ width: 1200, height: 800 });
  const clipboard = useRef<BoardNode[]>([]);
  const styleClipboard = useRef<CopiedStyle | null>(null);
  const state = useRef({ doc, page, selection, viewport });
  state.current = { doc, page, selection, viewport };

  const notify = useCallback(
    (text: string, tone: "info" | "error" = "info") => {
      setNotice({ id: Date.now(), text, tone });
    },
    [],
  );

  // Keep the selection valid when nodes disappear (undo, delete, page switch).
  const liveSelection = useMemo(
    () => selection.filter((id) => locate(page, id)),
    [selection, page],
  );

  const setSelection = useCallback((ids: string[]) => {
    setSelectionState(ids);
    setEditingTextId(null);
  }, []);

  // ---- persistence -------------------------------------------------------
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const lastSaved = useRef(document);
  useEffect(() => {
    if (history.gestureBase || doc === lastSaved.current) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      try {
        saveRef.current(doc);
        lastSaved.current = doc;
        setSaveState("saved");
      } catch (error) {
        setSaveState("error");
        notify(
          error instanceof Error ? error.message : "Saving failed.",
          "error",
        );
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [doc, history.gestureBase, notify]);
  // Flush on unmount so leaving the editor never drops the last change.
  useEffect(
    () => () => {
      const current = state.current.doc;
      if (current !== lastSaved.current) {
        try {
          saveRef.current(current);
        } catch {
          // Reported on the next open as unsaved; nothing else to do here.
        }
      }
    },
    [],
  );

  // ---- document updates --------------------------------------------------
  const applyDoc = useCallback(
    (next: BoardDocumentV1, options: { transient?: boolean } = {}) => {
      dispatch({ type: "set", doc: next, transient: options.transient });
    },
    [],
  );

  const apply = useCallback(
    (
      fn: (page: BoardPage) => BoardPage,
      options: { transient?: boolean; select?: string[] } = {},
    ) => {
      const current = state.current;
      // Stacks are re-laid out after every edit, so stored positions stay exact.
      const next = updatePage(current.doc, current.page.id, (p) =>
        normalizeLayouts(fn(p)),
      );
      if (next !== current.doc) applyDoc(next, options);
      if (options.select) setSelection(options.select);
    },
    [applyDoc, setSelection],
  );

  const patchSelection = useCallback(
    (
      patch:
        | Record<string, unknown>
        | ((node: BoardNode) => Record<string, unknown>),
      transient = false,
    ) => {
      apply((p) => updateNodes(p, state.current.selection, patch), {
        transient,
      });
    },
    [apply],
  );

  const commitGesture = useCallback(
    () => dispatch({ type: "commitGesture" }),
    [],
  );
  const cancelGesture = useCallback(
    () => dispatch({ type: "cancelGesture" }),
    [],
  );
  const undo = useCallback(() => {
    setEditingTextId(null);
    dispatch({ type: "undo" });
  }, []);
  const redo = useCallback(() => {
    setEditingTextId(null);
    dispatch({ type: "redo" });
  }, []);

  // ---- viewport ----------------------------------------------------------
  const fitAll = useCallback(() => {
    const bounds = pageBounds(state.current.page);
    setViewport(
      bounds
        ? fitBounds(bounds, canvasSize.current)
        : {
            zoom: 1,
            x: canvasSize.current.width / 2,
            y: canvasSize.current.height / 2,
          },
    );
  }, []);
  const fitSelection = useCallback(() => {
    const bounds = selectionBounds(state.current.page, state.current.selection);
    if (bounds) setViewport(fitBounds(bounds, canvasSize.current, 80, 4));
    else fitAll();
  }, [fitAll]);
  const zoomBy = useCallback((factor: number) => {
    const center = {
      x: canvasSize.current.width / 2,
      y: canvasSize.current.height / 2,
    };
    setViewport((v) => zoomAt(v, v.zoom * factor, center));
  }, []);
  const zoomTo = useCallback((zoom: number) => {
    const center = {
      x: canvasSize.current.width / 2,
      y: canvasSize.current.height / 2,
    };
    setViewport((v) => zoomAt(v, zoom, center));
  }, []);
  const viewCenter = useCallback(
    () =>
      screenToWorld(state.current.viewport, {
        x: canvasSize.current.width / 2,
        y: canvasSize.current.height / 2,
      }),
    [],
  );

  const switchPage = useCallback(
    (id: string) => {
      setPageId(id);
      setSelection([]);
      setHoverId(null);
      // Fit after the new page renders.
      window.requestAnimationFrame(() => fitAll());
    },
    [fitAll, setSelection],
  );

  // ---- node commands -----------------------------------------------------
  const defaultTextColor = useCallback(
    (parentId: string | null) => {
      const parent = parentId
        ? locate(state.current.page, parentId)?.node
        : null;
      const lum = luminance(
        parent?.fill ?? (parentId ? null : state.current.page.background),
      );
      if (lum === null)
        return parentId
          ? "#111111"
          : appearance === "dark"
            ? "#f2f2f2"
            : "#111111";
      return lum > 0.5 ? "#111111" : "#f5f5f5";
    },
    [appearance],
  );

  /** Insert a node (absolute world coords) inside the frame under it. */
  const insertAt = useCallback(
    (
      node: BoardNode,
      options: { parentId?: string | null; edit?: boolean } = {},
    ) => {
      const p = state.current.page;
      const parent =
        options.parentId !== undefined
          ? options.parentId
            ? locate(p, options.parentId)?.node
            : null
          : frameAt(p, { x: node.x + 1, y: node.y + 1 });
      const parentId = parent?.type === "frame" ? parent.id : null;
      const origin = parentId ? absoluteBounds(p, parentId) : null;
      const placed = {
        ...node,
        x: Math.round(node.x - (origin?.x ?? 0)),
        y: Math.round(node.y - (origin?.y ?? 0)),
      } as BoardNode;
      apply((page) => insertNodes(page, [placed], parentId), {
        select: [placed.id],
      });
      if (options.edit) setEditingTextId(placed.id);
      return placed.id;
    },
    [apply],
  );

  const deleteSelection = useCallback(() => {
    const ids = state.current.selection;
    if (ids.length) apply((p) => removeNodes(p, ids), { select: [] });
  }, [apply]);

  const duplicateSelection = useCallback(() => {
    const result = duplicateNodes(state.current.page, state.current.selection);
    if (result.ids.length) apply(() => result.page, { select: result.ids });
  }, [apply]);

  const copySelection = useCallback(() => {
    const nodes = copyNodes(state.current.page, state.current.selection);
    if (nodes.length) clipboard.current = nodes;
    return nodes;
  }, []);

  const pasteClipboard = useCallback(
    (nodes = clipboard.current) => {
      if (!nodes.length) return;
      const p = state.current.page;
      const [first] = state.current.selection;
      const target = first ? locate(p, first)?.node : null;
      const parentId =
        target?.type === "frame"
          ? target.id
          : first
            ? (locate(p, first)?.parent?.id ?? null)
            : null;
      const result = pasteNodes(p, nodes, parentId);
      apply(() => result.page, { select: result.ids });
    },
    [apply],
  );

  const clipboardText = (nodes: BoardNode[]) =>
    CLIPBOARD_PREFIX + JSON.stringify(nodes);
  const parseClipboardText = (text: string): BoardNode[] | null => {
    if (!text.startsWith(CLIPBOARD_PREFIX)) return null;
    try {
      return validateNodes(JSON.parse(text.slice(CLIPBOARD_PREFIX.length)));
    } catch {
      return null;
    }
  };

  const frameSelected = useCallback(() => {
    const result = frameSelection(state.current.page, state.current.selection);
    if (result) apply(() => result.page, { select: [result.id] });
    else
      notify(
        "Only layers that share a parent can be framed together.",
        "error",
      );
  }, [apply, notify]);

  const unframeSelected = useCallback(() => {
    const [id] = state.current.selection;
    const result = id ? unframe(state.current.page, id) : null;
    if (result) apply(() => result.page, { select: result.ids });
  }, [apply]);

  const reorder = useCallback(
    (direction: Reorder) =>
      apply((p) =>
        reorderNodes(p, topmostIds(p, state.current.selection), direction),
      ),
    [apply],
  );
  const align = useCallback(
    (alignment: Alignment) =>
      apply((p) => alignNodes(p, state.current.selection, alignment)),
    [apply],
  );
  const toggle = useCallback(
    (key: "hidden" | "locked", ids = state.current.selection) => {
      const nodes = ids
        .map((id) => locate(state.current.page, id)?.node)
        .filter(Boolean);
      const value = !nodes.every((node) => node?.[key]);
      apply((p) => updateNodes(p, ids, { [key]: value }), {
        select: key === "hidden" && value ? [] : undefined,
      });
    },
    [apply],
  );
  const distribute = useCallback(
    (axis: "horizontal" | "vertical") =>
      apply((p) => distributeNodes(p, state.current.selection, axis)),
    [apply],
  );

  /** Turn a frame (or a set of siblings, framed first) into a stack. */
  const addAutoLayout = useCallback(() => {
    const p = state.current.page;
    const ids = state.current.selection;
    if (!ids.length) return;
    const only = ids.length === 1 ? locate(p, ids[0] as string)?.node : null;
    let targetPage = p;
    let frameId: string;
    if (only?.type === "frame") {
      frameId = only.id;
    } else {
      const framed = frameSelection(p, ids);
      if (!framed) {
        notify(
          "Only layers that share a parent can be stacked together.",
          "error",
        );
        return;
      }
      targetPage = framed.page;
      frameId = framed.id;
    }
    apply(
      () =>
        updateNodes(targetPage, [frameId], (node) => {
          if (node.type !== "frame") return {};
          const layout = node.layout ?? inferLayout(node);
          return { layout, children: sortForLayout(node, layout).children };
        }),
      { select: [frameId] },
    );
  }, [apply, notify]);

  const removeAutoLayout = useCallback(() => {
    apply((p) =>
      updateNodes(p, state.current.selection, (node) =>
        node.type === "frame" && node.layout ? { layout: null } : {},
      ),
    );
  }, [apply]);

  const copyStyleOfSelection = useCallback(() => {
    const [id] = state.current.selection;
    const node = id ? locate(state.current.page, id)?.node : null;
    if (!node) return;
    styleClipboard.current = copyStyle(node);
    notify("Style copied.");
  }, [notify]);

  const pasteStyleToSelection = useCallback(() => {
    const style = styleClipboard.current;
    if (!style) {
      notify("Copy a style first (⌥⌘C).", "error");
      return;
    }
    apply((p) => pasteStyle(p, state.current.selection, style));
  }, [apply, notify]);

  const nudge = useCallback(
    (dx: number, dy: number) =>
      apply((p) =>
        updateNodes(p, topmostIds(p, state.current.selection), (node) =>
          node.locked ? {} : { x: node.x + dx, y: node.y + dy },
        ),
      ),
    [apply],
  );

  const addImageFile = useCallback(
    async (file: File, at?: { x: number; y: number }) => {
      if (!IMAGE_TYPES.has(file.type)) {
        notify(
          `${file.name}: only PNG, JPEG, GIF and WebP images are supported.`,
          "error",
        );
        return;
      }
      if (file.size > BOARD_LIMITS.maxImageBytes) {
        notify(`${file.name} is larger than 4 MB.`, "error");
        return;
      }
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const size = await new Promise<{ width: number; height: number }>(
        (resolve) => {
          const img = new Image();
          img.onload = () =>
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = () => resolve({ width: 400, height: 300 });
          img.src = src;
        },
      );
      const scale = Math.min(1, 640 / Math.max(size.width, size.height, 1));
      const width = Math.max(1, Math.round(size.width * scale));
      const height = Math.max(1, Math.round(size.height * scale));
      const center = at ?? viewCenter();
      const node: BoardImageNode = {
        id: createBoardId(),
        type: "image",
        name: file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 60) || "Image",
        x: center.x - width / 2,
        y: center.y - height / 2,
        width,
        height,
        src,
        fit: "cover",
      };
      try {
        validateNodes([node]);
      } catch {
        notify(`${file.name} could not be read as an image.`, "error");
        return;
      }
      insertAt(node);
      setTool("select");
    },
    [insertAt, notify, viewCenter],
  );

  const replaceImage = useCallback(
    async (file: File) => {
      const [id] = state.current.selection;
      if (
        !id ||
        !IMAGE_TYPES.has(file.type) ||
        file.size > BOARD_LIMITS.maxImageBytes
      ) {
        notify("Choose a PNG, JPEG, GIF or WebP image up to 4 MB.", "error");
        return;
      }
      const src = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      apply((p) => updateNodes(p, [id], { src }));
    },
    [apply, notify],
  );

  return {
    doc,
    page,
    pageId: page.id,
    selection: liveSelection,
    tool,
    viewport,
    editingTextId,
    hoverId,
    saveState,
    notice,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    canvasSize,
    setTool,
    setSelection,
    setViewport,
    setEditingTextId,
    setHoverId,
    applyDoc,
    apply,
    patchSelection,
    commitGesture,
    cancelGesture,
    undo,
    redo,
    fitAll,
    fitSelection,
    zoomBy,
    zoomTo,
    viewCenter,
    switchPage,
    insertAt,
    defaultTextColor,
    deleteSelection,
    duplicateSelection,
    copySelection,
    pasteClipboard,
    clipboardText,
    parseClipboardText,
    frameSelected,
    unframeSelected,
    reorder,
    align,
    distribute,
    addAutoLayout,
    removeAutoLayout,
    copyStyleOfSelection,
    pasteStyleToSelection,
    hasCopiedStyle: () => styleClipboard.current !== null,
    hasClipboard: () => clipboard.current.length > 0,
    toggle,
    nudge,
    addImageFile,
    replaceImage,
    notify,
  };
}

export type BoardEditorState = ReturnType<typeof useBoardEditor>;
