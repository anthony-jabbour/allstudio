import {
  type BoardDocumentV1,
  type BoardFrameNode,
  type BoardNode,
  type BoardPage,
  createBoardId,
} from "@allstudio/project";
import type { Bounds } from "./render.tsx";

/**
 * Pure, immutable board operations. Every editor command goes through these
 * functions so they can be unit tested without a DOM, and so each command
 * yields a whole new document for undo/redo.
 */

export interface Located {
  node: BoardNode;
  parent: BoardFrameNode | null;
  index: number;
  /** Ancestor frames from the page root down to the parent. */
  ancestors: BoardFrameNode[];
}

export function locate(page: BoardPage, id: string): Located | null {
  const search = (
    nodes: BoardNode[],
    parent: BoardFrameNode | null,
    ancestors: BoardFrameNode[],
  ): Located | null => {
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index] as BoardNode;
      if (node.id === id) return { node, parent, index, ancestors };
      if (node.type === "frame") {
        const found = search(node.children, node, [...ancestors, node]);
        if (found) return found;
      }
    }
    return null;
  };
  return search(page.nodes, null, []);
}

export function findNode(page: BoardPage, id: string): BoardNode | null {
  return locate(page, id)?.node ?? null;
}

/** Visit every node depth-first (parents before children). */
export function walk(
  nodes: BoardNode[],
  visit: (node: BoardNode, parent: BoardFrameNode | null) => void,
  parent: BoardFrameNode | null = null,
) {
  for (const node of nodes) {
    visit(node, parent);
    if (node.type === "frame") walk(node.children, visit, node);
  }
}

export function absoluteOrigin(page: BoardPage, id: string) {
  const found = locate(page, id);
  if (!found) return null;
  let x = 0;
  let y = 0;
  for (const frame of found.ancestors) {
    x += frame.x;
    y += frame.y;
  }
  return { x, y };
}

export function absoluteBounds(page: BoardPage, id: string): Bounds | null {
  const found = locate(page, id);
  const origin = absoluteOrigin(page, id);
  if (!found || !origin) return null;
  return {
    x: origin.x + found.node.x,
    y: origin.y + found.node.y,
    width: found.node.width,
    height: found.node.height,
  };
}

export function unionBounds(bounds: Bounds[]): Bounds | null {
  if (bounds.length === 0) return null;
  const left = Math.min(...bounds.map((b) => b.x));
  const top = Math.min(...bounds.map((b) => b.y));
  const right = Math.max(...bounds.map((b) => b.x + b.width));
  const bottom = Math.max(...bounds.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function selectionBounds(page: BoardPage, ids: string[]): Bounds | null {
  return unionBounds(
    ids
      .map((id) => absoluteBounds(page, id))
      .filter((b): b is Bounds => b !== null),
  );
}

function mapTree(
  nodes: BoardNode[],
  fn: (node: BoardNode) => BoardNode,
): BoardNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    let mapped = fn(node);
    if (mapped.type === "frame") {
      const children = mapTree(mapped.children, fn);
      if (children !== mapped.children) mapped = { ...mapped, children };
    }
    if (mapped !== node) changed = true;
    return mapped;
  });
  return changed ? next : nodes;
}

export function updatePage(
  doc: BoardDocumentV1,
  pageId: string,
  fn: (page: BoardPage) => BoardPage,
): BoardDocumentV1 {
  let changed = false;
  const pages = doc.pages.map((page) => {
    if (page.id !== pageId) return page;
    const next = fn(page);
    if (next !== page) changed = true;
    return next;
  });
  return changed ? { ...doc, pages } : doc;
}

export type NodePatch = Partial<Omit<BoardNode, "id" | "type">> &
  Record<string, unknown>;

/** Patch nodes by id. A function patch receives each current node. */
export function updateNodes(
  page: BoardPage,
  ids: Iterable<string>,
  patch: NodePatch | ((node: BoardNode) => NodePatch),
): BoardPage {
  const wanted = new Set(ids);
  if (wanted.size === 0) return page;
  const nodes = mapTree(page.nodes, (node) => {
    if (!wanted.has(node.id)) return node;
    const values = typeof patch === "function" ? patch(node) : patch;
    const keys = Object.keys(values);
    if (keys.every((key) => Object.is((node as never)[key], values[key]))) {
      return node;
    }
    return { ...node, ...values } as BoardNode;
  });
  return nodes === page.nodes ? page : { ...page, nodes };
}

