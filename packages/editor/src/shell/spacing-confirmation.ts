import type { PreviewSpacing } from "../preview-bridge/protocol.ts";
import {
  inspectSpacingClasses,
  type SpacingExpectation,
  type SpacingProperty,
} from "../site/spacing.ts";

export interface SpacingTarget {
  key: keyof PreviewSpacing;
  expectation: SpacingExpectation;
  before: string;
}
const AXES: ReadonlyArray<
  readonly [SpacingProperty, ReadonlyArray<keyof PreviewSpacing>]
> = [
  ["paddingInline", ["paddingInlineStart", "paddingInlineEnd"]],
  ["paddingBlock", ["paddingBlockStart", "paddingBlockEnd"]],
  ["marginInline", ["marginInlineStart", "marginInlineEnd"]],
  ["marginBlock", ["marginBlockStart", "marginBlockEnd"]],
  ["columnGap", ["columnGap"]],
  ["rowGap", ["rowGap"]],
];
export function spacingTargets(
  beforeClass: string,
  afterClass: string,
  measured: PreviewSpacing,
): { ok: true; targets: SpacingTarget[] } | { ok: false; message: string } {
  const before = inspectSpacingClasses(beforeClass),
    after = inspectSpacingClasses(afterClass);
  const targets: SpacingTarget[] = [];
  for (const [property, keys] of AXES) {
    const old = before[property],
      next = after[property];
    if (
      old.state === "value" &&
      next.state === "value" &&
      old.value === next.value
    )
      continue;
    if (
      old.state !== "value" &&
      next.state !== "value" &&
      old.state === next.state
    )
      continue;
    if (next.state !== "value")
      return {
        ok: false,
        message:
          "The changed spacing value cannot be safely verified. Review the Classes draft.",
      };
    for (const key of keys) {
      const value = measured[key];
      if (!value)
        return {
          ok: false,
          message:
            "Spacing measurement is unavailable. Reselect the element before applying.",
        };
      targets.push({ key, expectation: next.expectation, before: value });
    }
  }
  return { ok: true, targets };
}

function gapApplies(
  observed: PreviewSpacing,
  key: "rowGap" | "columnGap",
): boolean {
  const display = observed.display ?? "";
  if (display === "grid" || display === "inline-grid") return true;
  if (display !== "flex" && display !== "inline-flex") return false;
  const direction = observed.flexDirection;
  const wrap = observed.flexWrap;
  if (!direction || !wrap) return false;
  const wrapped = wrap === "wrap" || wrap === "wrap-reverse";
  const horizontal = direction === "row" || direction === "row-reverse";
  return key === "columnGap" ? horizontal || wrapped : !horizontal || wrapped;
}

export function observesSpacing(
  observed: PreviewSpacing,
  targets: SpacingTarget[],
): boolean {
  return targets.every(({ key, expectation, before }) => {
    if ((key === "rowGap" || key === "columnGap") && !gapApplies(observed, key))
      return false;
    const actual = observed[key];
    if (!actual || actual === before) return false;
    if (expectation.kind === "project") return true;
    const px = /^(-?\d+(?:\.\d+)?)px$/.exec(actual);
    return Boolean(
      px?.[1] && Math.abs(Number(px[1]) - expectation.value) < 0.02,
    );
  });
}
