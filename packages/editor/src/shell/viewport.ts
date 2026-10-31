import {
  DEFAULT_BREAKPOINT_WIDTHS,
  EDIT_BREAKPOINTS,
  type EditBreakpoint,
} from "../site/class-tokens.ts";

export const VIEWPORT_PRESETS = [
  { label: "Mobile", width: 390 },
  { label: "Tablet", width: 768 },
  { label: "Laptop", width: 1024 },
  { label: "Desktop", width: 1440 },
] as const;

export function isViewportWidth(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 320 &&
    value <= 2560
  );
}

export function breakpointForWidth(width: number): EditBreakpoint {
  if (!isViewportWidth(width)) throw new RangeError("Invalid viewport width.");
  let breakpoint: EditBreakpoint = "base";
  for (const candidate of EDIT_BREAKPOINTS) {
    if (DEFAULT_BREAKPOINT_WIDTHS[candidate] <= width) breakpoint = candidate;
  }
  return breakpoint;
}

export function fitScale(
  width: number,
  height: number,
  availableWidth: number,
  availableHeight: number,
): number | null {
  if (
    ![width, height, availableWidth, availableHeight].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    return null;
  return Math.max(
    0.1,
    Math.min(1, availableWidth / width, availableHeight / height),
  );
}