/** Drop ids whose ancestor is also selected (moving a parent moves them). */
export function topmostIds(page: BoardPage, ids: string[]): string[] {
  const set = new Set(ids);
  return ids.filter((id) => {
    const found = locate(page, id);
    return found && !found.ancestors.some((frame) => set.has(frame.id));
  });
}

export function removeNodes(page: BoardPage, ids: Iterable<string>): BoardPage {
  const doomed = new Set(ids);
  if (doomed.size === 0) return page;
  const prune = (nodes: BoardNode[]): BoardNode[] => {
    let changed = false;
    const next: BoardNode[] = [];
    for (const node of nodes) {
      if (doomed.has(node.id)) {
        changed = true;
        continue;
      }
      if (node.type === "frame") {
        const children = prune(node.children);
        if (children !== node.children) {
          changed = true;
          next.push({ ...node, children });
          continue;
        }
      }
      next.push(node);
    }
    return changed ? next : nodes;
  };
  const nodes = prune(page.nodes);
  return nodes === page.nodes ? page : { ...page, nodes };
}

/** Insert at `index` (default: on top) inside `parentId`, or the page root. */
export function insertNodes(
  page: BoardPage,
  inserted: BoardNode[],
  parentId: string | null,
  index?: number,
): BoardPage {
  if (parentId === null) {
    const nodes = [...page.nodes];
    nodes.splice(index ?? nodes.length, 0, ...inserted);
    return { ...page, nodes };
  }
  return {
    ...page,
    nodes: mapTree(page.nodes, (node) => {
      if (node.id !== parentId || node.type !== "frame") return node;
      const children = [...node.children];
      children.splice(index ?? children.length, 0, ...inserted);
      return { ...node, children };
    }),
  };
}

export function isDescendant(
  page: BoardPage,
  ancestorId: string,
  id: string,
): boolean {
  return !!locate(page, id)?.ancestors.some((frame) => frame.id === ancestorId);
}

/**
 * Move a node to a new parent (or the page root) at `index`, keeping its
 * on-canvas position. Refuses cycles (a frame into its own descendant).
 */
export function reparent(
  page: BoardPage,
  id: string,
  parentId: string | null,
  index?: number,
): BoardPage {
  const found = locate(page, id);
  if (!found) return page;
  if (parentId === id || (parentId && isDescendant(page, id, parentId))) {
    return page;
  }
  const from = absoluteOrigin(page, id);
  let toX = 0;
  let toY = 0;
  if (parentId) {
    const target = absoluteBounds(page, parentId);
    const parent = findNode(page, parentId);
    if (!target || parent?.type !== "frame") return page;
    toX = target.x;
    toY = target.y;
  }
  const moved = {
    ...found.node,
    x: found.node.x + (from?.x ?? 0) - toX,
    y: found.node.y + (from?.y ?? 0) - toY,
  } as BoardNode;
  let adjusted = index;
  if (
    adjusted !== undefined &&
    (found.parent?.id ?? null) === parentId &&
    found.index < adjusted
  ) {
    adjusted -= 1;
  }
  return insertNodes(removeNodes(page, [id]), [moved], parentId, adjusted);
}

function cloneWithIds(node: BoardNode): BoardNode {
  const copy = { ...node, id: createBoardId() } as BoardNode;
  if (copy.type === "frame") copy.children = copy.children.map(cloneWithIds);
  return copy;
}

/** Duplicate nodes next to their originals; returns the new top ids. */
export function duplicateNodes(
  page: BoardPage,
  ids: string[],
  offset = { x: 16, y: 16 },
): { page: BoardPage; ids: string[] } {
  let next = page;
  const created: string[] = [];
  for (const id of topmostIds(page, ids)) {
    const found = locate(next, id);
    if (!found) continue;
    const copy = cloneWithIds(found.node);
    copy.x += offset.x;
    copy.y += offset.y;
    copy.name = found.node.name;
    next = insertNodes(next, [copy], found.parent?.id ?? null, found.index + 1);
    created.push(copy.id);
  }
  return { page: next, ids: created };
}

