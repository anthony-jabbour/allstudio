import {
  type EditBreakpoint,
  isEditBreakpoint,
  scopedUtility,
  scopeUtilities,
  topLevelSeparator,
} from "./class-tokens.ts";
import {
  type ColorExpectation,
  normalizeHex,
  parseColorUtility,
} from "./color-tokens.ts";

/**
 * Static Base background-colour and uniform-radius utilities. Real source
 * writes remain in SourceEditWorkspace; this module only rewrites one class
 * string and never reads files, the DOM or computed styles.
 */
export const APPEARANCE_PROPERTIES = [
  "backgroundColor",
  "borderRadius",
] as const;
export type AppearanceProperty = (typeof APPEARANCE_PROPERTIES)[number];
export type AppearanceExpectation =
  | ColorExpectation
  | { kind: "literal"; value: number };
export type AppearanceSetting =
  | {
      state: "value";
      utility: string;
      value: string;
      expectation: AppearanceExpectation;
    }
  | { state: "unset" }
  | { state: "unsupported" | "ambiguous"; message: string };
export type AppearanceSettings = Record<AppearanceProperty, AppearanceSetting>;
export type AppearanceUpdate =
  | { ok: true; className: string }
  | { ok: false; message: string };

/** Project-neutral colour presets; every other colour is a custom hex. */
export const BACKGROUND_PRESETS = ["bg-black", "bg-white", "bg-transparent"];
export const RADIUS_PRESETS = [
  "rounded-none",
  "rounded-xs",
  "rounded-sm",
  "rounded",
  "rounded-md",
  "rounded-lg",
  "rounded-xl",
  "rounded-2xl",
  "rounded-3xl",
  "rounded-4xl",
  "rounded-full",
];
export const MAX_RADIUS_PX = 2048;
const MAX_CLASS_LENGTH = 2000;

interface Match {
  property: AppearanceProperty;
  value: string;
  expectation: AppearanceExpectation;
  suffix?: string;
}
interface Token {
  raw: string;
  start: number;
  end: number;
  matches: Match[];
  unsupported: AppearanceProperty[];
}

/**
 * Background utilities that are not a colour: images, gradients, sizing,
 * position, repeat, attachment, clip, origin and blend. They are preserved
 * and neither read nor rewritten by the colour control.
 */
const BACKGROUND_NON_COLOR = new RegExp(
  [
    "^bg-(?:auto|cover|contain|none|fixed|local|scroll)$",
    "^bg-(?:center|top|bottom|left|right)(?:-(?:top|bottom|left|right))?$",
    "^bg-(?:repeat(?:-(?:x|y|round|space))?|no-repeat)$",
    "^bg-(?:clip|origin)-[a-z-]+$",
    "^bg-blend-[a-z-]+$",
    "^bg-(?:linear|radial|conic)(?:-.*)?$",
    "^bg-gradient-to-(?:t|tr|r|br|b|bl|l|tl)$",
    "^bg-(?:size|position)-.+$",
    "^bg-\\[(?:url|image-set|(?:repeating-)?(?:linear|radial|conic)-gradient)\\(",
    "^bg-\\[(?:url|image|length|position|size|percentage|bg-size|bg-position|angle):",
    "^bg-\\((?:url|image|length|position|size|percentage|bg-size|bg-position|angle):",
  ].join("|"),
  "i",
);
const RADIUS_PRESET_PATTERN =
  /^rounded(?:-(?:none|xs|sm|md|lg|xl|2xl|3xl|4xl|full))?$/;
const RADIUS_PX_PATTERN = /^rounded-\[(\d+(?:\.\d+)?)px\]$/;

function radius(
  utility: string,
): { value: string; expectation: AppearanceExpectation } | null {
  if (RADIUS_PRESET_PATTERN.test(utility))
    return {
      value: utility,
      expectation:
        utility === "rounded-none"
          ? { kind: "literal", value: 0 }
          : { kind: "project" },
    };
  const literal = RADIUS_PX_PATTERN.exec(utility);
  if (!literal?.[1] || (literal[1].split(".")[1]?.length ?? 0) > 3) return null;
  const amount = Number(literal[1]);
  if (!Number.isFinite(amount) || amount > MAX_RADIUS_PX) return null;
  return {
    value: `rounded-[${amount}px]`,
    expectation: { kind: "literal", value: amount },
  };
}

