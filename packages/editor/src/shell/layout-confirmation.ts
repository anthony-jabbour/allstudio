import type { PreviewLayout } from "../preview-bridge/protocol.ts";
import {
  inspectLayoutClasses,
  LAYOUT_PROPERTIES,
  type LayoutExpectation,
  type LayoutProperty,
} from "../site/layout.ts";

export const LAYOUT_MEASURED_KEYS: Record<LayoutProperty, keyof PreviewLayout> =
  {
    display: "display",
    flexDirection: "flexDirection",
    justifyContent: "justifyContent",
    alignItems: "alignItems",
    gridColumns: "gridTemplateColumns",
    gridRows: "gridTemplateRows",
    width: "width",
    height: "height",
  };

export interface LayoutTarget {
  property: LayoutProperty;
  key: keyof PreviewLayout;
  expectation: LayoutExpectation;
  before: string;
}

export function layoutTargets(
  before: string,
  after: string,
  observed: PreviewLayout,
): { ok: true; targets: LayoutTarget[] } | { ok: false; message: string } {
  const previous = inspectLayoutClasses(before);
  const next = inspectLayoutClasses(after);
  const targets: LayoutTarget[] = [];
  for (const property of LAYOUT_PROPERTIES) {
    const old = previous[property];
    const setting = next[property];
    const oldValue = old.state === "value" ? old.value : old.state;
    const newValue = setting.state === "value" ? setting.value : setting.state;
    if (oldValue === newValue) continue;
    if (setting.state !== "value")
      return {
        ok: false,
        message:
          "This layout change cannot be verified safely. Review it in Classes.",
      };
    const measuredKey = LAYOUT_MEASURED_KEYS[property];
    const baseline = observed[measuredKey];
    if (!baseline)
      return {
        ok: false,
        message:
          "The selected property's rendered value is unavailable. Reselect before applying layout.",
      };
    targets.push({
      property,
      key: measuredKey,
      expectation: setting.expectation,
      before: baseline,
    });
  }
  return { ok: true, targets };
}

const SINGLE_PX = /^(\d+(?:\.\d+)?)px$/;

function layoutApplies(
  observed: PreviewLayout,
  property: LayoutProperty,
): boolean {
  const display = observed.display ?? "";
  if (property === "flexDirection")
    return display === "flex" || display === "inline-flex";
  if (property === "justifyContent" || property === "alignItems")
    return (
      display === "flex" ||
      display === "inline-flex" ||
      display === "grid" ||
      display === "inline-grid"
    );
  if (property === "gridColumns" || property === "gridRows")
    return display === "grid" || display === "inline-grid";
  if (property === "width" || property === "height")
    return Boolean(
      display &&
        display !== "inline" &&
        display !== "contents" &&
        display !== "none",
    );
  return true;
}

export function observesLayout(
  observed: PreviewLayout,
  targets: LayoutTarget[],
): boolean {
  return targets.every(({ property, key, expectation, before }) => {
    const actual = observed[key];
    if (!actual || actual === before || !layoutApplies(observed, property))
      return false;
    if (expectation.kind === "literal") return actual === expectation.value;
    if (expectation.kind === "tracks") {
      const parts = actual.trim().split(/\s+/);
      return (
        parts.length === expectation.value &&
        parts.every((part) => {
          const px = SINGLE_PX.exec(part);
          return Boolean(px?.[1] && Number(px[1]) > 0);
        })
      );
    }
    if (expectation.kind === "px") {
      const px = SINGLE_PX.exec(actual);
      return Boolean(
        px?.[1] && Math.abs(Number(px[1]) - expectation.value) < 0.02,
      );
    }
    return SINGLE_PX.test(actual);
  });
}