/** Deep-copy nodes for the clipboard, with absolute coordinates. */
export function copyNodes(page: BoardPage, ids: string[]): BoardNode[] {
  return topmostIds(page, ids).flatMap((id) => {
    const found = locate(page, id);
    const origin = absoluteOrigin(page, id);
    if (!found || !origin) return [];
    return [
      {
        ...structuredClone(found.node),
        x: found.node.x + origin.x,
        y: found.node.y + origin.y,
      } as BoardNode,
    ];
  });
}

/** Paste clipboard nodes (absolute coords) into a parent with fresh ids. */
export function pasteNodes(
  page: BoardPage,
  nodes: BoardNode[],
  parentId: string | null,
  offset = { x: 24, y: 24 },
): { page: BoardPage; ids: string[] } {
  const origin = parentId
    ? (absoluteBounds(page, parentId) ?? { x: 0, y: 0 })
    : { x: 0, y: 0 };
  const copies = nodes.map((node) => {
    const copy = cloneWithIds(node);
    copy.x = node.x - origin.x + offset.x;
    copy.y = node.y - origin.y + offset.y;
    return copy;
  });
  return {
    page: insertNodes(page, copies, parentId),
    ids: copies.map((copy) => copy.id),
  };
}

export type Reorder = "forward" | "backward" | "front" | "back";

export function reorderNodes(
  page: BoardPage,
  ids: string[],
  direction: Reorder,
): BoardPage {
  let next = page;
  const indexOf = (id: string) => locate(page, id)?.index ?? 0;
  // Process in an order that keeps the moved nodes' relative stacking.
  const descending = direction === "forward" || direction === "back";
  const sorted = [...ids].sort((a, b) =>
    descending ? indexOf(b) - indexOf(a) : indexOf(a) - indexOf(b),
  );
  for (const id of sorted) {
    const found = locate(next, id);
    if (!found) continue;
    const siblings = found.parent ? found.parent.children : next.nodes;
    const last = siblings.length - 1;
    const target =
      direction === "front"
        ? last
        : direction === "back"
          ? 0
          : Math.max(
              0,
              Math.min(last, found.index + (direction === "forward" ? 1 : -1)),
            );
    if (target === found.index) continue;
    const without = removeNodes(next, [id]);
    next = insertNodes(without, [found.node], found.parent?.id ?? null, target);
  }
  return next;
}

/**
 * Wrap siblings in a new frame sized to their bounds (Cmd/Ctrl+G).
 * Only nodes that share a parent can be framed together.
 */
export function frameSelection(
  page: BoardPage,
  ids: string[],
): { page: BoardPage; id: string } | null {
  const top = topmostIds(page, ids);
  const located = top
    .map((id) => locate(page, id))
    .filter((v): v is Located => v !== null);
  if (located.length === 0) return null;
  const parentId = located[0]?.parent?.id ?? null;
  if (located.some((item) => (item.parent?.id ?? null) !== parentId)) {
    return null;
  }
  const bounds = unionBounds(located.map((item) => item.node));
  if (!bounds) return null;
  const index = Math.min(...located.map((item) => item.index));
  const ordered = [...located].sort((a, b) => a.index - b.index);
  const frame: BoardFrameNode = {
    id: createBoardId(),
    type: "frame",
    name: "Frame",
    ...bounds,
    fill: null,
    clip: false,
    children: ordered.map(
      (item) =>
        ({
          ...item.node,
          x: item.node.x - bounds.x,
          y: item.node.y - bounds.y,
        }) as BoardNode,
    ),
  };
  const without = removeNodes(page, top);
  return { page: insertNodes(without, [frame], parentId, index), id: frame.id };
}

/** Move a frame's children up to its parent and remove the frame. */
export function unframe(
  page: BoardPage,
  id: string,
): { page: BoardPage; ids: string[] } | null {
  const found = locate(page, id);
  if (!found || found.node.type !== "frame") return null;
  const frame = found.node;
  const children = frame.children.map(
    (child) =>
      ({ ...child, x: child.x + frame.x, y: child.y + frame.y }) as BoardNode,
  );
  const without = removeNodes(page, [id]);
  return {
    page: insertNodes(without, children, found.parent?.id ?? null, found.index),
    ids: children.map((child) => child.id),
  };
}

