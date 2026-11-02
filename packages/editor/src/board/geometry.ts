/*
 * Snapping and viewport math for the board canvas.
 *
 * Adapted from Onlook (Apache-2.0), via the founder's onlook-baseline fork:
 *   apps/web/client/src/components/store/editor/snap/index.ts  (SnapManager)
 *   apps/web/client/src/app/project/[id]/_components/canvas/index.tsx (wheel zoom/pan)
 * Upstream: https://github.com/onlook-dev/onlook @ 423e2e924366419e418ee049093872d535eea41a
 * Modifications by allstudio (2026-11-02): rewritten as pure functions over
 * plain rectangles (no MobX engine or frame manager), snaps X and Y axes
 * independently, works in world units with a zoom-scaled threshold, and
 * replaces the drift-compensation offset with exact cursor-anchored zoom.
 */
import type { Bounds } from "./render.tsx";

export const SNAP_THRESHOLD_PX = 6;
const LINE_EXTENSION = 40;

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;
const ZOOM_SENSITIVITY = 0.006;
const PAN_SENSITIVITY = 1;

export interface Viewport {
  /** Screen-space offset of the world origin. */
  x: number;
  y: number;
  zoom: number;
}

export interface SnapLine {
  orientation: "vertical" | "horizontal";
  /** World coordinate of the line (x for vertical, y for horizontal). */
  position: number;
  start: number;
  end: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  lines: SnapLine[];
}

interface Edges {
  left: number;
  centerX: number;
  right: number;
  top: number;
  centerY: number;
  bottom: number;
}

function edges(b: Bounds): Edges {
  return {
    left: b.x,
    centerX: b.x + b.width / 2,
    right: b.x + b.width,
    top: b.y,
    centerY: b.y + b.height / 2,
    bottom: b.y + b.height,
  };
}

/**
 * Snap a moving rectangle to the edges and centers of target rectangles.
 * Returns the correction to apply and the guide lines to draw. The
 * threshold is in world units (pass screen px / zoom).
 */
export function snapBounds(
  moving: Bounds,
  targets: Bounds[],
  threshold: number,
): SnapResult {
  const m = edges(moving);
  let bestX: { offset: number; line: SnapLine } | null = null;
  let bestY: { offset: number; line: SnapLine } | null = null;
  for (const target of targets) {
    const t = edges(target);
    for (const from of [m.left, m.centerX, m.right]) {
      for (const to of [t.left, t.centerX, t.right]) {
        const offset = to - from;
        if (
          Math.abs(offset) <= threshold &&
          (!bestX || Math.abs(offset) < Math.abs(bestX.offset))
        ) {
          bestX = {
            offset,
            line: {
              orientation: "vertical",
              position: to,
              start: Math.min(m.top, t.top) - LINE_EXTENSION,
              end: Math.max(m.bottom, t.bottom) + LINE_EXTENSION,
            },
          };
        }
      }
    }
    for (const from of [m.top, m.centerY, m.bottom]) {
      for (const to of [t.top, t.centerY, t.bottom]) {
        const offset = to - from;
        if (
          Math.abs(offset) <= threshold &&
          (!bestY || Math.abs(offset) < Math.abs(bestY.offset))
        ) {
          bestY = {
            offset,
            line: {
              orientation: "horizontal",
              position: to,
              start: Math.min(m.left, t.left) - LINE_EXTENSION,
              end: Math.max(m.right, t.right) + LINE_EXTENSION,
            },
          };
        }
      }
    }
  }
  return {
    dx: bestX?.offset ?? 0,
    dy: bestY?.offset ?? 0,
    lines: [bestX?.line, bestY?.line].filter((l): l is SnapLine => !!l),
  };
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function screenToWorld(
  viewport: Viewport,
  point: { x: number; y: number },
) {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
}

/** Zoom keeping the world point under `anchor` (screen px) fixed. */
export function zoomAt(
  viewport: Viewport,
  zoom: number,
  anchor: { x: number; y: number },
): Viewport {
  const next = clampZoom(zoom);
  const world = screenToWorld(viewport, anchor);
  return {
    zoom: next,
    x: anchor.x - world.x * next,
    y: anchor.y - world.y * next,
  };
}

/** Wheel: Ctrl/Cmd (and trackpad pinch) zooms at the cursor, else pans. */
export function wheelViewport(
  viewport: Viewport,
  event: {
    deltaX: number;
    deltaY: number;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  },
  anchor: { x: number; y: number },
): Viewport {
  if (event.ctrlKey || event.metaKey) {
    const factor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY);
    return zoomAt(viewport, viewport.zoom * factor, anchor);
  }
  const dx =
    (event.deltaX + (event.shiftKey ? event.deltaY : 0)) * PAN_SENSITIVITY;
  const dy = (event.shiftKey ? 0 : event.deltaY) * PAN_SENSITIVITY;
  return { ...viewport, x: viewport.x - dx, y: viewport.y - dy };
}

/** Fit bounds into a screen box with padding. */
export function fitBounds(
  bounds: Bounds,
  screen: { width: number; height: number },
  padding = 80,
  maxZoom = 1,
): Viewport {
  const zoom = clampZoom(
    Math.min(
      (screen.width - padding * 2) / Math.max(bounds.width, 1),
      (screen.height - padding * 2) / Math.max(bounds.height, 1),
      maxZoom,
    ),
  );
  return {
    zoom,
    x: screen.width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: screen.height / 2 - (bounds.y + bounds.height / 2) * zoom,
  };
}

export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/** Resize a rectangle by dragging a handle; Shift keeps the aspect ratio. */
export function resizeBounds(
  start: Bounds,
  handle: Handle,
  dx: number,
  dy: number,
  keepAspect: boolean,
): Bounds {
  let { x, y, width, height } = start;
  if (handle.includes("e")) width = start.width + dx;
  if (handle.includes("w")) {
    width = start.width - dx;
    x = start.x + dx;
  }
  if (handle.includes("s")) height = start.height + dy;
  if (handle.includes("n")) {
    height = start.height - dy;
    y = start.y + dy;
  }
  if (keepAspect && start.width > 0 && start.height > 0) {
    const ratio = start.width / start.height;
    if (handle === "n" || handle === "s") {
      width = height * ratio;
      x = start.x + (start.width - width) / 2;
    } else if (handle === "e" || handle === "w") {
      height = width / ratio;
      y = start.y + (start.height - height) / 2;
    } else if (
      Math.abs(width / start.width) > Math.abs(height / start.height)
    ) {
      height = width / ratio;
      if (handle.includes("n")) y = start.y + start.height - height;
    } else {
      width = height * ratio;
      if (handle.includes("w")) x = start.x + start.width - width;
    }
  }
  // Dragging past the opposite edge flips instead of producing negatives.
  if (width < 0) {
    x += width;
    width = -width;
  }
  if (height < 0) {
    y += height;
    height = -height;
  }
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}
