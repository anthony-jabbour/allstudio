import { describe, expect, it } from "vitest";
import { auditDefaultBreakpoints } from "../src/site/breakpoints.ts";

const pkg = JSON.stringify({ devDependencies: { tailwindcss: "^4" } });
const input = (
  text = '@import "tailwindcss"; body { font-family: Arial; }',
) => ({
  packageJson: pkg,
  configs: [],
  styles: [{ path: "src/app/globals.css", text }],
});
describe("bounded default breakpoint audit", () => {
  it("refuses package-level build transforms", () => {
    for (const key of ["postcss", "babel", "browser"]) {
      const value = input();
      value.packageJson = JSON.stringify({
        devDependencies: { tailwindcss: "^4" },
        [key]: {},
      });
      expect(auditDefaultBreakpoints(value).status).toBe("unsupported");
    }
  });
  it("accepts default Tailwind4 CSS and project colour/font theme aliases", () => {
    expect(
      auditDefaultBreakpoints(
        input(
          '@import "tailwindcss"; @theme inline { --font-sans:var(--geist); --color-background:#fff; } @media(prefers-color-scheme:dark){body{color:white}}',
        ),
      ),
    ).toEqual({ status: "supported-defaults" });
  });
  it("recognizes local CSS imports only when all sources are audited", () => {
    const value = input('@import "tailwindcss"; @import "../tokens.css";');
    value.styles.push({ path: "src/tokens.css", text: ":root{--accent:red}" });
    expect(auditDefaultBreakpoints(value).status).toBe("supported-defaults");
    value.styles.pop();
    expect(auditDefaultBreakpoints(value).status).toBe("unsupported");
  });
  it.each([
    '@import "tailwindcss"; @theme { --breakpoint-md:900px; }',
    '@import "tailwindcss"; @theme { --*:initial; }',
    '@import "tailwindcss"; @custom-variant md (@media(width>=900px));',
    '@import "tailwindcss"; @config "../../tailwind.config.js";',
    '@import "tailwindcss"; @plugin "custom-variants";',
    '@import "tailwindcss"; @reference "outside.css";',
    '@import "tailwindcss"; @import "https://example.invalid/style.css";',
    '@import "tailwindcss"; @import "../../../outside.css";',
    '@import "tailwindcss"; @import url("other.css");',
    '@import "tailwindcss" prefix(tw);',
    '@import "tailwindcss"; @theme { --breakp\\6fint-md:900px; }',
    '@import "tailwindcss"; /* unterminated',
  ])("refuses unsupported/custom/import syntax: %s", (text) =>
    expect(auditDefaultBreakpoints(input(text)).status).toBe("unsupported"));
  it("does not confuse comments or quoted text with actual import/theme directives", () => {
    expect(
      auditDefaultBreakpoints(
        input(
          '/* @import "tailwindcss"; */ body{content:\'@import "tailwindcss";\'}',
        ),
      ).status,
    ).toBe("unsupported");
    expect(
      auditDefaultBreakpoints(
        input(
          '@import "tailwindcss"; /* --breakpoint-md:900px */ body{content:"--breakpoint-lg"}',
        ),
      ).status,
    ).toBe("supported-defaults");
  });
  it("rejects import cycles", () => {
    const value = input('@import "tailwindcss"; @import "../other.css";');
    value.styles.push({
      path: "src/other.css",
      text: '@import "./app/globals.css";',
    });
    expect(auditDefaultBreakpoints(value).status).toBe("unsupported");
  });
  it.each([
    "^3",
    "*",
    ">=4",
    "^4 || ^5",
  ])("refuses unproven Tailwind declaration %s", (version) => {
    expect(
      auditDefaultBreakpoints({
        ...input(),
        packageJson: JSON.stringify({ dependencies: { tailwindcss: version } }),
      }).status,
    ).toBe("unsupported");
  });
  it("refuses existing config without evaluating code", () => {
    expect(
      auditDefaultBreakpoints({ ...input(), configs: ["tailwind.config.ts"] })
        .status,
    ).toBe("unsupported");
  });
  it("bounds source paths, count, UTF8 bytes and file sizes", () => {
    for (const path of [
      "../theme.css",
      "public/theme.css",
      "src/../theme.css",
      "src/link\\theme.css",
      "src/theme.scss",
    ]) {
      expect(
        auditDefaultBreakpoints({
          ...input(),
          styles: [{ path, text: '@import "tailwindcss";' }],
        }).status,
      ).toBe("unsupported");
    }
    expect(
      auditDefaultBreakpoints({
        ...input(),
        styles: Array.from({ length: 1001 }, (_, i) => ({
          path: `src/${i}.css`,
          text: "",
        })),
      }).status,
    ).toBe("unsupported");
    expect(auditDefaultBreakpoints(input("é".repeat(600000))).status).toBe(
      "unsupported",
    );
    expect(
      auditDefaultBreakpoints({ ...input(), packageJson: "not-json" }).status,
    ).toBe("unsupported");
    const value = input();
    value.styles.push(value.styles[0]!);
    expect(auditDefaultBreakpoints(value).status).toBe("unsupported");
  });
  it("never returns raw CSS or config to the renderer", () => {
    const result = auditDefaultBreakpoints(
      input(
        '@import "tailwindcss"; @theme{--breakpoint-md:123px}/*private-marker*/',
      ),
    );
    expect(JSON.stringify(result)).not.toMatch(/private-marker|123px/);
  });
});

it("rejects an import that leaves src even when its suffix resembles an audited path", () => {
  const value = input(
    '@import "tailwindcss"; @import "../../../src/tokens.css";',
  );
  value.styles.push({ path: "src/tokens.css", text: ":root{--accent:red}" });
  expect(auditDefaultBreakpoints(value).status).toBe("unsupported");
});

describe("bounded metadata collection", () => {
  it("collects only declared CSS and fixed root metadata, returning no source contents", async () => {
    const { readResponsiveMetadata } = await import(
      "../src/site/breakpoints.ts"
    );
    const calls: string[] = [];
    const result = await readResponsiveMetadata({
      validateProject: async () => true,
      listStyles: async () => ["src/app/globals.css"],
      readCss: async (path) => {
        calls.push(path);
        return new TextEncoder().encode('@import "tailwindcss";');
      },
      readRootMetadata: async (path) => {
        calls.push(path);
        return path === "package.json" ? new TextEncoder().encode(pkg) : null;
      },
    });
    expect(result).toEqual({ status: "supported-defaults" });
    expect(calls).toEqual([
      "package.json",
      "tailwind.config.ts",
      "tailwind.config.js",
      "tailwind.config.cjs",
      "src/app/globals.css",
    ]);
  });
  it("does not read unsupported style paths or invalid UTF8 and fails closed on IO errors", async () => {
    const { readResponsiveMetadata } = await import(
      "../src/site/breakpoints.ts"
    );
    let reads = 0;
    const reader = {
      validateProject: async () => true,
      listStyles: async () => ["src/theme.scss"],
      readCss: async () => {
        reads++;
        return new Uint8Array([255]);
      },
      readRootMetadata: async (path: string) =>
        path === "package.json" ? new TextEncoder().encode(pkg) : null,
    };
    expect((await readResponsiveMetadata(reader)).status).toBe("unsupported");
    expect(reads).toBe(0);
    reader.listStyles = async () => ["src/theme.css"];
    expect((await readResponsiveMetadata(reader)).status).toBe("unavailable");
    reader.listStyles = async () => {
      throw new Error("private failure");
    };
    expect(await readResponsiveMetadata(reader)).toEqual({
      status: "unavailable",
      reason: "read-failed",
    });
  });
});
