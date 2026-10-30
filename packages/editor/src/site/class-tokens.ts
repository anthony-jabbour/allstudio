/** Find a utility delimiter outside arbitrary values/variants. */
export function topLevelSeparator(value: string, character: string): number {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
    else if (ch === character && depth === 0) return i;
  }
  return -1;
}

export const EDIT_BREAKPOINTS = [
  "base",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
] as const;
export type EditBreakpoint = (typeof EDIT_BREAKPOINTS)[number];
export const DEFAULT_BREAKPOINT_WIDTHS: Record<EditBreakpoint, number> = {
  base: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};
export function isEditBreakpoint(value: unknown): value is EditBreakpoint {
  return (
    typeof value === "string" &&
    (EDIT_BREAKPOINTS as readonly string[]).includes(value)
  );
}
/** Only a single exact breakpoint prefix is editable; state/stacked variants stay opaque. */
export function scopedUtility(
  raw: string,
  scope: EditBreakpoint,
): string | null {
  const colon = topLevelSeparator(raw, ":");
  if (scope === "base") return colon < 0 ? raw : null;
  if (!isEditBreakpoint(scope) || colon < 0 || raw.slice(0, colon) !== scope)
    return null;
  const body = raw.slice(colon + 1);
  return body && topLevelSeparator(body, ":") < 0 ? body : null;
}
export function scopeUtilities(value: string, scope: EditBreakpoint): string {
  return scope === "base"
    ? value
    : value.replace(/\S+/g, (utility) => `${scope}:${utility}`);
}
