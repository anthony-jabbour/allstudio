import type { PreviewTypography } from "../preview-bridge/protocol.ts";
import type { EditBreakpoint } from "../site/class-tokens.ts";
import {
  inspectTypographyClasses,
  TYPOGRAPHY_PROPERTIES,
  type TypographyExpectation,
  type TypographyProperty,
} from "../site/typography.ts";

export interface TypographyTarget {
  property: TypographyProperty;
  expectation: TypographyExpectation | { kind: "removed" };
  before: string;
}
export function typographyTargets(
  before: string,
  after: string,
  observed: PreviewTypography,
  scope: EditBreakpoint = "base",
): { ok: true; targets: TypographyTarget[] } | { ok: false; message: string } {
  const previous = inspectTypographyClasses(before, scope),
    next = inspectTypographyClasses(after, scope);
  const targets: TypographyTarget[] = [];
  for (const property of TYPOGRAPHY_PROPERTIES) {
    const old = previous[property],
      setting = next[property];
    const oldValue = old.state === "value" ? old.value : old.state;
    const newValue = setting.state === "value" ? setting.value : setting.state;
    if (oldValue === newValue) continue;
    if (
      setting.state !== "value" &&
      !(scope !== "base" && setting.state === "unset" && old.state === "value")
    )
      return {
        ok: false,
        message:
          "This typography change cannot be verified safely. Review it in Classes.",
      };
    const baseline = observed[property];
    if (!baseline)
      return {
        ok: false,
        message:
          "The selected property's rendered value is unavailable. Reselect before applying typography.",
      };
    targets.push({
      property,
      expectation:
        setting.state === "value" ? setting.expectation : { kind: "removed" },
      before: baseline,
    });
  }
  return { ok: true, targets };
}
function pixels(value: string | null): number | null {
  return value && /^\d+(?:\.\d+)?px$/.test(value)
    ? Number.parseFloat(value)
    : null;
}
export function srgb(value: string): number[] | null {
  if (
    typeof document === "undefined" ||
    typeof CSS === "undefined" ||
    !CSS.supports("color", value) ||
    /var\(|^(?:currentcolor|inherit|initial|unset|revert)/i.test(value)
  )
    return null;
  const context = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  return [...context.getImageData(0, 0, 1, 1).data];
}
export function observesTypography(
  observed: PreviewTypography,
  targets: TypographyTarget[],
): boolean {
  return targets.every(({ property, expectation, before }) => {
    const actual = observed[property];
    if (!actual || actual === before) return false;
    if (expectation.kind === "removed" || expectation.kind === "project")
      return actual !== before;
    if (expectation.kind === "color") {
      const target = srgb(expectation.value),
        rendered = srgb(actual);
      return Boolean(
        target &&
          rendered &&
          target.every(
            (value, index) => Math.abs(value - (rendered[index] ?? -255)) <= 1,
          ),
      );
    }
    if (expectation.kind === "ratio") {
      const fontSize = pixels(observed.fontSize),
        height = pixels(actual);
      return (
        fontSize !== null &&
        height !== null &&
        Math.abs(fontSize * expectation.value - height) < 0.15
      );
    }
    if (property === "textAlign") return actual === expectation.value;
    const target =
      property === "fontWeight"
        ? Number(expectation.value)
        : pixels(expectation.value);
    const rendered =
      property === "fontWeight" ? Number(actual) : pixels(actual);
    return (
      target !== null &&
      rendered !== null &&
      Number.isFinite(target) &&
      Number.isFinite(rendered) &&
      Math.abs(target - rendered) < (property === "fontWeight" ? 0.001 : 0.02)
    );
  });
}
