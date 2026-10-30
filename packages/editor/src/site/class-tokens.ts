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
