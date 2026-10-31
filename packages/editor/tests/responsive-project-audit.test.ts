import { expect, it } from "vitest";
import { validateResponsiveProject } from "../src/source-mapper/responsive-project.ts";

const files = new Map([
  [
    "src/app/layout.tsx",
    'import "./globals.css"; export default function Layout(){return <main/>}',
  ],
  ["src/lib/helper.ts", "export const value=1;"],
]);
const reader = (overrides: Map<string, string> = new Map()) => ({
  listSources: async () => [...files.keys()],
  readSource: async (path: string) =>
    new TextEncoder().encode(overrides.get(path) ?? files.get(path) ?? ""),
  readConfig: async (path: string) =>
    overrides.has(path) ? new TextEncoder().encode(overrides.get(path)) : null,
});
it("binds audited styles to source imports, refusing external/unknown module paths", async () => {
  expect(
    await validateResponsiveProject(reader(), ["src/app/globals.css"]),
  ).toBe(true);
  for (const source of [
    'import "../../theme.css";',
    'import "/outside/theme.css";',
    'import "./missing.css";',
    'import("../../theme.css");',
    'import "@theme/tokens";',
    'import "next/../../theme.css";',
    'export * from "../../theme.css";',
  ]) {
    expect(
      await validateResponsiveProject(
        reader(new Map([["src/app/layout.tsx", source]])),
        ["src/app/globals.css"],
      ),
    ).toBe(false);
  }
  expect(
    await validateResponsiveProject(
      reader(new Map([["src/lib/helper.ts", 'import "../../../theme.css";']])),
      ["src/app/globals.css"],
    ),
  ).toBe(false);
});
it("accepts only statically recognized Next CSS build configuration and no PostCSS extensions", async () => {
  const normal =
    'import type {NextConfig} from "next"; const config:NextConfig={cacheComponents:true,turbopack:{rules:{"*.css":{loaders:["@tailwindcss/turbopack"],as:"*.css"}}}}; export default config;';
  expect(
    await validateResponsiveProject(
      reader(new Map([["next.config.ts", normal]])),
      ["src/app/globals.css"],
    ),
  ).toBe(true);
  for (const config of [
    "export default {webpack(){return custom()}};",
    normal.replace("@tailwindcss/turbopack", "custom-loader"),
    "export default getConfig();",
  ]) {
    expect(
      await validateResponsiveProject(
        reader(new Map([["next.config.ts", config]])),
        ["src/app/globals.css"],
      ),
    ).toBe(false);
  }
  expect(
    await validateResponsiveProject(
      reader(
        new Map([
          ["postcss.config.mjs", "export default {plugins:{custom:{}}}"],
        ]),
      ),
      ["src/app/globals.css"],
    ),
  ).toBe(false);
});