export type Alignment =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom";

/**
 * Align to the selection bounds; a single node aligns within its parent
 * frame (or does nothing at the page root).
 */
export function alignNodes(
  page: BoardPage,
  ids: string[],
  alignment: Alignment,
): BoardPage {
  const top = topmostIds(page, ids);
  let target: Bounds | null;
  if (top.length === 1) {
    const found = top[0] ? locate(page, top[0]) : null;
    if (!found?.parent) return page;
    target = absoluteBounds(page, found.parent.id);
  } else {
    target = selectionBounds(page, top);
  }
  if (!target) return page;
  const t = target;
  return updateNodes(page, top, (node) => {
    const abs = absoluteBounds(page, node.id);
    if (!abs) return {};
    let dx = 0;
    let dy = 0;
    if (alignment === "left") dx = t.x - abs.x;
    if (alignment === "center")
      dx = t.x + t.width / 2 - (abs.x + abs.width / 2);
    if (alignment === "right") dx = t.x + t.width - (abs.x + abs.width);
    if (alignment === "top") dy = t.y - abs.y;
    if (alignment === "middle")
      dy = t.y + t.height / 2 - (abs.y + abs.height / 2);
    if (alignment === "bottom") dy = t.y + t.height - (abs.y + abs.height);
    return { x: Math.round(node.x + dx), y: Math.round(node.y + dy) };
  });
}

/** Lay top-level frames out left to right with a fixed gap. */
export function tidyFrames(page: BoardPage, gap = 120): BoardPage {
  let x = 0;
  const y = Math.min(0, ...page.nodes.map((node) => node.y));
  const nodes = page.nodes.map((node) => {
    if (node.type !== "frame") return node;
    const next = { ...node, x, y };
    x += node.width + gap;
    return next;
  });
  return { ...page, nodes };
}

/**
 * Deepest visible frame whose absolute bounds contain the point, skipping
 * `exclude` and their descendants. Used to choose a parent when drawing or
 * dropping nodes.
 */
export function frameAt(
  page: BoardPage,
  point: { x: number; y: number },
  exclude: Set<string> = new Set(),
): BoardFrameNode | null {
  let best: BoardFrameNode | null = null;
  const visit = (nodes: BoardNode[], ox: number, oy: number) => {
    for (const node of nodes) {
      if (node.type !== "frame" || node.hidden || exclude.has(node.id))
        continue;
      const x = ox + node.x;
      const y = oy + node.y;
      if (
        point.x >= x &&
        point.y >= y &&
        point.x <= x + node.width &&
        point.y <= y + node.height
      ) {
        best = node;
        visit(node.children, x, y);
      }
    }
  };
  visit(page.nodes, 0, 0);
  return best;
}

/** Top-level nodes intersecting a world-space rectangle (marquee). */
export function nodesInRect(page: BoardPage, rect: Bounds): string[] {
  return page.nodes
    .filter(
      (node) =>
        !node.hidden &&
        !node.locked &&
        node.x < rect.x + rect.width &&
        node.x + node.width > rect.x &&
        node.y < rect.y + rect.height &&
        node.y + node.height > rect.y,
    )
    .map((node) => node.id);
}

export function addPage(
  doc: BoardDocumentV1,
  name = `Page ${doc.pages.length + 1}`,
): { doc: BoardDocumentV1; id: string } {
  const page: BoardPage = {
    id: createBoardId("p"),
    name,
    background: "transparent",
    nodes: [],
  };
  return { doc: { ...doc, pages: [...doc.pages, page] }, id: page.id };
}

export function duplicatePage(
  doc: BoardDocumentV1,
  pageId: string,
): { doc: BoardDocumentV1; id: string } | null {
  const index = doc.pages.findIndex((page) => page.id === pageId);
  const source = doc.pages[index];
  if (!source) return null;
  const page: BoardPage = {
    ...source,
    id: createBoardId("p"),
    name: `${source.name} copy`.slice(0, 200),
    nodes: source.nodes.map(cloneWithIds),
  };
  const pages = [...doc.pages];
  pages.splice(index + 1, 0, page);
  return { doc: { ...doc, pages }, id: page.id };
}

