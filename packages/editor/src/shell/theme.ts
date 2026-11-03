export type StudioThemePreference = "system" | "light" | "dark";

export const STUDIO_THEME_KEY = "allstudio.theme";
export const STUDIO_THEME_EVENT = "allstudio:theme-change";
const LEGACY_THEME_KEY = "allstudio:appearance:v1";

type ThemeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isStudioTheme(value: unknown): value is StudioThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function readStudioTheme(storage?: ThemeStorage): StudioThemePreference {
  try {
    const source = storage ?? globalThis.localStorage;
    const current = source.getItem(STUDIO_THEME_KEY);
    if (isStudioTheme(current)) return current;
    const legacy = source.getItem(LEGACY_THEME_KEY);
    return isStudioTheme(legacy) ? legacy : "system";
  } catch {
    return "system";
  }
}

export function writeStudioTheme(
  preference: StudioThemePreference,
  storage?: ThemeStorage,
): void {
  try {
    const target = storage ?? globalThis.localStorage;
    if (preference === "system") target.removeItem(STUDIO_THEME_KEY);
    else target.setItem(STUDIO_THEME_KEY, preference);
    target.removeItem(LEGACY_THEME_KEY);
  } catch {
    // Theme storage is optional; the active surface still applies the choice.
  }
}

export function applyStudioTheme(
  root: Pick<HTMLElement, "setAttribute" | "removeAttribute">,
  preference: StudioThemePreference,
): void {
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
}

export function broadcastStudioTheme(
  target: EventTarget,
  preference: StudioThemePreference,
): void {
  target.dispatchEvent(
    new CustomEvent(STUDIO_THEME_EVENT, { detail: preference }),
  );
}

export function listenForStudioTheme(
  target: EventTarget,
  onChange: (preference: StudioThemePreference) => void,
): () => void {
  const listener = (event: Event) => {
    const preference = (event as CustomEvent<unknown>).detail;
    if (isStudioTheme(preference)) onChange(preference);
  };
  target.addEventListener(STUDIO_THEME_EVENT, listener);
  return () => target.removeEventListener(STUDIO_THEME_EVENT, listener);
}
