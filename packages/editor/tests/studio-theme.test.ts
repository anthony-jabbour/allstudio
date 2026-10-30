import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/shell/studio.css"),
  "utf8",
);

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  if (!match?.[1]) throw new Error(`Missing ${selector} rule`);
  return match[1];
}

describe("studio chrome theme isolation", () => {
  it("keeps the preview color-scheme independent of Appearance switches", () => {
    expect(rule(":root")).toMatch(/color-scheme:\s*light;/);
    expect(rule(':root[data-theme="dark"]')).toMatch(/color-scheme:\s*dark;/);
    expect(rule(':root:not([data-theme="light"])')).toMatch(
      /color-scheme:\s*dark;/,
    );
    expect(css).toMatch(
      /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)\s*\{\s*:root:not\(\[data-theme="light"\]\)/,
    );

    const preview = rule(".preview-frame");
    expect(preview).toMatch(/color-scheme:\s*light dark;/);
    expect(preview).not.toMatch(/color-scheme:\s*(?:only\s+)?light\s*;/);
    expect(preview).not.toMatch(/color-scheme:\s*(?:only\s+)?dark\s*;/);

    expect(css).not.toMatch(/\[data-theme[^\]]*\][^{]*\.preview-frame/);
    expect(css).not.toMatch(/\.preview-frame[^{]*\[data-theme/);
    expect(css).not.toMatch(/prefers-color-scheme:[^{]*\.preview-frame/);
  });
});