export function deletePage(
  doc: BoardDocumentV1,
  pageId: string,
): BoardDocumentV1 {
  if (doc.pages.length <= 1) return doc;
  return { ...doc, pages: doc.pages.filter((page) => page.id !== pageId) };
}

export function renamePage(
  doc: BoardDocumentV1,
  pageId: string,
  name: string,
): BoardDocumentV1 {
  const trimmed = name.trim().slice(0, 200);
  if (!trimmed) return doc;
  return updatePage(doc, pageId, (page) =>
    page.name === trimmed ? page : { ...page, name: trimmed },
  );
}

export function movePage(
  doc: BoardDocumentV1,
  pageId: string,
  toIndex: number,
): BoardDocumentV1 {
  const from = doc.pages.findIndex((page) => page.id === pageId);
  if (from < 0) return doc;
  const pages = [...doc.pages];
  const [page] = pages.splice(from, 1);
  if (!page) return doc;
  pages.splice(Math.max(0, Math.min(pages.length, toIndex)), 0, page);
  return { ...doc, pages };
}

/** Spread 3+ siblings so the gaps between them are equal (Framer "Distribute"). */
export function distributeNodes(
  page: BoardPage,
  ids: string[],
  axis: "horizontal" | "vertical",
): BoardPage {
  const top = topmostIds(page, ids);
  if (top.length < 3) return page;
  const row = axis === "horizontal";
  const items = top
    .map((id) => ({ id, b: absoluteBounds(page, id) }))
    .filter((v): v is { id: string; b: Bounds } => v.b !== null)
    .sort((a, b) => (row ? a.b.x - b.b.x : a.b.y - b.b.y));
  const first = items[0]?.b;
  const last = items.at(-1)?.b;
  if (!first || !last) return page;
  const span = row
    ? last.x + last.width - first.x
    : last.y + last.height - first.y;
  const sizes = items.reduce(
    (sum, i) => sum + (row ? i.b.width : i.b.height),
    0,
  );
  const gap = (span - sizes) / (items.length - 1);
  let cursor = row ? first.x : first.y;
  const targets = new Map<string, number>();
  for (const item of items) {
    targets.set(item.id, cursor - (row ? item.b.x : item.b.y));
    cursor += (row ? item.b.width : item.b.height) + gap;
  }
  return updateNodes(page, targets.keys(), (node) => {
    const delta = Math.round(targets.get(node.id) ?? 0);
    return row ? { x: node.x + delta } : { y: node.y + delta };
  });
}

const SHARED_STYLE_KEYS = [
  "fill",
  "gradient",
  "stroke",
  "radius",
  "radii",
  "shadow",
  "opacity",
  "blur",
  "blendMode",
] as const;
const TEXT_STYLE_KEYS = [
  "color",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textAlign",
] as const;

export type CopiedStyle = {
  fromText: boolean;
  values: Record<string, unknown>;
};

/** Copy visual properties (not geometry, name or content) from a layer. */
export function copyStyle(node: BoardNode): CopiedStyle {
  const values: Record<string, unknown> = {};
  for (const key of SHARED_STYLE_KEYS)
    values[key] = (node as never)[key] ?? null;
  if (node.type === "text") {
    for (const key of TEXT_STYLE_KEYS) values[key] = node[key];
  }
  return { fromText: node.type === "text", values: structuredClone(values) };
}

/** Paste a copied style; text properties only land on text layers. */
export function pasteStyle(
  page: BoardPage,
  ids: string[],
  style: CopiedStyle,
): BoardPage {
  return updateNodes(page, ids, (node) => {
    const patch: Record<string, unknown> = {};
    for (const key of SHARED_STYLE_KEYS) {
      const value = style.values[key];
      if (key === "radius" || key === "opacity" || key === "blur") {
        if (typeof value === "number") patch[key] = value;
        else patch[key] = undefined;
      } else if (key === "blendMode") {
        patch[key] = value ?? undefined;
      } else patch[key] = value;
    }
    if (node.type === "text" && style.fromText) {
      for (const key of TEXT_STYLE_KEYS) patch[key] = style.values[key];
    }
    return structuredClone(patch);
  });
}