function token(
  raw: string,
  start: number,
  scope: EditBreakpoint = "base",
): Token {
  const result: Token = {
    raw,
    start,
    end: start + raw.length,
    matches: [],
    unsupported: [],
  };
  const selected = scopedUtility(raw, scope);
  if (selected === null) return result;
  const important = selected.startsWith("!") || selected.endsWith("!");
  const utility = selected.replace(/^!|!$/g, "");
  const slash = topLevelSeparator(utility, "/");
  const body = slash < 0 ? utility : utility.slice(0, slash);
  const suffix = slash < 0 ? undefined : utility.slice(slash + 1);
  if (/^\[background(?:-color)?:/i.test(utility))
    result.unsupported.push("backgroundColor");
  else if (/^\[border(?:-[a-z]+)*-radius:/i.test(utility))
    result.unsupported.push("borderRadius");
  else if (utility.startsWith("bg-")) {
    if (!BACKGROUND_NON_COLOR.test(body)) {
      const color = parseColorUtility("bg", body, suffix);
      if (color)
        result.matches.push({
          property: "backgroundColor",
          ...color,
          suffix,
        });
      else result.unsupported.push("backgroundColor");
    }
  } else if (utility.startsWith("rounded")) {
    const corners = suffix === undefined ? radius(body) : null;
    if (corners) result.matches.push({ property: "borderRadius", ...corners });
    else result.unsupported.push("borderRadius");
  }
  if (important)
    result.unsupported.push(...result.matches.map((match) => match.property));
  return result;
}

function tokens(className: string, scope: EditBreakpoint = "base"): Token[] {
  return [...className.matchAll(/\S+/g)].map((match) =>
    token(match[0], match.index, scope),
  );
}

export function inspectAppearanceClasses(
  className: string,
  scope: EditBreakpoint = "base",
): AppearanceSettings {
  const parsed =
    className.length <= MAX_CLASS_LENGTH ? tokens(className, scope) : [];
  return Object.fromEntries(
    APPEARANCE_PROPERTIES.map((property) => {
      const matches = parsed.flatMap((item) =>
        item.matches
          .filter((match) => match.property === property)
          .map((match) => ({ ...match, utility: item.raw })),
      );
      let setting: AppearanceSetting = { state: "unset" };
      if (
        className.length > MAX_CLASS_LENGTH ||
        parsed.some((item) => item.unsupported.includes(property))
      )
        setting = {
          state: "unsupported",
          message:
            "This property uses an unsupported, custom or important source utility. Other classes were preserved.",
        };
      else if (new Set(matches.map((match) => match.value)).size > 1)
        setting = {
          state: "ambiguous",
          message: `Conflicting ${scope} utilities make this property ambiguous. Resolve them in Classes first.`,
        };
      else if (matches[0])
        setting = {
          state: "value",
          utility: matches[0].utility,
          value: matches[0].value,
          expectation: matches[0].expectation,
        };
      return [property, setting];
    }),
  ) as AppearanceSettings;
}

export function setAppearanceClass(
  className: string,
  property: AppearanceProperty,
  utility: string,
  scope: EditBreakpoint = "base",
): AppearanceUpdate {
  const refused = (message: string): AppearanceUpdate => ({
    ok: false,
    message,
  });
  if (
    !isEditBreakpoint(scope) ||
    !(APPEARANCE_PROPERTIES as readonly string[]).includes(property)
  )
    return refused("Unknown appearance property.");
  if (className.length > MAX_CLASS_LENGTH)
    return refused("The class value exceeds the supported edit size.");
  const current = inspectAppearanceClasses(className, scope)[property];
  if (current.state === "ambiguous" || current.state === "unsupported")
    return refused(current.message);
  const target = token(utility, 0);
  const match = target.matches.find((item) => item.property === property);
  if (
    !/^\S+$/.test(utility) ||
    target.unsupported.length ||
    target.matches.length !== 1 ||
    !match ||
    match.suffix !== undefined
  )
    return refused("Choose a supported static value for this property.");
  if (current.state === "value" && current.value === match.value)
    return { ok: true, className };
  const edits: Array<{ start: number; end: number; value: string }> = [];
  for (const item of tokens(className, scope)) {
    const source = item.matches.find(
      (candidate) => candidate.property === property,
    );
    if (!source) continue;
    let replacement = match.value;
    if (property === "backgroundColor") {
      const oldHex = /^bg-\[(#[a-f\d]+)\]/i.exec(
        scopedUtility(item.raw, scope) ?? "",
      );
      const newHex = /^bg-\[(#[a-f\d]+)\]$/i.exec(match.value);
      const oldRgb = oldHex?.[1] ? normalizeHex(oldHex[1]) : null;
      const newRgb = newHex?.[1] ? normalizeHex(newHex[1]) : null;
      if (oldRgb?.length === 9) {
        if (!newRgb)
          return refused(
            "This colour's alpha cannot be preserved with that preset.",
          );
        if (newRgb.length === 7)
          replacement = `bg-[${newRgb}${oldRgb.slice(7)}]`;
      }
      if (source.suffix !== undefined) replacement += `/${source.suffix}`;
      const next = token(replacement, 0).matches.find(
        (candidate) => candidate.property === property,
      );
      if (next?.value === source.value) replacement = item.raw;
    }
    edits.push({
      start: item.start,
      end: item.end,
      value:
        replacement === item.raw
          ? item.raw
          : scopeUtilities(replacement, scope),
    });
  }
  let result = className;
  for (const edit of edits.slice().reverse())
    result = result.slice(0, edit.start) + edit.value + result.slice(edit.end);
  if (!edits.length)
    result =
      className +
      (className && !/\s$/.test(className) ? " " : "") +
      scopeUtilities(match.value, scope);
  return result.length <= MAX_CLASS_LENGTH
    ? { ok: true, className: result }
    : refused("The resulting class value exceeds the supported edit size.");
}

export function clearAppearanceClass(
  className: string,
  property: AppearanceProperty,
  scope: EditBreakpoint,
): AppearanceUpdate {
  if (
    !isEditBreakpoint(scope) ||
    scope === "base" ||
    !(APPEARANCE_PROPERTIES as readonly string[]).includes(property)
  )
    return {
      ok: false,
      message: "Choose a supported responsive property to clear.",
    };
  const current = inspectAppearanceClasses(className, scope)[property];
  if (current.state === "unsupported" || current.state === "ambiguous")
    return { ok: false, message: current.message };
  let result = className;
  for (const item of tokens(className, scope).reverse()) {
    if (item.matches.some((match) => match.property === property))
      result = result.slice(0, item.start) + result.slice(item.end);
  }
  return { ok: true, className: result };
}
