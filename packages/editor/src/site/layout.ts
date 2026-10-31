import {
  type EditBreakpoint,
  isEditBreakpoint,
  scopedUtility,
  scopeUtilities,
  topLevelSeparator,
} from "./class-tokens.ts";

/**
 * Static Base layout utilities. Real source writes remain in
 * SourceEditWorkspace; this module only inspects or rewrites one class string
 * and never reads files, the DOM or computed styles.
 */
export const LAYOUT_PROPERTIES = [
  "display",
  "flexDirection",
  "justifyContent",
  "alignItems",
  "gridColumns",
  "gridRows",
  "width",
  "height",
] as const;
export type LayoutProperty = (typeof LAYOUT_PROPERTIES)[number];
export type LayoutExpectation =
  | { kind: "literal"; value: string }
  | { kind: "px"; value: number }
  | { kind: "tracks"; value: number }
  | { kind: "project" };
export type LayoutSetting =
  | {
      state: "value";
      utility: string;
      value: string;
      expectation: LayoutExpectation;
    }
  | { state: "unset" }
  | { state: "unsupported" | "ambiguous"; message: string };
export type LayoutSettings = Record<LayoutProperty, LayoutSetting>;
export type LayoutUpdate =
  | { ok: true; className: string }
  | { ok: false; message: string };
export interface LayoutConstraints {
  width: string[];
  height: string[];
}

export const DISPLAY_PRESETS = [
  "block",
  "flex",
  "inline-flex",
  "grid",
  "inline-grid",
] as const;
export const FLEX_DIRECTION_PRESETS = [
  "flex-row",
  "flex-col",
  "flex-row-reverse",
  "flex-col-reverse",
] as const;
export const JUSTIFY_CONTENT_PRESETS = [
  "justify-start",
  "justify-end",
  "justify-center",
  "justify-between",
  "justify-around",
  "justify-evenly",
] as const;
export const ALIGN_ITEMS_PRESETS = [
  "items-start",
  "items-end",
  "items-center",
  "items-stretch",
  "items-baseline",
] as const;
export const GRID_COLUMNS_PRESETS = [
  "grid-cols-1",
  "grid-cols-2",
  "grid-cols-3",
  "grid-cols-4",
  "grid-cols-5",
  "grid-cols-6",
  "grid-cols-7",
  "grid-cols-8",
  "grid-cols-9",
  "grid-cols-10",
  "grid-cols-11",
  "grid-cols-12",
] as const;
export const GRID_ROWS_PRESETS = [
  "grid-rows-1",
  "grid-rows-2",
  "grid-rows-3",
  "grid-rows-4",
  "grid-rows-5",
  "grid-rows-6",
  "grid-rows-7",
  "grid-rows-8",
  "grid-rows-9",
  "grid-rows-10",
  "grid-rows-11",
  "grid-rows-12",
] as const;
export const SIZE_KEYWORD_PRESETS = [
  "auto",
  "full",
  "fit",
  "min",
  "max",
] as const;
export const SIZE_FRACTION_PRESETS = [
  "1/2",
  "1/3",
  "2/3",
  "1/4",
  "2/4",
  "3/4",
  "1/5",
  "2/5",
  "3/5",
  "4/5",
  "1/6",
  "2/6",
  "3/6",
  "4/6",
  "5/6",
  "1/12",
  "2/12",
  "3/12",
  "4/12",
  "5/12",
  "6/12",
  "7/12",
  "8/12",
  "9/12",
  "10/12",
  "11/12",
] as const;
export const SIZE_SCALE_PRESETS = [
  "px",
  "0.5",
  "1",
  "1.5",
  "2",
  "2.5",
  "3",
  "3.5",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "14",
  "16",
  "20",
  "24",
  "28",
  "32",
  "36",
  "40",
  "44",
  "48",
  "52",
  "56",
  "60",
  "64",
  "72",
  "80",
  "96",
] as const;
const SIZE_PRESET_SUFFIXES = [
  ...SIZE_KEYWORD_PRESETS,
  ...SIZE_FRACTION_PRESETS,
  ...SIZE_SCALE_PRESETS,
] as const;
export const WIDTH_PRESETS: readonly string[] = SIZE_PRESET_SUFFIXES.map(
  (suffix) => `w-${suffix}`,
);
export const HEIGHT_PRESETS: readonly string[] = SIZE_PRESET_SUFFIXES.map(
  (suffix) => `h-${suffix}`,
);
export const LAYOUT_PRESETS: Record<LayoutProperty, readonly string[]> = {
  display: DISPLAY_PRESETS,
  flexDirection: FLEX_DIRECTION_PRESETS,
  justifyContent: JUSTIFY_CONTENT_PRESETS,
  alignItems: ALIGN_ITEMS_PRESETS,
  gridColumns: GRID_COLUMNS_PRESETS,
  gridRows: GRID_ROWS_PRESETS,
  width: WIDTH_PRESETS,
  height: HEIGHT_PRESETS,
};
export const MIN_SIZE_PX = 1;
export const MAX_SIZE_PX = 4096;
const MAX_CLASS_LENGTH = 2000;

