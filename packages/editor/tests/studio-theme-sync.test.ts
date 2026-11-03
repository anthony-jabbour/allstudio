import { describe, expect, it } from "vitest";
import {
  applyStudioTheme,
  broadcastStudioTheme,
  listenForStudioTheme,
  readStudioTheme,
  writeStudioTheme,
} from "../src/shell/theme.ts";

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("shared Studio theme", () => {
  it("reads the web theme preference and migrates the old editor key", () => {
    expect(readStudioTheme(storage({ "allstudio.theme": "dark" }))).toBe(
      "dark",
    );
    expect(
      readStudioTheme(storage({ "allstudio:appearance:v1": "light" })),
    ).toBe("light");
    expect(readStudioTheme(storage())).toBe("system");
  });

  it("persists one preference key and applies system mode by removing the override", () => {
    const saved = storage({ "allstudio:appearance:v1": "dark" });
    writeStudioTheme("light", saved);
    expect(saved.getItem("allstudio.theme")).toBe("light");
    expect(saved.getItem("allstudio:appearance:v1")).toBeNull();

    const attributes = new Map<string, string>();
    const root = {
      setAttribute: (name: string, value: string) =>
        attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
    };
    applyStudioTheme(root, "dark");
    expect(attributes.get("data-theme")).toBe("dark");
    applyStudioTheme(root, "system");
    expect(attributes.has("data-theme")).toBe(false);
  });

  it("notifies both active surfaces when one changes the shared theme", () => {
    const target = new EventTarget();
    let selected: string | undefined;
    const unsubscribe = listenForStudioTheme(target, (theme) => {
      selected = theme;
    });

    broadcastStudioTheme(target, "dark");

    expect(selected).toBe("dark");
    unsubscribe();
  });
});
