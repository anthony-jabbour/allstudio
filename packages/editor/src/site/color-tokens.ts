/**
 * Static colour utility grammar shared by the Typography and Appearance
 * inspectors. Pure string helpers only: they never read files or the DOM.
 */
export type ColorExpectation =
  | { kind: "color"; value: string }
  | { kind: "project" };

export const positiveNumber = (value: string) =>
  /^\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value));

/** Normalizes #rgb/#rgba/#rrggbb/#rrggbbaa to lower-case long form. */
export function normalizeHex(value: string): string | null {
  if (!/^#[a-f\d]+$/i.test(value) || ![4, 5, 7, 9].includes(value.length))
    return null;
  const lower = value.toLowerCase();
  return lower.length <= 5
    ? `#${[...lower.slice(1)].map((ch) => ch + ch).join("")}`
    : lower;
}

/** A slash alpha modifier as a 0-100 percentage, or null when unsupported. */
export function alphaPercentage(value: string): number | null {
  if (positiveNumber(value) && Number(value) <= 100) return Number(value);
  const ratio = /^\[(\d+(?:\.\d+)?)\]$/.exec(value);
  return ratio?.[1] && positiveNumber(ratio[1]) && Number(ratio[1]) <= 1
    ? Number(ratio[1]) * 100
    : null;
}

const PALETTE =
  /^(?:black|white|transparent|current|inherit|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950))$/;

/**
 * Parses `<prefix>-<colour>` with an optional slash alpha modifier. Returns
 * the normalized utility and how its rendered colour is expected to look.
 */
export function parseColorUtility(
  prefix: string,
  value: string,
  suffix?: string,
): { value: string; expectation: ColorExpectation } | null {
  if (!value.startsWith(`${prefix}-`)) return null;
  const body = value.slice(prefix.length + 1);
  const percentage = suffix === undefined ? null : alphaPercentage(suffix);
  if (suffix !== undefined && percentage === null) return null;
  const literal = /^\[(#[a-f\d]+)\]$/i.exec(body);
  const rgb = literal?.[1] ? normalizeHex(literal[1]) : null;
  if (!rgb && !PALETTE.test(body)) return null;
  return {
    value: `${prefix}-${rgb ? `[${rgb}]` : body}${suffix === undefined ? "" : `/${percentage}`}`,
    expectation: rgb
      ? {
          kind: "color",
          value:
            percentage === null
              ? rgb
              : `color-mix(in oklab, ${rgb} ${percentage}%, transparent)`,
        }
      : { kind: "project" },
  };
}
