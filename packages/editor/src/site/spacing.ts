import {
  type EditBreakpoint,
  isEditBreakpoint,
  scopedUtility,
  scopeUtilities,
} from "./class-tokens.ts";

export const SPACING_PROPERTIES = [
  "padding",
  "paddingInline",
  "paddingBlock",
  "margin",
  "marginInline",
  "marginBlock",
  "gap",
  "columnGap",
  "rowGap",
] as const;
export type SpacingProperty = (typeof SPACING_PROPERTIES)[number];
export const SPACING_SCALE = [
  "0",
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
export type SpacingExpectation =
  | { kind: "literal"; value: number }
  | { kind: "project" };
export type SpacingSetting =
  | {
      state: "value";
      utility: string;
      value: string;
      expectation: SpacingExpectation;
    }
  | { state: "unset" }
  | { state: "mixed" | "unsupported"; message: string };
export type SpacingSettings = Record<SpacingProperty, SpacingSetting>;
type Family = "padding" | "margin" | "gap";
type Axis = 0 | 1;
interface Value {
  key: string;
  suffix: string;
  negative: boolean;
  expectation: SpacingExpectation;
}
interface Entry {
  raw: string;
  start: number;
  end: number;
  family: Family;
  axis: Axis | "all";
  value: Value;
}
const GROUPS: Record<
  Family,
  readonly [SpacingProperty, SpacingProperty, SpacingProperty]
> = {
  padding: ["padding", "paddingInline", "paddingBlock"],
  margin: ["margin", "marginInline", "marginBlock"],
  gap: ["gap", "columnGap", "rowGap"],
};
const PREFIX: Record<SpacingProperty, string> = {
  padding: "p",
  paddingInline: "px",
  paddingBlock: "py",
  margin: "m",
  marginInline: "mx",
  marginBlock: "my",
  gap: "gap",
  columnGap: "gap-x",
  rowGap: "gap-y",
};
const familyOf = (property: SpacingProperty): Family =>
  property.startsWith("padding")
    ? "padding"
    : property.startsWith("margin")
      ? "margin"
      : "gap";
const axisOf = (property: SpacingProperty): Axis | "all" => {
  const index = GROUPS[familyOf(property)].indexOf(property);
  return index === 0 ? "all" : index === 1 ? 0 : 1;
};
const format = (property: SpacingProperty, value: Value) =>
  `${value.negative ? "-" : ""}${PREFIX[property]}-${value.suffix}`;
const equal = (a: Value, b: Value): boolean =>
  a.key === b.key ||
  (a.expectation.kind === "literal" &&
    b.expectation.kind === "literal" &&
    a.expectation.value === b.expectation.value);

function parseValue(
  suffix: string,
  negative: boolean,
  family: Family,
): Value | null {
  if (negative && family !== "margin") return null;
  if (suffix === "auto")
    return family === "margin" && !negative
      ? {
          key: "auto",
          suffix,
          negative: false,
          expectation: { kind: "project" },
        }
      : null;
  const px = /^\[(\d+(?:\.\d{1,3})?)px\]$/.exec(suffix);
  if (px?.[1]) {
    const amount = Number(px[1]);
    if (!Number.isFinite(amount) || amount > 2048) return null;
    const value = negative ? -amount : amount;
    return {
      key: `px:${value}`,
      suffix: `[${amount}px]`,
      negative: negative && amount !== 0,
      expectation: { kind: "literal", value },
    };
  }
  if (!(SPACING_SCALE as readonly string[]).includes(suffix)) return null;
  if (suffix === "0" || suffix === "px") {
    const value = (suffix === "0" ? 0 : 1) * (negative ? -1 : 1);
    return {
      key: `px:${value}`,
      suffix,
      negative: negative && value !== 0,
      expectation: { kind: "literal", value },
    };
  }
  return {
    key: `scale:${negative ? "-" : ""}${suffix}`,
    suffix,
    negative,
    expectation: { kind: "project" },
  };
}

function parse(className: string, scope: EditBreakpoint = "base") {
  const entries: Entry[] = [];
  const errors = new Map<Family, string>();
  for (const match of className.matchAll(/\S+/g)) {
    const raw = match[0];
    const selected = scopedUtility(raw, scope);
    if (selected === null) continue;
    const important = selected.startsWith("!") || selected.endsWith("!");
    const utility = selected.replace(/^!|!$/g, "");
    const part = /^(-?)(gap-x|gap-y|gap|px|py|p|mx|my|m)-(.+)$/.exec(utility);
    if (part?.[2] && part[3]) {
      const prefix = part[2],
        family: Family = prefix.startsWith("p")
          ? "padding"
          : prefix.startsWith("m")
            ? "margin"
            : "gap";
      const value = parseValue(part[3], part[1] === "-", family);
      if (!value || important) {
        errors.set(
          family,
          "This spacing utility is important, custom or unsupported.",
        );
        continue;
      }
      const axis: Axis | "all" = ["p", "m", "gap"].includes(prefix)
        ? "all"
        : ["px", "mx", "gap-x"].includes(prefix)
          ? 0
          : 1;
      entries.push({
        raw,
        start: match.index,
        end: match.index + raw.length,
        family,
        axis,
        value,
      });
      continue;
    }
    const physical = /^-?([pm])(?:[trblse]|[trblse]{2})-/.exec(utility);
    if (physical?.[1])
      errors.set(
        physical[1] === "p" ? "padding" : "margin",
        "Directional spacing cannot be safely combined with these logical-axis controls.",
      );
    const arbitrary =
      /^\[(padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|gap|row-gap|column-gap):/i.exec(
        utility,
      );
    if (arbitrary?.[1])
      errors.set(
        arbitrary[1].startsWith("padding")
          ? "padding"
          : arbitrary[1].startsWith("margin")
            ? "margin"
            : "gap",
        "An arbitrary CSS spacing property overrides this group.",
      );
    // Tailwind's parenthesized variable shorthand has no '-' before '('.
    const variable = /^([pm]|[pm][xy]|gap(?:-[xy])?)-?\(/.exec(utility);
    if (variable?.[1])
      errors.set(
        variable[1].startsWith("p")
          ? "padding"
          : variable[1].startsWith("m")
            ? "margin"
            : "gap",
        "Variable spacing is unsupported.",
      );
  }
  if (className.length > 2000)
    for (const family of Object.keys(GROUPS) as Family[])
      errors.set(family, "The class value exceeds the supported edit size.");
  for (const family of Object.keys(GROUPS) as Family[]) {
    const group = entries.filter((item) => item.family === family);
    for (const axis of [0, 1] as const) {
      const matches = group.filter(
        (item) => item.axis === "all" || item.axis === axis,
      );
      if (
        matches.some((item) =>
          matches.some(
            (other) =>
              !equal(item.value, other.value) || item.axis !== other.axis,
          ),
        )
      )
        errors.set(
          family,
          "Overlapping or conflicting spacing utilities require manual source review.",
        );
    }
  }
  return { entries, errors };
}

export function inspectSpacingClasses(
  className: string,
  scope: EditBreakpoint = "base",
): SpacingSettings {
  const { entries, errors } = parse(className, scope);
  const result = {} as SpacingSettings;
  for (const property of SPACING_PROPERTIES) {
    const family = familyOf(property),
      axis = axisOf(property),
      error = errors.get(family);
    if (error) {
      result[property] = { state: "unsupported", message: error };
      continue;
    }
    const group = entries.filter((item) => item.family === family);
    const axes = [0, 1].map((direction) =>
      group.find((item) => item.axis === "all" || item.axis === direction),
    );
    const relevant = group.filter(
      (item) => axis === "all" || item.axis === "all" || item.axis === axis,
    );
    if (!relevant.length) {
      result[property] = { state: "unset" };
      continue;
    }
    if (
      axis === "all" &&
      (!axes[0] || !axes[1] || !equal(axes[0].value, axes[1].value))
    ) {
      result[property] = {
        state: "mixed",
        message: "The explicit axes differ or one axis is not set.",
      };
      continue;
    }
    const value = (axis === "all" ? axes[0] : axes[axis])?.value;
    result[property] = value
      ? {
          state: "value",
          utility: relevant.map((item) => item.raw).join(" "),
          value: format(property, value),
          expectation: value.expectation,
        }
      : { state: "unset" };
  }
  return result;
}

export function setSpacingClass(
  className: string,
  property: SpacingProperty,
  utility: string,
  scope: EditBreakpoint = "base",
): { ok: true; className: string } | { ok: false; message: string } {
  const refuse = (message: string): { ok: false; message: string } => ({
    ok: false,
    message,
  });
  if (
    !isEditBreakpoint(scope) ||
    !(SPACING_PROPERTIES as readonly string[]).includes(property)
  )
    return refuse("Unknown spacing property.");
  const family = familyOf(property),
    axis = axisOf(property),
    current = parse(className, scope);
  const error = current.errors.get(family);
  if (error) return refuse(error);
  const target = parse(utility);
  const wanted = target.entries[0];
  if (
    !/^\S+$/.test(utility) ||
    target.errors.size ||
    target.entries.length !== 1 ||
    !wanted ||
    wanted.family !== family ||
    wanted.axis !== axis
  )
    return refuse("Choose a supported static spacing value within its range.");
  const relevant = current.entries.filter(
    (item) =>
      item.family === family &&
      (axis === "all" || item.axis === "all" || item.axis === axis),
  );
  if (axis === "all") {
    const axes = ([0, 1] as const).map((direction) =>
      current.entries.find(
        (item) =>
          item.family === family &&
          (item.axis === "all" || item.axis === direction),
      ),
    );
    if (axes.every((item) => item && equal(item.value, wanted.value)))
      return { ok: true, className };
  } else if (
    relevant.length &&
    relevant.every((item) => equal(item.value, wanted.value))
  )
    return { ok: true, className };
  const edits: Array<{ start: number; end: number; value: string }> = [];
  for (const [index, item] of relevant.entries()) {
    let replacement = format(property, wanted.value);
    if (axis === "all" && index > 0) replacement = "";
    else if (axis !== "all" && item.axis === "all") {
      const [, inline, block] = GROUPS[family];
      replacement = `${format(inline, axis === 0 ? wanted.value : item.value)} ${format(block, axis === 1 ? wanted.value : item.value)}`;
    }
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
    result += `${className && !/\s$/.test(className) ? " " : ""}${scopeUtilities(format(property, wanted.value), scope)}`;
  return result.length <= 2000
    ? { ok: true, className: result }
    : refuse("The resulting class value exceeds the supported edit size.");
}

export function clearSpacingClass(
  className: string,
  property: SpacingProperty,
  scope: EditBreakpoint,
): { ok: true; className: string } | { ok: false; message: string } {
  if (
    !isEditBreakpoint(scope) ||
    scope === "base" ||
    !(SPACING_PROPERTIES as readonly string[]).includes(property)
  )
    return {
      ok: false,
      message: "Choose a supported responsive property to clear.",
    };
  const parsed = parse(className, scope),
    family = familyOf(property),
    axis = axisOf(property);
  const error = parsed.errors.get(family);
  if (error) return { ok: false, message: error };
  let result = className;
  for (const item of parsed.entries.slice().reverse()) {
    if (
      item.family !== family ||
      (axis !== "all" && item.axis !== "all" && item.axis !== axis)
    )
      continue;
    const companion =
      axis !== "all" && item.axis === "all"
        ? format(GROUPS[family][axis === 0 ? 2 : 1], item.value)
        : "";
    result =
      result.slice(0, item.start) +
      scopeUtilities(companion, scope) +
      result.slice(item.end);
  }
  return result.length <= 2000
    ? { ok: true, className: result }
    : {
        ok: false,
        message: "The resulting class value exceeds the supported edit size.",
      };
}
