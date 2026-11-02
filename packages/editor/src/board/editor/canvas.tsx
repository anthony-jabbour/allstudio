import type { BoardNode, BoardPage, BoardTextNode } from "@allstudio/project";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  type Handle,
  resizeBounds,
  SNAP_THRESHOLD_PX,
  type SnapLine,
  screenToWorld,
  snapBounds,
  wheelViewport,
} from "../geometry.ts";
import {
  absoluteBounds,
  frameAt,
  locate,
  nodesInRect,
  removeNodes,
  reparent,
  selectionBounds,
  topmostIds,
  updateNodes,
  walk,
} from "../model.ts";
import { BoardNodeView, type Bounds } from "../render.tsx";
import { DEFAULT_FONT, frameNode, shapeNode, textNode } from "../templates.ts";
import type { BoardEditorState } from "./use-board-editor.ts";

type Point = { x: number; y: number };

type Gesture =
  | { kind: "pan"; last: Point }
  | {
      kind: "move";
      start: Point;
      startPage: BoardPage;
      ids: string[];
      startBounds: Bounds;
      targets: Bounds[];
      moved: boolean;
      clickedId: string;
      additive: boolean;
    }
  | {
      kind: "resize";
      start: Point;
      startPage: BoardPage;
      id: string;
      handle: Handle;
      startAbs: Bounds;
      startNode: BoardNode;
    }
  | { kind: "marquee"; start: Point; base: string[] }
  | { kind: "draw"; start: Point; tool: "frame" | "rect" | "ellipse" | "text" };

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const DRAG_THRESHOLD = 3;

function normalize(a: Point, b: Point, square = false): Bounds {
  let width = Math.abs(b.x - a.x);
  let height = Math.abs(b.y - a.y);
  if (square) width = height = Math.max(width, height);
  return {
    x: b.x < a.x ? a.x - width : a.x,
    y: b.y < a.y ? a.y - height : a.y,
    width,
    height,
  };
}

/** Nearest selectable node id for a DOM target (skips locked layers). */
function hitNode(page: BoardPage, target: EventTarget | null): string | null {
  let element = (target as HTMLElement | null)?.closest?.(
    "[data-node-id]",
  ) as HTMLElement | null;
  while (element) {
    const id = element.dataset.nodeId;
    const node = id ? locate(page, id)?.node : null;
    if (node && !node.locked) return node.id;
    element = element.parentElement?.closest("[data-node-id]") ?? null;
  }
  return null;
}

function snapTargets(page: BoardPage, ids: string[]): Bounds[] {
  const moving = new Set(ids);
  const targets: Bounds[] = [];
  const parents = new Set(
    ids.map((id) => locate(page, id)?.parent?.id ?? null),
  );
  walk(page.nodes, (node, parent) => {
    if (moving.has(node.id) || node.hidden) return;
    const parentId = parent?.id ?? null;
    // Snap to siblings, to the parent frame and to top-level layers.
    if (parents.has(parentId) || parentId === null || parents.has(node.id)) {
      const b = absoluteBounds(page, node.id);
      if (b) targets.push(b);
    }
  });
  return targets;
}

function TextEditor({
  node,
  onCommit,
}: {
  node: BoardTextNode;
  onCommit: (text: string, height: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.textContent = node.text;
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    // Only on mount: the DOM owns the text while editing.
  }, [node.text]);
  const finish = () => {
    const element = ref.current;
    if (!element) return;
    onCommit(element.innerText.replace(/\n$/, ""), element.scrollHeight);
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: inline text surface keeps the layer's own layout
    <div
      ref={ref}
      className="bx-text-editing"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={`Edit ${node.name}`}
      tabIndex={0}
      spellCheck={false}
      style={{ minHeight: "100%", outline: "none", cursor: "text" }}
      onBlur={finish}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          finish();
        }
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          finish();
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
    />
  );
}

