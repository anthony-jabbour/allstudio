import { topLevelSeparator as separator } from "./class-tokens.ts";
import {
  normalizeHex as hex,
  parseColorUtility,
  positiveNumber as positive,
} from "./color-tokens.ts";

/** Static Base utilities only. Real source writes remain in SourceEditWorkspace. */
export const TYPOGRAPHY_PROPERTIES = [
  "fontSize",
  "fontWeight",
  "lineHeight",
  "textAlign",
  "color",
  "fontFamily",
] as const;
export type TypographyProperty = (typeof TYPOGRAPHY_PROPERTIES)[number];
export type TypographyExpectation =
  | { kind: "literal"; value: string }
  | { kind: "ratio"; value: number }
  | { kind: "color"; value: string }
  | { kind: "project" };
export type TypographySetting =
  | {
      state: "value";
      utility: string;
      value: string;
      expectation: TypographyExpectation;
    }
  | { state: "unset" }
  | { state: "unsupported" | "ambiguous"; message: string };
export type TypographySettings = Record<TypographyProperty, TypographySetting>;
export type TypographyUpdate =
  | { ok: true; className: string }
  | { ok: false; message: string };
const SIZES = [
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
];
const WEIGHTS = [
  "thin",
  "extralight",
  "light",
  "normal",
  "medium",
  "semibold",
  "bold",
  "extrabold",
  "black",
];
const LEADING = ["none", "tight", "snug", "normal", "relaxed", "loose"];
const ALIGNS = ["left", "center", "right", "justify", "start", "end"];
const FAMILIES = ["sans", "serif", "mono"];
export const TYPOGRAPHY_PRESETS: Record<TypographyProperty, string[]> = {
  fontSize: SIZES.map((value) => `text-${value}`),
  fontWeight: WEIGHTS.map((value) => `font-${value}`),
  lineHeight: LEADING.map((value) => `leading-${value}`),
  textAlign: ALIGNS.map((value) => `text-${value}`),
  color: [],
  fontFamily: FAMILIES.map((value) => `font-${value}`),
};
interface Match {
  property: TypographyProperty;
  value: string;
  expectation: TypographyExpectation;
  coupledSize?: string;
  suffix?: string;
}
interface Token {
  raw: string;
  start: number;
  end: number;
  matches: Match[];
  unsupported: TypographyProperty[];
}
const project: TypographyExpectation = { kind: "project" };
function size(
  value: string,
): { value: string; expectation: TypographyExpectation } | null {
  if (!value.startsWith("text-")) return null;
  const body = value.slice(5);
  if (SIZES.includes(body)) return { value, expectation: project };
  const literal = /^\[(\d+(?:\.\d+)?)px\]$/.exec(body);
  if (!literal?.[1] || !positive(literal[1]) || Number(literal[1]) <= 0)
    return null;
  return {
    value: `text-[${Number(literal[1])}px]`,
    expectation: { kind: "literal", value: `${Number(literal[1])}px` },
  };
}
function leading(
  value: string,
): { value: string; expectation: TypographyExpectation } | null {
  if (!value.startsWith("leading-")) return null;
  const body = value.slice(8);
  if (LEADING.includes(body) || positive(body))
    return { value, expectation: project };
  const literal = /^\[(\d+(?:\.\d+)?)(px)?\]$/.exec(body);
  if (!literal?.[1] || !positive(literal[1]) || Number(literal[1]) <= 0)
    return null;
  const number = Number(literal[1]);
  return {
    value: `leading-[${number}${literal[2] ?? ""}]`,
    expectation: literal[2]
      ? { kind: "literal", value: `${number}px` }
      : { kind: "ratio", value: number },
  };
}
function token(raw: string, start: number): Token {
  const result: Token = {
    raw,
    start,
    end: start + raw.length,
    matches: [],
    unsupported: [],
  };
  if (separator(raw, ":") >= 0) return result;
  const important = raw.startsWith("!") || raw.endsWith("!");
  const utility = raw.replace(/^!|!$/g, "");
  const slash = separator(utility, "/");
  const body = slash < 0 ? utility : utility.slice(0, slash),
    suffix = slash < 0 ? undefined : utility.slice(slash + 1);
  const fontSize = size(body);
  if (fontSize) {
    result.matches.push({ property: "fontSize", ...fontSize, suffix });
    if (suffix !== undefined) {
      const line = leading(`leading-${suffix}`);
      if (line)
        result.matches.push({
          property: "lineHeight",
          ...line,
          coupledSize: body,
        });
      else result.unsupported.push("fontSize", "lineHeight");
    }
  } else if (utility.startsWith("leading-")) {
    const line = leading(utility);
    if (line) result.matches.push({ property: "lineHeight", ...line });
    else result.unsupported.push("lineHeight");
  } else if (ALIGNS.some((value) => utility === `text-${value}`)) {
    result.matches.push({
      property: "textAlign",
      value: utility,
      expectation: { kind: "literal", value: utility.slice(5) },
    });
  } else if (FAMILIES.some((value) => utility === `font-${value}`)) {
    result.matches.push({
      property: "fontFamily",
      value: utility,
      expectation: project,
    });
  } else if (WEIGHTS.some((value) => utility === `font-${value}`)) {
    result.matches.push({
      property: "fontWeight",
      value: utility,
      expectation: project,
    });
  } else if (/^font-\[\d+(?:\.\d+)?\]$/.test(utility)) {
    const value = utility.slice(6, -1);
    if (positive(value) && Number(value) >= 1 && Number(value) <= 1000)
      result.matches.push({
        property: "fontWeight",
        value: `font-[${Number(value)}]`,
        expectation: { kind: "literal", value: String(Number(value)) },
      });
    else result.unsupported.push("fontWeight");
  } else {
    const textColor = parseColorUtility("text", body, suffix);
    if (textColor)
      result.matches.push({ property: "color", ...textColor, suffix });
    else if (parseColorUtility("text", body)) result.unsupported.push("color");
    else if (
      /^\[(font-size|font-weight|line-height|text-align|color|font-family|font):/i.test(
        utility,
      )
    ) {
      const name = utility.slice(1, utility.indexOf(":"));
      const properties: Record<string, TypographyProperty[]> = {
        "font-size": ["fontSize"],
        "font-weight": ["fontWeight"],
        "line-height": ["lineHeight"],
        "text-align": ["textAlign"],
        color: ["color"],
        "font-family": ["fontFamily"],
        font: ["fontSize", "fontWeight", "lineHeight", "fontFamily"],
      };
      result.unsupported.push(...(properties[name.toLowerCase()] ?? []));
    } else if (/^font-/.test(utility))
      result.unsupported.push("fontWeight", "fontFamily");
    else if (/^text-(?:\[length:|\(length:)/.test(utility))
      result.unsupported.push("fontSize");
    else if (/^text-(?:\[color:|\(color:)/.test(utility))
      result.unsupported.push("color");
    else if (
      /^text-/.test(utility) &&
      !/^text-(?:wrap|nowrap|balance|pretty|ellipsis|clip|shadow(?:-|$))/.test(
        utility,
      )
    )
      result.unsupported.push("fontSize", "color");
  }
  if (important)
    result.unsupported.push(...result.matches.map((match) => match.property));
  return result;
}
function tokens(className: string): Token[] {
  return [...className.matchAll(/\S+/g)].map((match) =>
    token(match[0], match.index),
  );
}
export function inspectTypographyClasses(
  className: string,
): TypographySettings {
  const parsed = className.length <= 2000 ? tokens(className) : [];
  return Object.fromEntries(
    TYPOGRAPHY_PROPERTIES.map((property) => {
      const matches = parsed.flatMap((item) =>
        item.matches
          .filter((match) => match.property === property)
          .map((match) => ({ ...match, utility: item.raw })),
      );
      let setting: TypographySetting = { state: "unset" };
      if (
        className.length > 2000 ||
        parsed.some((item) => item.unsupported.includes(property))
      )
        setting = {
          state: "unsupported",
          message:
            "This property uses an unsupported or important source utility. Other classes were preserved.",
        };
      else if (new Set(matches.map((match) => match.value)).size > 1)
        setting = {
          state: "ambiguous",
          message:
            "Conflicting base utilities make this property ambiguous. Resolve them in Classes first.",
        };
      else if (matches[0]) {
        const match = matches[0];
        setting = {
          state: "value",
          utility: match.utility,
          value: match.value,
          expectation: match.expectation,
        };
      }
      return [property, setting];
    }),
  ) as TypographySettings;
}
function validTarget(
  property: TypographyProperty,
  match: Match,
  utility: string,
): boolean {
  const literal = /\[(\d+(?:\.\d+)?)(px)?\]/.exec(utility);
  if ((literal?.[1]?.split(".")[1]?.length ?? 0) > 3) return false;
  if (match.expectation.kind === "ratio")
    return match.expectation.value >= 0.1 && match.expectation.value <= 10;
  if (match.expectation.kind === "literal" && property !== "textAlign") {
    const value = Number.parseFloat(match.expectation.value);
    const maximum =
      property === "fontSize" ? 512 : property === "fontWeight" ? 1000 : 1024;
    return value >= 1 && value <= maximum;
  }
  return true;
}
export function setTypographyClass(
  className: string,
  property: TypographyProperty,
  utility: string,
): TypographyUpdate {
  const refused = (message: string): TypographyUpdate => ({
    ok: false,
    message,
  });
  if (className.length > 2000)
    return refused("The class value exceeds the supported edit size.");
  const current = inspectTypographyClasses(className)[property];
  if (current.state === "ambiguous" || current.state === "unsupported")
    return refused(current.message);
  const target = token(utility, 0),
    match = target.matches.find((item) => item.property === property);
  if (
    !/^\S+$/.test(utility) ||
    target.unsupported.length ||
    target.matches.length !== 1 ||
    !match
  )
    return refused("Choose a supported static value for this property.");
  if (current.state === "value" && current.value === match.value)
    return { ok: true, className };
  if (separator(utility, "/") >= 0 || !validTarget(property, match, utility))
    return refused(
      "The value or unit is outside this property's supported range.",
    );
  const edits: Array<{ start: number; end: number; value: string }> = [];
  for (const item of tokens(className)) {
    const source = item.matches.find(
      (candidate) => candidate.property === property,
    );
    if (!source) continue;
    let replacement = match.value;
    if (property === "fontSize" && source.suffix !== undefined)
      replacement += `/${source.suffix}`;
    if (property === "lineHeight" && source.coupledSize)
      replacement = `${source.coupledSize} ${match.value}`;
    if (property === "color") {
      const oldHex = /^text-\[(#[a-f\d]+)\]/i.exec(item.raw),
        newHex = /^text-\[(#[a-f\d]+)\]$/i.exec(match.value);
      const oldRgb = oldHex?.[1] ? hex(oldHex[1]) : null,
        newRgb = newHex?.[1] ? hex(newHex[1]) : null;
      if (oldRgb?.length === 9) {
        if (!newRgb)
          return refused(
            "This colour's alpha cannot be preserved with that preset.",
          );
        if (newRgb.length === 7)
          replacement = `text-[${newRgb}${oldRgb.slice(7)}]`;
      }
      if (source.suffix !== undefined) replacement += `/${source.suffix}`;
      const next = token(replacement, 0).matches.find(
        (candidate) => candidate.property === property,
      );
      if (next?.value === source.value) replacement = item.raw;
    }
    edits.push({ start: item.start, end: item.end, value: replacement });
  }
  let result = className;
  for (const edit of edits.slice().reverse())
    result = result.slice(0, edit.start) + edit.value + result.slice(edit.end);
  if (!edits.length)
    result =
      className +
      (className && !/\s$/.test(className) ? " " : "") +
      match.value;
  return result.length <= 2000
    ? { ok: true, className: result }
    : refused("The resulting class value exceeds the supported edit size.");
}
