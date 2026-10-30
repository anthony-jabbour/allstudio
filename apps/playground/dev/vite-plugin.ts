/**
 * Vite dev-server plugin that wires the playground to editable fixture
 * copies: for each fixture it prepares a workspace, starts that copy's
 * Next.js dev server with a fixed argv and a scrubbed environment, and
 * mounts the workspace API under the fixture's id.
 * `vite build` never runs any of this (`apply: "serve"`).
 */
import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { DiscoveredRoute, UnsupportedRoute } from "@allstudio/editor/site";
import type { Plugin } from "vite";
import { DevWorkspace } from "./dev-workspace.ts";
import { prepareWorkspace } from "./prepare-workspace.ts";
import { createWorkspaceApiMiddleware } from "./workspace-api.ts";

export interface DevFixture {
  /** URL-safe id, used in the workspace API path. */
  id: string;
  /** Label shown in the playground fixture picker. */
  name: string;
  fixtureDir: string;
  workspaceDir: string;
  previewPort: number;
}

export interface DevWorkspacePluginOptions {
  repoRoot: string;
  editorOrigin: string;
  fixtures: DevFixture[];
}

/** What the editor page learns about each fixture (no filesystem paths). */
export interface PublicFixture {
  id: string;
  name: string;
  previewUrl: string;
  activeRoute: string;
  routes: DiscoveredRoute[];
  unsupportedRoutes: UnsupportedRoute[];
}

export const SESSION_META_NAME = "allstudio-dev-session";
export const FIXTURES_META_NAME = "allstudio-fixtures";
const FIXTURE_ID = /^[a-z0-9-]{1,40}$/;

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
  for (const fixture of options.fixtures) {
    if (!FIXTURE_ID.test(fixture.id)) {
      throw new Error(`Invalid fixture id: ${fixture.id}`);
    }
  }
  const publicFixtures: PublicFixture[] = options.fixtures.map((fixture) => ({
    id: fixture.id,
    name: fixture.name,
    previewUrl: `http://localhost:${fixture.previewPort}`,
    activeRoute: "/",
    routes: [],
    unsupportedRoutes: [],
  }));
  const previews: ChildProcess[] = [];

  const stopPreviews = () => {
    for (const preview of previews) {
      if (preview.exitCode === null) {
        preview.kill("SIGTERM");
      }
    }
    previews.length = 0;
  };

  return {
    name: "allstudio-dev-workspace",
    apply: "serve",
    async configureServer(server) {
      const workspaces = new Map<string, DevWorkspace>();
      for (const fixture of options.fixtures) {
        const prepared = await prepareWorkspace({
          fixtureDir: fixture.fixtureDir,
          workspaceDir: fixture.workspaceDir,
          bridgeSourceFile: join(
            options.repoRoot,
            "packages/editor/src/preview-bridge/client.ts",
          ),
          editorOrigin: options.editorOrigin,
          reset: process.env.ALLSTUDIO_RESET_WORKSPACE === "1",
        });
        server.config.logger.info(
          `[allstudio] ${prepared.created ? "created" : "reusing"} ${fixture.id} workspace at ${fixture.workspaceDir}`,
        );
        const previewUrl = `http://localhost:${fixture.previewPort}`;
        const ws = await DevWorkspace.open(fixture.workspaceDir, {
          previewUrl,
        });
        workspaces.set(fixture.id, ws);
        const snapshot = await ws.discoverRoutes();
        const publicFixture = publicFixtures.find(
          (entry) => entry.id === fixture.id,
        );
        if (publicFixture) {
          const initialRoute = snapshot.routes[0]?.route ?? "/";
          if (snapshot.routes.length > 0 && initialRoute !== "/") {
            const selected = await ws.selectRoute(initialRoute);
            if (selected.ok) {
              publicFixture.previewUrl = selected.previewUrl;
              publicFixture.activeRoute = selected.route;
            } else {
              publicFixture.activeRoute = initialRoute;
            }
          } else {
            publicFixture.activeRoute = initialRoute;
          }
          publicFixture.routes = snapshot.routes;
          publicFixture.unsupportedRoutes = snapshot.unsupported;
        }
      }
      server.middlewares.use(
        createWorkspaceApiMiddleware({
          workspaces,
          editorOrigin: options.editorOrigin,
          sessionToken,
        }),
      );

      for (const fixture of options.fixtures) {
        previews.push(startPreview(fixture.workspaceDir, fixture.previewPort));
        server.config.logger.info(
          `[allstudio] ${fixture.id} preview starting at http://localhost:${fixture.previewPort}`,
        );
      }
      server.httpServer?.once("close", stopPreviews);
      process.once("exit", stopPreviews);
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
          attrs: {
            name: FIXTURES_META_NAME,
            content: JSON.stringify(publicFixtures),
          },
          injectTo: "head",
        },
      ];
    },
  };
}
