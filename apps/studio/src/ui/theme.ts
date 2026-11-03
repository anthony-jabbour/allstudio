import {
  applyStudioTheme,
  broadcastStudioTheme,
  listenForStudioTheme,
  readStudioTheme,
  type StudioThemePreference,
  writeStudioTheme,
} from "@allstudio/editor/shell";
import { useCallback, useEffect, useState } from "react";

export type ThemePreference = StudioThemePreference;

/** Chrome theme only: follows the system by default, saved per browser. */
export function useTheme(active = true) {
  const [preference, setPreference] =
    useState<ThemePreference>(readStudioTheme);
  useEffect(() => listenForStudioTheme(window, setPreference), []);
  useEffect(() => {
    if (active) applyStudioTheme(document.documentElement, preference);
  }, [active, preference]);
  const set = useCallback((next: ThemePreference) => {
    setPreference(next);
    writeStudioTheme(next);
    broadcastStudioTheme(window, next);
  }, []);
  const resolved: "light" | "dark" =
    preference === "system"
      ? window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;
  return { preference, resolved, set };
}
