/** Joins truthy class names. A stand-in for clsx-style helpers. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
