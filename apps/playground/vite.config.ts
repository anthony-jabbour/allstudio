import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { allstudioDevWorkspace } from "./dev/vite-plugin.ts";

const playgroundDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(playgroundDir, "../..");
const EDITOR_PORT = 5173;
const PREVIEW_PORT = 3101;

export default defineConfig({
  plugins: [
    react(),
    allstudioDevWorkspace({
      repoRoot,
      fixtureDir: join(repoRoot, "examples/nextjs-site-fixture"),
      workspaceDir: join(playgroundDir, ".workspace/nextjs-site-fixture"),
      editorOrigin: `http://localhost:${EDITOR_PORT}`,
      previewPort: PREVIEW_PORT,
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