export function BoardCanvas({ editor }: { editor: BoardEditorState }) {
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [space, setSpace] = useState(false);
  const [guides, setGuides] = useState<SnapLine[]>([]);
  const [marquee, setMarquee] = useState<Bounds | null>(null);
  const [ghost, setGhost] = useState<Bounds | null>(null);
  const [panning, setPanning] = useState(false);
  const { page, viewport, selection, tool } = editor;
  const editorRef = useRef(editor);
  editorRef.current = editor;

  // Track canvas size for fit/zoom commands; fit once on mount.
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const update = () => {
      editorRef.current.canvasSize.current = {
        width: element.clientWidth,
        height: element.clientHeight,
      };
    };
    update();
    editorRef.current.fitAll();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Wheel needs a non-passive native listener to prevent browser zoom.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest?.(".bx-text-editing")) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const anchor = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      editorRef.current.setViewport((v) => wheelViewport(v, event, anchor));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  // Space-to-pan, released anywhere.
  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return (
        !!el &&
        (el.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
      );
    };
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isTyping(event.target)) {
        event.preventDefault();
        setSpace(true);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpace(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const toLocal = useCallback((event: { clientX: number; clientY: number }) => {
    const rect = root.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
  }, []);
  const toWorld = useCallback(
    (event: { clientX: number; clientY: number }) =>
      screenToWorld(editorRef.current.viewport, toLocal(event)),
    [toLocal],
  );

  const startMove = (
    event: ReactPointerEvent,
    clickedId: string,
    additive: boolean,
  ) => {
    const ed = editorRef.current;
    let ids = ed.selection;
    if (!ids.includes(clickedId)) {
      ids = additive ? [...ids, clickedId] : [clickedId];
      ed.setSelection(ids);
    }
    const movable = topmostIds(ed.page, ids).filter(
      (id) => !locate(ed.page, id)?.node.locked,
    );
    const startBounds = selectionBounds(ed.page, movable);
    if (!startBounds) return;
    gesture.current = {
      kind: "move",
      start: toWorld(event),
      startPage: ed.page,
      ids: movable,
      startBounds,
      targets: snapTargets(ed.page, movable),
      moved: false,
      clickedId,
      additive,
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const ed = editorRef.current;
    if ((event.target as HTMLElement).closest(".bx-text-editing")) return;
    root.current?.focus({ preventScroll: true });
    if (ed.editingTextId) ed.setEditingTextId(null);
    const handle = (event.target as HTMLElement).dataset.handle as
      | Handle
      | undefined;
    root.current?.setPointerCapture(event.pointerId);
    if (event.button === 1 || ed.tool === "hand" || space) {
      gesture.current = {
        kind: "pan",
        last: { x: event.clientX, y: event.clientY },
      };
      setPanning(true);
      return;
    }
    if (event.button !== 0) return;
    const world = toWorld(event);
    if (handle && ed.selection.length === 1) {
      const id = ed.selection[0] as string;
      const startAbs = absoluteBounds(ed.page, id);
      const startNode = locate(ed.page, id)?.node;
      if (startAbs && startNode) {
        gesture.current = {
          kind: "resize",
          start: world,
          startPage: ed.page,
          id,
          handle,
          startAbs,
          startNode,
        };
      }
      return;
    }
    if (
      ed.tool === "frame" ||
      ed.tool === "rect" ||
      ed.tool === "ellipse" ||
      ed.tool === "text"
    ) {
      gesture.current = { kind: "draw", start: world, tool: ed.tool };
      setGhost({ ...world, width: 0, height: 0 });
      return;
    }
    if (ed.tool === "image") return;
    const labelId = (event.target as HTMLElement).dataset.labelId;
    const hit = labelId ?? hitNode(ed.page, event.target);
    if (hit) {
      startMove(event, hit, event.shiftKey);
      return;
    }
    gesture.current = {
      kind: "marquee",
      start: world,
      base: event.shiftKey ? ed.selection : [],
    };
    if (!event.shiftKey) ed.setSelection([]);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const ed = editorRef.current;
    const g = gesture.current;
    if (!g) {
      if (ed.tool === "select" && !space) {
        const hit = hitNode(ed.page, event.target);
        if (hit !== ed.hoverId) ed.setHoverId(hit);
      }
      return;
    }
    if (g.kind === "pan") {
      const dx = event.clientX - g.last.x;
      const dy = event.clientY - g.last.y;
      g.last = { x: event.clientX, y: event.clientY };
      ed.setViewport((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      return;
    }
    const world = toWorld(event);
    if (g.kind === "move") {
      let dx = world.x - g.start.x;
      let dy = world.y - g.start.y;
      if (!g.moved && Math.hypot(dx, dy) * ed.viewport.zoom < DRAG_THRESHOLD)
        return;
      g.moved = true;
      let lines: SnapLine[] = [];
      if (!(event.metaKey || event.ctrlKey)) {
        const snap = snapBounds(
          {
            ...g.startBounds,
            x: g.startBounds.x + dx,
            y: g.startBounds.y + dy,
          },
          g.targets,
          SNAP_THRESHOLD_PX / ed.viewport.zoom,
        );
        dx += snap.dx;
        dy += snap.dy;
        lines = snap.lines;
      }
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      setGuides(lines);
      const rdx = Math.round(dx);
      const rdy = Math.round(dy);
      ed.apply(
        () =>
          updateNodes(g.startPage, g.ids, (node) => ({
            x: node.x + rdx,
            y: node.y + rdy,
          })),
        { transient: true },
      );
      return;
    }
    if (g.kind === "resize") {
      const next = resizeBounds(
        g.startAbs,
        g.handle,
        world.x - g.start.x,
        world.y - g.start.y,
        event.shiftKey,
      );
      ed.apply(
        () =>
          updateNodes(g.startPage, [g.id], {
            x: g.startNode.x + (next.x - g.startAbs.x),
            y: g.startNode.y + (next.y - g.startAbs.y),
            width: next.width,
            height: next.height,
          }),
        { transient: true },
      );
      return;
    }
    if (g.kind === "marquee") {
      const rect = normalize(g.start, world);
      setMarquee(rect);
      const hits = nodesInRect(ed.page, rect);
      ed.setSelection([...new Set([...g.base, ...hits])]);
      return;
    }
    if (g.kind === "draw") {
      setGhost(normalize(g.start, world, event.shiftKey));
    }
  };

  const finishDraw = (
    g: Extract<Gesture, { kind: "draw" }>,
    end: Point,
    square: boolean,
  ) => {
    const ed = editorRef.current;
    let rect = normalize(g.start, end, square);
    const clicked =
      rect.width * ed.viewport.zoom < DRAG_THRESHOLD &&
      rect.height * ed.viewport.zoom < DRAG_THRESHOLD;
    const parent = frameAt(ed.page, g.start);
    const parentId = parent?.id ?? null;
    if (g.tool === "text") {
      const color = ed.defaultTextColor(parentId);
      const node = textNode({
        text: "",
        name: "Text",
        x: rect.x,
        y: rect.y,
        width: clicked ? 200 : Math.max(20, rect.width),
        height: clicked ? 24 : Math.max(20, rect.height),
        color,
        fontFamily: DEFAULT_FONT,
      });
      ed.insertAt(node, { parentId, edit: true });
    } else {
      if (clicked) {
        const size =
          g.tool === "frame"
            ? { width: 400, height: 300 }
            : { width: 100, height: 100 };
        rect = {
          x: rect.x - size.width / 2,
          y: rect.y - size.height / 2,
          ...size,
        };
      }
      const count = page.nodes.length + 1;
      const node =
        g.tool === "frame"
          ? frameNode({ name: `Frame ${count}`, ...rect, fill: "#ffffff" })
          : shapeNode(g.tool, {
              ...rect,
              fill: g.tool === "rect" ? "#d9d9d9" : "#c4c4c4",
            });
      ed.insertAt(node, { parentId });
    }
    ed.setTool("select");
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const ed = editorRef.current;
    const g = gesture.current;
    gesture.current = null;
    root.current?.releasePointerCapture?.(event.pointerId);
    setGuides([]);
    setMarquee(null);
    setGhost(null);
    setPanning(false);
    if (!g) return;
    if (g.kind === "move") {
      if (!g.moved) {
        // Plain click on an already-selected layer narrows the selection.
        if (
          g.additive &&
          ed.selection.includes(g.clickedId) &&
          g.ids.includes(g.clickedId) &&
          ed.selection.length > 1
        ) {
          ed.setSelection(ed.selection.filter((id) => id !== g.clickedId));
        } else if (!g.additive) {
          ed.setSelection([g.clickedId]);
        }
        return;
      }
      // Drop into the deepest frame under the pointer (top-level frames stay put).
      const world = toWorld(event);
      let next = ed.page;
      for (const id of g.ids) {
        const found = locate(next, id);
        if (!found || (found.node.type === "frame" && !found.parent)) continue;
        const exclude = new Set([id]);
        const target = frameAt(next, world, exclude);
        const targetId = target?.id ?? null;
        if (targetId !== (found.parent?.id ?? null))
          next = reparent(next, id, targetId);
      }
      if (next !== ed.page) ed.apply(() => next, { transient: true });
      ed.commitGesture();
      return;
    }
    if (g.kind === "resize") {
      ed.commitGesture();
      return;
    }
    if (g.kind === "draw") finishDraw(g, toWorld(event), event.shiftKey);
  };

  const onDoubleClick = (event: React.MouseEvent) => {
    const ed = editorRef.current;
    const labelId = (event.target as HTMLElement).dataset.labelId;
    if (labelId) {
      const name = window.prompt(
        "Frame name",
        locate(ed.page, labelId)?.node.name ?? "",
      );
      if (name?.trim())
        ed.apply((p) =>
          updateNodes(p, [labelId], { name: name.trim().slice(0, 200) }),
        );
      return;
    }
    const hit = hitNode(ed.page, event.target);
    const node = hit ? locate(ed.page, hit)?.node : null;
    if (node?.type === "text") {
      ed.setSelection([node.id]);
      ed.setEditingTextId(node.id);
    }
  };

  const commitText = (id: string, text: string, height: number) => {
    const ed = editorRef.current;
    ed.setEditingTextId(null);
    const node = locate(ed.page, id)?.node;
    if (!node || node.type !== "text") return;
    if (!text.trim()) {
      // An emptied text layer is removed rather than left invisible.
      ed.apply((p) => removeNodes(p, [id]), { select: [] });
      return;
    }
    ed.apply((p) =>
      updateNodes(p, [id], {
        text,
        name:
          node.name === "Text" ||
          node.name === node.text.slice(0, 32).replace(/\s+/g, " ")
            ? text.slice(0, 32).replace(/\s+/g, " ")
            : node.name,
        height: Math.max(node.height, Math.ceil(height)),
      }),
    );
  };

  const z = viewport.zoom;
  const sx = (x: number) => viewport.x + x * z;
  const sy = (y: number) => viewport.y + y * z;
  const selected = selection
    .map((id) => ({ id, b: absoluteBounds(page, id) }))
    .filter((item): item is { id: string; b: Bounds } => !!item.b);
  const union = selectionBounds(page, selection);
  const hover =
    editor.hoverId && !selection.includes(editor.hoverId)
      ? absoluteBounds(page, editor.hoverId)
      : null;
  const single =
    selection.length === 1 ? locate(page, selection[0] as string)?.node : null;
  const cursor = panning
    ? "grabbing"
    : space || tool === "hand"
      ? "grab"
      : tool === "select"
        ? "default"
        : "crosshair";

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: canvas surface; layers panel is the keyboard path
    <div
      ref={root}
      className="bx-canvas"
      style={{
        cursor,
        background:
          page.background === "transparent" ? undefined : page.background,
      }}
      data-testid="board-canvas"
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        gesture.current = null;
        editorRef.current.cancelGesture();
        setGuides([]);
        setMarquee(null);
        setGhost(null);
      }}
      onPointerLeave={() => editorRef.current.setHoverId(null)}
      onDoubleClick={onDoubleClick}
      onContextMenu={(event) => event.preventDefault()}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const at = toWorld(event);
        for (const file of [...event.dataTransfer.files])
          void editorRef.current.addImageFile(file, at);
      }}
    >
      <div
        className="bx-world"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${z})`,
        }}
      >
        {page.nodes.map((node) => (
          <BoardNodeView
            key={node.id}
            node={node}
            attributes={(n) => ({
              "data-node-id": n.id,
              "data-node-type": n.type,
              "data-selected": selection.includes(n.id) ? "true" : undefined,
            })}
            renderText={(n) =>
              editor.editingTextId === n.id ? (
                <TextEditor
                  node={n}
                  onCommit={(text, height) => commitText(n.id, text, height)}
                />
              ) : (
                n.text || (n.id === editor.editingTextId ? "" : " ")
              )
            }
          />
        ))}
      </div>

      <div className="bx-overlay" aria-hidden="true">
        {page.nodes
          .filter((node) => node.type === "frame" && !node.hidden)
          .map((node) => (
            <div
              key={node.id}
              className={
                selection.includes(node.id)
                  ? "bx-frame-label selected"
                  : "bx-frame-label"
              }
              data-label-id={node.id}
              style={{
                left: sx(node.x),
                top: sy(node.y) - 22,
                maxWidth: Math.max(40, node.width * z),
              }}
            >
              {node.name}
            </div>
          ))}
        {hover ? (
          <div
            className="bx-hover"
            style={{
              left: sx(hover.x),
              top: sy(hover.y),
              width: hover.width * z,
              height: hover.height * z,
            }}
          />
        ) : null}
        {selected.length > 1
          ? selected.map(({ id, b }) => (
              <div
                key={id}
                className="bx-hover"
                style={{
                  left: sx(b.x),
                  top: sy(b.y),
                  width: b.width * z,
                  height: b.height * z,
                }}
              />
            ))
          : null}
        {union && !editor.editingTextId ? (
          <div
            className="bx-selection"
            data-testid="selection-box"
            style={{
              left: sx(union.x),
              top: sy(union.y),
              width: union.width * z,
              height: union.height * z,
            }}
          >
            {single && !single.locked
              ? HANDLES.map((h) => (
                  <span
                    key={h}
                    className={`bx-handle h-${h}`}
                    data-handle={h}
                  />
                ))
              : null}
            <span className="bx-size">
              {Math.round(union.width)} × {Math.round(union.height)}
            </span>
          </div>
        ) : null}
        {guides.map((line) =>
          line.orientation === "vertical" ? (
            <div
              key={`v-${line.position}`}
              className="bx-guide v"
              style={{
                left: sx(line.position),
                top: sy(line.start),
                height: (line.end - line.start) * z,
              }}
            />
          ) : (
            <div
              key={`h-${line.position}`}
              className="bx-guide h"
              style={{
                top: sy(line.position),
                left: sx(line.start),
                width: (line.end - line.start) * z,
              }}
            />
          ),
        )}
        {marquee ? (
          <div
            className="bx-marquee"
            style={{
              left: sx(marquee.x),
              top: sy(marquee.y),
              width: marquee.width * z,
              height: marquee.height * z,
            }}
          />
        ) : null}
        {ghost ? (
          <div
            className="bx-ghost"
            style={{
              left: sx(ghost.x),
              top: sy(ghost.y),
              width: ghost.width * z,
              height: ghost.height * z,
            }}
          />
        ) : null}
      </div>
      {page.nodes.length === 0 ? (
        <div className="bx-empty">
          <strong>This page is empty</strong>
          <span>
            Press F for a frame, R for a rectangle, T for text — or drop an
            image.
          </span>
        </div>
      ) : null}
    </div>
  );
}