interface Match {
  property: LayoutProperty;
  value: string;
  expectation: LayoutExpectation;
  coupledWidth?: string;
  coupledHeight?: string;
}
interface Token {
  raw: string;
  start: number;
  end: number;
  matches: Match[];
  unsupported: LayoutProperty[];
  isSizeShorthand?: boolean;
}

const UNSUPPORTED_DISPLAY = new Set([
  "inline",
  "inline-block",
  "flow-root",
  "contents",
  "list-item",
  "hidden",
  "table",
  "inline-table",
  "table-caption",
  "table-cell",
  "table-column",
  "table-column-group",
  "table-footer-group",
  "table-header-group",
  "table-row-group",
  "table-row",
]);

const FLEX_DIRECTION_MAP: Record<string, string> = {
  "flex-row": "row",
  "flex-col": "column",
  "flex-row-reverse": "row-reverse",
  "flex-col-reverse": "column-reverse",
};

const JUSTIFY_CONTENT_MAP: Record<string, string> = {
  "justify-start": "flex-start",
  "justify-end": "flex-end",
  "justify-center": "center",
  "justify-between": "space-between",
  "justify-around": "space-around",
  "justify-evenly": "space-evenly",
};

const ALIGN_ITEMS_MAP: Record<string, string> = {
  "items-start": "flex-start",
  "items-end": "flex-end",
  "items-center": "center",
  "items-stretch": "stretch",
  "items-baseline": "baseline",
};

const SIZE_PRESET_SET = new Set<string>(SIZE_PRESET_SUFFIXES);
const SIZE_PX_PATTERN = /^\[(\d+(?:\.\d{1,3})?)px\]$/;

