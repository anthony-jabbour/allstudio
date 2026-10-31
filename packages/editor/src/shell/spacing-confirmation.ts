import type { PreviewSpacing } from "../preview-bridge/protocol.ts";
import type { EditBreakpoint } from "../site/class-tokens.ts";
import {
  inspectSpacingClasses,
  type SpacingExpectation,
  type SpacingProperty,
} from "../site/spacing.ts";

export interface SpacingTarget {
  key: keyof PreviewSpacing;
  expectation: SpacingExpectation | { kind: "removed" };
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
  scope: EditBreakpoint = "base",
): { ok: true; targets: SpacingTarget[] } | { ok: false; message: string } {
  const before = inspectSpacingClasses(beforeClass, scope),
    after = inspectSpacingClasses(afterClass, scope);
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
    if (
      next.state !== "value" &&
      !(scope !== "base" && next.state === "unset" && old.state === "value")
    )
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
      targets.push({
        key,
        expectation:
          next.state === "value" ? next.expectation : { kind: "removed" },
        before: value,
      });
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
  const row = direction === "row" || direction === "row-reverse";
  const column = direction === "column" || direction === "column-reverse";
  const wrapped = wrap === "wrap" || wrap === "wrap-reverse";
  if ((!row && !column) || (wrap !== "nowrap" && !wrapped)) return false;
  return key === "columnGap" ? row || wrapped : column || wrapped;
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
    if (expectation.kind === "removed" || expectation.kind === "project")
      return true;
    const px = /^(-?\d+(?:\.\d+)?)px$/.exec(actual);
    return Boolean(
      px?.[1] && Math.abs(Number(px[1]) - expectation.value) < 0.02,
    );
  });
}
