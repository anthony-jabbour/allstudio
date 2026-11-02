import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
const KEY = "allstudio.theme";

function read(): ThemePreference {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function apply(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
}

/** Chrome theme only: follows the system by default, saved per browser. */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(read);
  useEffect(() => apply(preference), [preference]);
  const set = useCallback((next: ThemePreference) => {
    setPreference(next);
    try {
      if (next === "system") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked: the choice still applies for this session.
    }
  }, []);
  const resolved: "light" | "dark" =
    preference === "system"
      ? window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;
  return { preference, resolved, set };
}
