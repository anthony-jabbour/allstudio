import type { PreviewAppearance } from "../preview-bridge/protocol.ts";
import {
  APPEARANCE_PROPERTIES,
  type AppearanceExpectation,
  type AppearanceProperty,
  inspectAppearanceClasses,
} from "../site/appearance.ts";
import type { EditBreakpoint } from "../site/class-tokens.ts";
import { srgb } from "./typography-confirmation.ts";

export interface AppearanceTarget {
  property: AppearanceProperty;
  expectation: AppearanceExpectation | { kind: "removed" };
  before: string;
}

export function appearanceTargets(
  before: string,
  after: string,
  observed: PreviewAppearance,
  scope: EditBreakpoint = "base",
): { ok: true; targets: AppearanceTarget[] } | { ok: false; message: string } {
  const previous = inspectAppearanceClasses(before, scope);
  const next = inspectAppearanceClasses(after, scope);
  const targets: AppearanceTarget[] = [];
  for (const property of APPEARANCE_PROPERTIES) {
    const old = previous[property];
    const setting = next[property];
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
          "This appearance change cannot be verified safely. Review it in Classes.",
      };
    const baseline = observed[property];
    if (!baseline)
      return {
        ok: false,
        message:
          "The selected property's rendered value is unavailable. Reselect before applying appearance.",
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

const SINGLE_PX = /^(\d+(?:\.\d+)?)px$/;

function uniformRadius(value: string): boolean {
  if (value.includes("/")) return false;
  const parts = value.trim().split(/\s+/);
  return (
    parts.length >= 1 &&
    parts.length <= 4 &&
    parts.every((part) => part === parts[0] && SINGLE_PX.test(part))
  );
}

export function observesAppearance(
  observed: PreviewAppearance,
  targets: AppearanceTarget[],
): boolean {
  return targets.every(({ property, expectation, before }) => {
    const actual = observed[property];
    if (!actual || actual === before) return false;
    if (property === "backgroundColor") {
      // An image or gradient can hide the colour; only "none" proves visibility.
      if (observed.backgroundImage !== "none") return false;
      if (expectation.kind === "removed" || expectation.kind === "project")
        return true;
      if (expectation.kind !== "color") return false;
      const target = srgb(expectation.value);
      const rendered = srgb(actual);
      return Boolean(
        target &&
          rendered &&
          target.every(
            (value, index) => Math.abs(value - (rendered[index] ?? -255)) <= 1,
          ),
      );
    }
    if (expectation.kind === "removed" || expectation.kind === "project") {
      // A preset still has to produce one radius; an overridden corner is unconfirmed.
      if (property === "borderRadius" && !uniformRadius(actual)) return false;
      return true;
    }
    if (expectation.kind !== "literal") return false;
    // A multi-value (per-corner) computed radius is never a uniform literal.
    const px = SINGLE_PX.exec(actual);
    return Boolean(
      px?.[1] && Math.abs(Number(px[1]) - expectation.value) < 0.02,
    );
  });
}
