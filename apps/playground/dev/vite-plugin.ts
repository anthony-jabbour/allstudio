/**
 * Vite dev-server plugin that wires the playground to one editable fixture
 * copy: prepares the workspace, starts its Next.js dev server with a fixed
 * argv and a scrubbed environment, and mounts the workspace API.
 * `vite build` never runs any of this (`apply: "serve"`).
 */
import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { Plugin } from "vite";
import { DevWorkspace } from "./dev-workspace.ts";
import { prepareWorkspace } from "./prepare-workspace.ts";
import { createWorkspaceApiMiddleware } from "./workspace-api.ts";

export interface DevWorkspacePluginOptions {
  repoRoot: string;
  fixtureDir: string;
  workspaceDir: string;
  editorOrigin: string;
  previewPort: number;
}

export const SESSION_META_NAME = "allstudio-dev-session";
export const PREVIEW_META_NAME = "allstudio-preview-url";

function startPreview(workspaceDir: string, port: number): ChildProcess {
  const require = createRequire(join(workspaceDir, "package.json"));
  const nextBin = require.resolve("next/dist/bin/next");
  const child = spawn(
    process.execPath,
    [nextBin, "dev", "--port", String(port), "--hostname", "localhost"],
    {
      cwd: workspaceDir,
      // The preview is an arbitrary Node process: give it no editor secrets.
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        NODE_ENV: "development",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  return child;
}

export function allstudioDevWorkspace(
  options: DevWorkspacePluginOptions,
): Plugin {
  const sessionToken = randomBytes(32).toString("hex");
  const previewUrl = `http://localhost:${options.previewPort}`;
  let preview: ChildProcess | null = null;

  const stopPreview = () => {
    if (preview && preview.exitCode === null) {
      preview.kill("SIGTERM");
    }
    preview = null;
  };

  return {
    name: "allstudio-dev-workspace",
    apply: "serve",
    async configureServer(server) {
      const prepared = await prepareWorkspace({
        fixtureDir: options.fixtureDir,
        workspaceDir: options.workspaceDir,
        bridgeSourceFile: join(
          options.repoRoot,
          "packages/editor/src/preview-bridge/client.ts",
        ),
        editorOrigin: options.editorOrigin,
        reset: process.env.ALLSTUDIO_RESET_WORKSPACE === "1",
      });
      server.config.logger.info(
        prepared.created
          ? `[allstudio] workspace created at ${options.workspaceDir}`
          : `[allstudio] reusing workspace at ${options.workspaceDir}`,
      );
      const workspace = await DevWorkspace.open(options.workspaceDir);
      server.middlewares.use(
        createWorkspaceApiMiddleware({
          workspace,
          editorOrigin: options.editorOrigin,
          sessionToken,
        }),
      );

      preview = startPreview(options.workspaceDir, options.previewPort);
      server.config.logger.info(
        `[allstudio] preview starting at ${previewUrl}`,
      );
      server.httpServer?.once("close", stopPreview);
      process.once("exit", stopPreview);
    },
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: { name: SESSION_META_NAME, content: sessionToken },
          injectTo: "head",
        },
        {
          tag: "meta",
          attrs: { name: PREVIEW_META_NAME, content: previewUrl },
          injectTo: "head",
        },
      ];
    },
  };
}
