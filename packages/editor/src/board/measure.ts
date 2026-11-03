/*
 * Distance measurement between two rectangles (hold Alt while hovering).
 *
 * Reference: Onlook (Apache-2.0) apps/web/client/src/app/project/[id]/_components/
 * canvas/overlay/elements/measurement.tsx @ 423e2e9. allstudio rewrite
 * (2026-11-02): a pure function in world units instead of a React component
 * bound to the editor engine and iframe views; the five near-duplicate
 * branches per axis are folded into one per-axis routine; containment and
 * overlap both report all four edge gaps; zero-length gaps are dropped.
 */
import type { Bounds } from "./render.tsx";

export interface Measurement {
  axis: "x" | "y";
  /** Distance in world units (always positive). */
  value: number;
  /** Segment to draw, in world coordinates. */
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface Span {
  start: number;
  end: number;
}

/** Gaps between two spans on one axis: outer gap, or edge deltas when overlapping. */
function spanGaps(a: Span, b: Span): [number, number][] {
  if (a.end <= b.start) return [[a.end, b.start]];
  if (b.end <= a.start) return [[b.end, a.start]];
  // Overlapping or nested: measure both pairs of matching edges.
  return [
    [Math.min(a.start, b.start), Math.max(a.start, b.start)],
    [Math.min(a.end, b.end), Math.max(a.end, b.end)],
  ];
}

export function measureDistances(from: Bounds, to: Bounds): Measurement[] {
  const out: Measurement[] = [];
  // Horizontal lines are drawn through the middle of the shared vertical range.
  const yTop = Math.max(from.y, to.y);
  const yBottom = Math.min(from.y + from.height, to.y + to.height);
  const yLine =
    yTop <= yBottom ? (yTop + yBottom) / 2 : from.y + from.height / 2;
  for (const [a, b] of spanGaps(
    { start: from.x, end: from.x + from.width },
    { start: to.x, end: to.x + to.width },
  )) {
    if (b - a >= 0.5)
      out.push({
        axis: "x",
        value: b - a,
        from: { x: a, y: yLine },
        to: { x: b, y: yLine },
      });
  }
  const xLeft = Math.max(from.x, to.x);
  const xRight = Math.min(from.x + from.width, to.x + to.width);
  const xLine =
    xLeft <= xRight ? (xLeft + xRight) / 2 : from.x + from.width / 2;
  for (const [a, b] of spanGaps(
    { start: from.y, end: from.y + from.height },
    { start: to.y, end: to.y + to.height },
  )) {
    if (b - a >= 0.5)
      out.push({
        axis: "y",
        value: b - a,
        from: { x: xLine, y: a },
        to: { x: xLine, y: b },
      });
  }
  return out;
}
