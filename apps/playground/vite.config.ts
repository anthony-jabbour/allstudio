import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { allstudioDevWorkspace } from "./dev/vite-plugin.ts";

const playgroundDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(playgroundDir, "../..");
const EDITOR_PORT = 5173;

/** Each fixture runs as its own git-ignored copy and Next.js dev server. */
const fixtures = [
  {
    id: "aurora-atelier",
    name: "Aurora Atelier (landing page)",
    fixtureDir: join(repoRoot, "examples/nextjs-site-fixture"),
    previewPort: 3101,
  },
  {
    id: "lumen-notes",
    name: "Lumen Notes (nested components)",
    fixtureDir: join(repoRoot, "examples/nested-components-fixture"),
    previewPort: 3102,
  },
  {
    id: "harbor-studio",
    name: "Harbor Studio (Tailwind variants)",
    fixtureDir: join(repoRoot, "examples/tailwind-variants-fixture"),
    previewPort: 3103,
  },
].map((fixture) => ({
  ...fixture,
  workspaceDir: join(playgroundDir, ".workspace", fixture.id),
}));

export default defineConfig({
  plugins: [
    react(),
    allstudioDevWorkspace({
      repoRoot,
      editorOrigin: `http://localhost:${EDITOR_PORT}`,
      fixtures,
    }),
  ],
  server: {
    port: EDITOR_PORT,
    strictPort: true,
    // No CORS: the cross-origin preview must not read the editor page or its
    // session token.
    cors: false,
    watch: { ignored: ["**/.workspace/**"] },
  },
});