function parseSizeSuffix(
  suffix: string,
): { suffix: string; expectation: LayoutExpectation } | null {
  if (SIZE_PRESET_SET.has(suffix))
    return {
      suffix,
      expectation:
        suffix === "px" ? { kind: "px", value: 1 } : { kind: "project" },
    };
  const literal = SIZE_PX_PATTERN.exec(suffix);
  if (!literal?.[1]) return null;
  const amount = Number(literal[1]);
  if (!Number.isFinite(amount) || amount < MIN_SIZE_PX || amount > MAX_SIZE_PX)
    return null;
  return {
    suffix: `[${amount}px]`,
    expectation: { kind: "px", value: amount },
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
  if ((DISPLAY_PRESETS as readonly string[]).includes(utility)) {
    result.matches.push({
      property: "display",
      value: utility,
      expectation: { kind: "literal", value: utility },
    });
  } else if (UNSUPPORTED_DISPLAY.has(utility) || /^\[display:/i.test(utility)) {
    result.unsupported.push("display");
  } else if (FLEX_DIRECTION_MAP[utility]) {
    result.matches.push({
      property: "flexDirection",
      value: utility,
      expectation: { kind: "literal", value: FLEX_DIRECTION_MAP[utility] },
    });
  } else if (
    /^-?flex-(?:row|col)(?:$|[-/])/.test(utility) ||
    /^\[flex-(?:direction|flow):/i.test(utility)
  ) {
    result.unsupported.push("flexDirection");
  } else if (JUSTIFY_CONTENT_MAP[utility]) {
    result.matches.push({
      property: "justifyContent",
      value: utility,
      expectation: { kind: "literal", value: JUSTIFY_CONTENT_MAP[utility] },
    });
  } else if (
    !/^-?justify-(?:items|self)(?:$|[-/])/.test(utility) &&
    (/^-?justify-/.test(utility) ||
      /^-?place-content-/.test(utility) ||
      /^\[(?:justify|place)-content:/i.test(utility))
  ) {
    result.unsupported.push("justifyContent");
  } else if (ALIGN_ITEMS_MAP[utility]) {
    result.matches.push({
      property: "alignItems",
      value: utility,
      expectation: { kind: "literal", value: ALIGN_ITEMS_MAP[utility] },
    });
  } else if (
    /^-?items-/.test(utility) ||
    /^-?place-items-/.test(utility) ||
    /^\[(?:align|place)-items:/i.test(utility)
  ) {
    result.unsupported.push("alignItems");
  } else if ((GRID_COLUMNS_PRESETS as readonly string[]).includes(utility)) {
    result.matches.push({
      property: "gridColumns",
      value: utility,
      expectation: { kind: "tracks", value: Number(utility.slice(10)) },
    });
  } else if ((GRID_ROWS_PRESETS as readonly string[]).includes(utility)) {
    result.matches.push({
      property: "gridRows",
      value: utility,
      expectation: { kind: "tracks", value: Number(utility.slice(10)) },
    });
  } else if (/^\[(?:grid-template|grid):/i.test(utility)) {
    result.unsupported.push("gridColumns", "gridRows");
  } else if (
    /^-?grid-cols-/.test(utility) ||
    /^\[grid-template-columns:/i.test(utility)
  ) {
    result.unsupported.push("gridColumns");
  } else if (
    /^-?grid-rows-/.test(utility) ||
    /^\[grid-template-rows:/i.test(utility)
  ) {
    result.unsupported.push("gridRows");
  } else if (utility.startsWith("w-")) {
    const parsed = parseSizeSuffix(utility.slice(2));
    if (parsed)
      result.matches.push({
        property: "width",
        value: `w-${parsed.suffix}`,
        expectation: parsed.expectation,
      });
    else result.unsupported.push("width");
  } else if (utility.startsWith("h-")) {
    const parsed = parseSizeSuffix(utility.slice(2));
    if (parsed)
      result.matches.push({
        property: "height",
        value: `h-${parsed.suffix}`,
        expectation: parsed.expectation,
      });
    else result.unsupported.push("height");
  } else if (utility.startsWith("size-")) {
    const parsed = parseSizeSuffix(utility.slice(5));
    if (parsed) {
      const widthValue = `w-${parsed.suffix}`;
      const heightValue = `h-${parsed.suffix}`;
      result.isSizeShorthand = true;
      result.matches.push(
        {
          property: "width",
          value: widthValue,
          expectation: parsed.expectation,
          coupledHeight: heightValue,
        },
        {
          property: "height",
          value: heightValue,
          expectation: parsed.expectation,
          coupledWidth: widthValue,
        },
      );
    } else result.unsupported.push("width", "height");
  } else if (
    /^-w-|^-?w\(/.test(utility) ||
    /^\[(?:width|inline-size):/i.test(utility) ||
    utility === "container"
  ) {
    result.unsupported.push("width");
  } else if (
    /^-h-|^-?h\(/.test(utility) ||
    /^\[(?:height|block-size):/i.test(utility)
  ) {
    result.unsupported.push("height");
  } else if (
    /^-size-|^-?size\(/.test(utility) ||
    utility === "sr-only" ||
    utility === "not-sr-only"
  ) {
    result.unsupported.push("width", "height");
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

function stripVariants(raw: string): string {
  let current = raw;
  while (true) {
    const colon = topLevelSeparator(current, ":");
    if (colon < 0) break;
    current = current.slice(colon + 1);
  }
  return current.replace(/^!|!$/g, "").replace(/^-/, "");
}

export function inspectLayoutConstraints(className: string): LayoutConstraints {
  const width: string[] = [];
  const height: string[] = [];
  for (const match of className.matchAll(/\S+/g)) {
    const raw = match[0];
    const utility = stripVariants(raw);
    if (
      /^(?:min|max)-w-.+/.test(utility) ||
      /^\[(?:min|max)-(?:width|inline-size):/i.test(utility)
    )
      width.push(raw);
    else if (
      /^(?:min|max)-h-.+/.test(utility) ||
      /^\[(?:min|max)-(?:height|block-size):/i.test(utility)
    )
      height.push(raw);
  }
  return { width, height };
}

export function inspectLayoutClasses(
  className: string,
  scope: EditBreakpoint = "base",
): LayoutSettings {
  const parsed =
    className.length <= MAX_CLASS_LENGTH ? tokens(className, scope) : [];
  const hasSizeShorthand = parsed.some((item) => item.isSizeShorthand);
  const sizeTokenCount = parsed.filter((item) =>
    item.matches.some(
      (match) => match.property === "width" || match.property === "height",
    ),
  ).length;
  const mixedSizeShorthand = hasSizeShorthand && sizeTokenCount > 1;
  return Object.fromEntries(
    LAYOUT_PROPERTIES.map((property) => {
      const matches = parsed.flatMap((item) =>
        item.matches
          .filter((match) => match.property === property)
          .map((match) => ({ ...match, utility: item.raw })),
      );
      let setting: LayoutSetting = { state: "unset" };
      if (
        className.length > MAX_CLASS_LENGTH ||
        parsed.some((item) => item.unsupported.includes(property))
      )
        setting = {
          state: "unsupported",
          message:
            "This property uses an unsupported, custom or important source utility. Other classes were preserved.",
        };
      else if (
        new Set(matches.map((match) => match.value)).size > 1 ||
        ((property === "width" || property === "height") && mixedSizeShorthand)
      )
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
  ) as LayoutSettings;
}

export function setLayoutClass(
  className: string,
  property: LayoutProperty,
  utility: string,
  scope: EditBreakpoint = "base",
): LayoutUpdate {
  const refused = (message: string): LayoutUpdate => ({
    ok: false,
    message,
  });
  if (
    !isEditBreakpoint(scope) ||
    !(LAYOUT_PROPERTIES as readonly string[]).includes(property)
  )
    return refused("Unknown layout property.");
  if (className.length > MAX_CLASS_LENGTH)
    return refused("The class value exceeds the supported edit size.");
  const current = inspectLayoutClasses(className, scope)[property];
  if (current.state === "ambiguous" || current.state === "unsupported")
    return refused(current.message);
  const target = token(utility, 0);
  const match = target.matches.find((item) => item.property === property);
  if (
    !/^\S+$/.test(utility) ||
    target.unsupported.length ||
    target.matches.length !== 1 ||
    !match
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
    if (property === "width" && source.coupledHeight)
      replacement = `${match.value} ${source.coupledHeight}`;
    else if (property === "height" && source.coupledWidth)
      replacement = `${source.coupledWidth} ${match.value}`;
    edits.push({
      start: item.start,
      end: item.end,
      value: scopeUtilities(replacement, scope),
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

export function clearLayoutClass(
  className: string,
  property: LayoutProperty,
  scope: EditBreakpoint,
): LayoutUpdate {
  if (
    !isEditBreakpoint(scope) ||
    scope === "base" ||
    !(LAYOUT_PROPERTIES as readonly string[]).includes(property)
  )
    return {
      ok: false,
      message: "Choose a supported responsive property to clear.",
    };
  const current = inspectLayoutClasses(className, scope)[property];
  if (current.state === "unsupported" || current.state === "ambiguous")
    return { ok: false, message: current.message };
  let result = className;
  for (const item of tokens(className, scope).reverse()) {
    const source = item.matches.find((match) => match.property === property);
    if (!source) continue;
    const companion =
      property === "width" && source.coupledHeight
        ? source.coupledHeight
        : property === "height" && source.coupledWidth
          ? source.coupledWidth
          : "";
    result =
      result.slice(0, item.start) +
      scopeUtilities(companion, scope) +
      result.slice(item.end);
  }
  return { ok: true, className: result };
}
