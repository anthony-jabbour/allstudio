import type {
  BoardFrameNode,
  BoardLayout,
  BoardNode,
  BoardPage,
} from "@allstudio/project";

/**
 * Auto layout ("stacks"), Framer-style.
 *
 * Onlook delegates flow layout to the browser (CSS flex inside an iframe)
 * and reads positions back asynchronously. Boards are canonical JSON, so
 * allstudio computes the stack in the model instead: children's stored x/y
 * (and the frame's size when hugging) are always the laid-out result. That
 * keeps selection, snapping, thumbnails and exports exact without DOM
 * measurement, and makes layout deterministic and unit-testable.
 */

export const DEFAULT_LAYOUT: BoardLayout = {
  direction: "column",
  gap: 16,
  padding: [24, 24, 24, 24],
  align: "start",
  justify: "start",
  hugHeight: true,
};

function same(a: BoardNode, patch: Partial<BoardNode>): boolean {
  return Object.entries(patch).every(([k, v]) => Object.is((a as never)[k], v));
}

/** Lay out one frame's direct children (children must already be laid out). */
export function layoutFrame(frame: BoardFrameNode): BoardFrameNode {
  const layout = frame.layout;
  if (!layout) return frame;
  const row = layout.direction === "row";
  const [pt, pr, pb, pl] = layout.padding;
  const flow = frame.children.filter((child) => !child.hidden);
  const mainSize = (n: BoardNode) => (row ? n.width : n.height);
  const content =
    flow.reduce((sum, n) => sum + mainSize(n), 0) +
    Math.max(0, flow.length - 1) * layout.gap;
  const crossContent = Math.max(
    0,
    ...flow.map((n) => (row ? n.height : n.width)),
  );

  let width = frame.width;
  let height = frame.height;
  if (layout.hugWidth) width = row ? content + pl + pr : crossContent + pl + pr;
  if (layout.hugHeight)
    height = row ? crossContent + pt + pb : content + pt + pb;

  const innerMain = row ? width - pl - pr : height - pt - pb;
  const innerCross = row ? height - pt - pb : width - pl - pr;
  let cursor = row ? pl : pt;
  let gap = layout.gap;
  const free = innerMain - content;
  if (layout.justify === "center") cursor += free / 2;
  if (layout.justify === "end") cursor += free;
  if (layout.justify === "space-between" && flow.length > 1) {
    gap = layout.gap + Math.max(0, free) / (flow.length - 1);
  }

  let changed = width !== frame.width || height !== frame.height;
  const positioned = new Map<string, BoardNode>();
  for (const child of flow) {
    const crossSize =
      layout.align === "stretch"
        ? Math.max(1, innerCross)
        : row
          ? child.height
          : child.width;
    const crossStart = row ? pt : pl;
    const crossOffset =
      layout.align === "center"
        ? (innerCross - crossSize) / 2
        : layout.align === "end"
          ? innerCross - crossSize
          : 0;
    const patch = row
      ? {
          x: Math.round(cursor),
          y: Math.round(crossStart + crossOffset),
          height: Math.round(crossSize),
        }
      : {
          x: Math.round(crossStart + crossOffset),
          y: Math.round(cursor),
          width: Math.round(crossSize),
        };
    cursor += mainSize(child) + gap;
    if (!same(child, patch)) {
      positioned.set(child.id, { ...child, ...patch } as BoardNode);
      changed = true;
    }
  }
  if (!changed) return frame;
  return {
    ...frame,
    width: Math.round(width),
    height: Math.round(height),
    children: frame.children.map((child) => positioned.get(child.id) ?? child),
  };
}

function layoutTree(nodes: BoardNode[]): BoardNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.type !== "frame") return node;
    const children = layoutTree(node.children);
    let frame = children === node.children ? node : { ...node, children };
    frame = layoutFrame(frame);
    if (frame !== node) changed = true;
    return frame;
  });
  return changed ? next : nodes;
}

/** Re-run every stack on the page, innermost first. Returns the same page if nothing moved. */
export function normalizeLayouts(page: BoardPage): BoardPage {
  const nodes = layoutTree(page.nodes);
  return nodes === page.nodes ? page : { ...page, nodes };
}

/**
 * Guess a layout from the children's current arrangement (used by "Add auto
 * layout"): a row if they spread more horizontally, with the average gap.
 */
export function inferLayout(frame: BoardFrameNode): BoardLayout {
  const kids = frame.children.filter((c) => !c.hidden);
  if (kids.length < 2) return { ...DEFAULT_LAYOUT };
  const xs = kids.map((c) => c.x);
  const ys = kids.map((c) => c.y);
  const row =
    Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys);
  const sorted = [...kids].sort((a, b) => (row ? a.x - b.x : a.y - b.y));
  const gaps = sorted
    .slice(1)
    .map((c, i) => {
      const prev = sorted[i] as BoardNode;
      return row ? c.x - (prev.x + prev.width) : c.y - (prev.y + prev.height);
    })
    .filter((g) => g >= 0);
  const gap = gaps.length
    ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
    : 16;
  const left = Math.max(0, Math.min(...xs));
  const top = Math.max(0, Math.min(...ys));
  return {
    direction: row ? "row" : "column",
    gap,
    padding: [top, left, top, left],
    align: "start",
    justify: "start",
    ...(row ? { hugWidth: true } : { hugHeight: true }),
  };
}

/** Children in visual (main-axis) order, for frames gaining a layout. */
export function sortForLayout(
  frame: BoardFrameNode,
  layout: BoardLayout,
): BoardFrameNode {
  const row = layout.direction === "row";
  const children = [...frame.children].sort((a, b) =>
    row ? a.x - b.x : a.y - b.y,
  );
  return { ...frame, children };
}

/**
 * Index a dragged child should take inside a stack, from the pointer's
 * position in the frame's local coordinates (siblings' midpoints decide).
 */
export function stackInsertIndex(
  frame: BoardFrameNode,
  draggedId: string,
  local: { x: number; y: number },
): number {
  const row = frame.layout?.direction === "row";
  const siblings = frame.children.filter(
    (c) => c.id !== draggedId && !c.hidden,
  );
  let index = 0;
  for (const sibling of siblings) {
    const mid = row
      ? sibling.x + sibling.width / 2
      : sibling.y + sibling.height / 2;
    if ((row ? local.x : local.y) > mid) index++;
  }
  // Map the visible-sibling index back to an index in the full child list.
  const without = frame.children.filter((c) => c.id !== draggedId);
  const anchor = siblings[index];
  return anchor ? without.indexOf(anchor) : without.length;
}
