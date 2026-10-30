import { type ChildProcess, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import {
  type SelectRouteResult,
  sourceEditFailure,
} from "@allstudio/editor/site";
import { type BrowserWindow, dialog } from "electron";
import type {
  OpenProject,
  ProjectResult,
  RecentProject,
} from "../shared/desktop-api.ts";
import { applyIntegration, planIntegration } from "./config-integration.ts";
import { durableJson } from "./durable-json.ts";
import { hash, LocalWorkspace, textOf } from "./local-workspace.ts";
import { FileFailure } from "./native-files.ts";

interface SavedProject extends RecentProject {
  dev: string;
  ino: string;
  permission?: string;
}
interface Preview {
  child: ChildProcess;
  port: number;
  done: Promise<void>;
  expectedStop: boolean;
}
const METADATA = [
  "package.json",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "next.config.allstudio-original.ts",
  "next.config.allstudio-original.js",
  "next.config.allstudio-original.mjs",
  "tsconfig.json",
  "jsconfig.json",
  "postcss.config.js",
  "postcss.config.mjs",
  "postcss.config.cjs",
  "postcss.config.ts",
  "tailwind.config.ts",
  "tailwind.config.js",
  "tailwind.config.cjs",
  "babel.config.js",
  "babel.config.cjs",
  "babel.config.mjs",
  ".babelrc",
  ".babelrc.json",
  ".swcrc",
  "bun.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
];

export class Projects {
  current: {
    info: OpenProject;
    workspace: LocalWorkspace;
    basePreviewUrl: string;
  } | null = null;
  private preview: Preview | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  private disposed = false;
  constructor(
    private data: string,
    readonly runtime: string,
    private window: () => BrowserWindow,
    private notify: (message: string) => void,
  ) {}

  private async saved(): Promise<SavedProject[]> {
    try {
      const bytes = await readFile(join(this.data, "projects.json"));
      if (bytes.length > 1024 * 1024)
        throw new Error("Project store too large");
      const value = JSON.parse(textOf(bytes)) as {
        schema: number;
        projects: SavedProject[];
      };
      if (
        value.schema !== 1 ||
        !Array.isArray(value.projects) ||
        value.projects.length > 100 ||
        !value.projects.every(
          (item) =>
            typeof item.path === "string" &&
            item.path.startsWith("/") &&
            item.path.length <= 4096 &&
            typeof item.name === "string" &&
            item.name.length <= 255 &&
            item.id === hash(item.path) &&
            /^\d+$/.test(item.dev) &&
            /^\d+$/.test(item.ino) &&
            (item.permission === undefined ||
              /^[a-f0-9]{64}$/.test(item.permission)),
        )
      )
        throw new Error("Invalid local project store");
      return value.projects;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  async recent(): Promise<RecentProject[]> {
    return (await this.saved()).map(({ id, name, path }) => ({
      id,
      name,
      path,
    }));
  }
  private operation(
    task: () => Promise<ProjectResult>,
  ): Promise<ProjectResult> {
    const result = this.tail.then(task).catch((error: unknown) => ({
      ok: false as const,
      project: this.current?.info ?? null,
      message:
        error instanceof Error
          ? error.message
          : "Local project operation failed.",
    }));
    this.tail = result;
    return result;
  }
  choose() {
    return this.operation(async () => {
      const selected = await dialog.showOpenDialog(this.window(), {
        title: "Open a local Next.js project",
        properties: ["openDirectory"],
      });
      if (selected.canceled || !selected.filePaths[0])
        return {
          ok: true,
          project: this.current?.info ?? null,
          unchanged: true,
        };
      return this.open(selected.filePaths[0]);
    });
  }
  reopen(id: string) {
    return this.operation(async () => {
      const saved = (await this.saved()).find((entry) => entry.id === id);
      if (!saved)
        throw new Error(
          "This project has no folder grant. Choose its folder to open it.",
        );
      return this.open(saved.path, saved);
    });
  }

  private async open(
    path: string,
    remembered?: SavedProject,
  ): Promise<ProjectResult> {
    if (this.disposed) throw new Error("Desktop is closing.");
    const workspace = await LocalWorkspace.open(
      path,
      join(this.runtime, "files"),
      join(this.data, "recovery"),
    );
    let candidate: Preview | null = null;
    const active = this.current?.workspace;
    try {
      const identity = await workspace.files.identity();
      if (
        remembered &&
        (identity.dev !== remembered.dev || identity.ino !== remembered.ino)
      )
        throw new Error(
          "The project folder was replaced. Choose its folder again to grant access.",
        );
      if (active?.root === workspace.root) await active.pauseWrites();
      await workspace.files.list();
      const pkg = JSON.parse(
        textOf((await workspace.files.read("package.json")).bytes).replace(
          /^\uFEFF/,
          "",
        ),
      ) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      if (!pkg.dependencies?.next && !pkg.devDependencies?.next)
        throw new Error(
          "This project must declare Next.js and have its dependencies installed. No packages were installed.",
        );
      if ((await workspace.pending()).length) {
        const result = await dialog.showMessageBox(this.window(), {
          type: "warning",
          message: "An interrupted save needs review",
          detail:
            "Restore the pending edit only if the source still matches its saved precondition. Keeping current files discards the recovery draft and never overwrites source.",
          buttons: ["Restore pending edit", "Keep current files", "Cancel"],
          defaultId: 2,
          cancelId: 2,
        });
        if (result.response === 2)
          throw new Error("Recovery cancelled. Source files were kept.");
        const recovered = await workspace.recover(
          result.response === 0 ? "restore" : "keep",
        );
        if (!recovered.ok)
          throw new Error(
            "Recovery conflicts with current source. No external edit was overwritten; recovery data was kept.",
          );
      }
      const plan = await planIntegration(workspace.files);
      if (!plan.installed) {
        const consent = await dialog.showMessageBox(this.window(), {
          type: "question",
          message: "Set up this project for visual editing?",
          detail: `This changes ${plan.path}${plan.backup ? ` and preserves its exact original at ${plan.backup}` : " (a new config file)"}. JSX/TSX files keep their original source. The integration is inactive outside an allstudio preview.\n\nProposed config:\n${plan.content.toString()}`,
          buttons: ["Integrate and back up", "Cancel"],
          defaultId: 1,
          cancelId: 1,
        });
        if (consent.response !== 0)
          throw new Error("Integration cancelled. Project files were kept.");
        await applyIntegration(workspace.files, plan);
      }
      const id = hash(workspace.root);
      const args = [join(this.runtime, "preview-runner.cjs"), workspace.root];
      const fingerprintParts: Array<string | Buffer> = [
        identity.dev,
        identity.ino,
        process.execPath,
        ...args,
        await readFile(args[0]),
        await readFile(join(this.runtime, "preview-loader.cjs")),
      ];
      for (const name of METADATA) {
        try {
          fingerprintParts.push(name, (await workspace.files.read(name)).bytes);
        } catch (error) {
          if (
            !(error instanceof FileFailure) ||
            error.reason !== "file-not-found"
          )
            throw error;
        }
      }
      const fingerprint = hash(
        fingerprintParts.map((item) => hash(item)).join("\n"),
      );
      const saved = await this.saved();
      const previous = saved.find((item) => item.id === id);
      let permission =
        previous?.permission === fingerprint ? fingerprint : undefined;
      if (!permission) {
        const answer = await dialog.showMessageBox(this.window(), {
          type: "warning",
          message: "Run this project's preview?",
          detail: `Project code runs with your user account’s access. Only run projects you trust.\n\nFolder: ${workspace.root}\nExecutable: ${process.execPath}\nArguments: ${JSON.stringify(args)}\n\nThe bundled runtime runs in Node mode. Its environment includes the preview loader and disables Next.js telemetry.`,
          buttons: ["Run", "Cancel"],
          defaultId: 1,
          cancelId: 1,
          checkboxLabel: "Remember for this project",
          checkboxChecked: false,
        });
        if (answer.response !== 0 || this.disposed)
          throw new Error("Preview execution cancelled.");
        if (answer.checkboxChecked) permission = fingerprint;
      }
      const entry: SavedProject = {
        id,
        path: workspace.root,
        name: basename(workspace.root),
        ...identity,
        ...(permission ? { permission } : {}),
      };
      // Next holds one dev lock per project; retain workspace/history until restart succeeds.
      if (this.current?.info.path === workspace.root) await this.stopPreview();
      candidate = await this.startPreview(workspace.root, args);
      workspace.watch((message) => {
        if (this.current?.workspace === workspace) this.notify(message);
      });
      if (this.disposed) throw new Error("Desktop is closing.");
      await durableJson(join(this.data, "projects.json"), {
        schema: 1,
        projects: [entry, ...saved.filter((item) => item.id !== id)].slice(
          0,
          100,
        ),
      });
      const basePreviewUrl = `http://127.0.0.1:${candidate.port}/`;
      const routeSnapshot = await workspace.discoverRoutes();
      const initialRoute = routeSnapshot.routes[0]?.route ?? "/";
      const initialResolved = await workspace.selectRoute(
        basePreviewUrl,
        initialRoute,
      );
      const info: OpenProject = {
        id,
        path: workspace.root,
        name: entry.name,
        previewUrl: initialResolved.ok
          ? initialResolved.previewUrl
          : basePreviewUrl,
        activeRoute: initialRoute,
        routes: routeSnapshot.routes,
        unsupportedRoutes: routeSnapshot.unsupported,
      };
      await this.closeCurrent();
      this.preview = candidate;
      this.current = { info, workspace, basePreviewUrl };
      return { ok: true, project: info };
    } catch (error) {
      await this.stopPreview(candidate);
      await workspace.close();
      throw error;
    } finally {
      active?.resumeWrites();
    }
  }

  private async startPreview(root: string, args: string[]) {
    const child = spawn(process.execPath, args, {
      cwd: root,
      detached: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        NODE_ENV: "development",
        NEXT_TELEMETRY_DISABLED: "1",
        CI: "1",
        ELECTRON_RUN_AS_NODE: "1",
        ALLSTUDIO_PREVIEW_LOADER: join(this.runtime, "preview-loader.cjs"),
      },
    });
    const preview: Preview = {
      child,
      port: 0,
      expectedStop: false,
      done: new Promise((resolve) => child.once("close", () => resolve())),
    };
    child.once("close", () => {
      if (!preview.expectedStop && this.preview === preview)
        this.notify(
          "Preview stopped. Reopen the project; source files are retained.",
        );
    });
    try {
      await new Promise<void>((resolve, reject) => {
        let output = "";
        let diagnostics = "";
        let logBytes = 0;
        const timeout = setTimeout(
          () =>
            fail(
              "Preview startup timed out. Check dependencies and whether its local port is already in use.",
            ),
          45_000,
        );
        const fail = (
          message = "Preview could not start. Check installed dependencies and the project's config.",
        ) => {
          clearTimeout(timeout);
          reject(
            new Error(
              `${message}${diagnostics ? `\n\nRecent preview output:\n${diagnostics}` : ""}`,
            ),
          );
        };
        child.once("error", (error) => fail(error.message));
        child.once("close", () => fail());
        const record = (chunk: Buffer) => {
          logBytes += chunk.length;
          diagnostics = stripVTControlCharacters(
            diagnostics + chunk.toString(),
          ).slice(-4096);
          if (logBytes > 1024 * 1024) fail();
        };
        child.stderr?.on("data", record);
        child.stdout?.on("data", (chunk: Buffer) => {
          record(chunk);
          output = (output + chunk.toString()).slice(-2000);
          const ready = output.match(/ALLSTUDIO_PREVIEW_READY:([0-9]{1,5})\n/);
          if (ready && Number(ready[1]) >= 1024 && Number(ready[1]) <= 65535) {
            preview.port = Number(ready[1]);
            clearTimeout(timeout);
            resolve();
          }
        });
      });
      return preview;
    } catch (error) {
      await this.stopPreview(preview);
      throw error;
    }
  }

  private async stopPreview(preview = this.preview) {
    if (this.preview === preview) this.preview = null;
    if (!preview) return;
    preview.expectedStop = true;
    if (preview.child.pid) {
      try {
        process.kill(-preview.child.pid, "SIGTERM");
      } catch {
        /* Already stopped. */
      }
      const deadline = setTimeout(() => {
        try {
          if (preview.child.pid) process.kill(-preview.child.pid, "SIGKILL");
        } catch {
          /* Already stopped. */
        }
      }, 3000);
      await preview.done;
      clearTimeout(deadline);
      try {
        process.kill(-preview.child.pid, "SIGKILL");
      } catch {
        /* No remaining process group. */
      }
    }
  }
  private async closeCurrent() {
    const previous = this.current;
    this.current = null;
    await this.stopPreview();
    await previous?.workspace.close();
  }
  async selectRoute(route: string): Promise<SelectRouteResult> {
    if (!this.current) {
      return sourceEditFailure("unauthorized");
    }
    const result = await this.current.workspace.selectRoute(
      this.current.basePreviewUrl,
      route,
    );
    if (result.ok && this.current) {
      this.current.info = {
        ...this.current.info,
        previewUrl: result.previewUrl,
        activeRoute: result.route,
        routes: result.routes,
        unsupportedRoutes: result.unsupportedRoutes,
      };
    }
    return result;
  }

  close() {
    return this.operation(async () => {
      await this.closeCurrent();
      return { ok: true, project: null };
    });
  }
  async dispose() {
    this.disposed = true;
    await this.tail;
    await this.closeCurrent();
  }
}
