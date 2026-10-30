import { readFile, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  hasExactKeys,
  parseClassEditBody,
  parseLocateBody,
  parseSelectRouteBody,
  parseTextEditBody,
  sourceEditFailure,
} from "@allstudio/editor/site";
import {
  app,
  BrowserWindow,
  ipcMain,
  net,
  protocol,
  session,
  webFrameMain,
} from "electron";
import {
  CHANGE_CHANNEL,
  PROJECT_CHANNEL,
  RUNTIME_CHANNEL,
  type RuntimeInfo,
} from "../shared/desktop-api.ts";
import { Projects } from "./projects.ts";
import { assetPath, EDITOR_URL, isTrustedRequest } from "./security.ts";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

const outputDir = dirname(fileURLToPath(import.meta.url));
let editor: BrowserWindow | null = null;
let projects: Projects;
let bridgeScript = "";
const profile = app.commandLine.getSwitchValue("user-data-dir");
if (profile) app.setPath("userData", resolve(profile));

async function createWindow() {
  const window = new BrowserWindow({
    title: "allstudio",
    width: 1280,
    height: 850,
    webPreferences: {
      preload: join(outputDir, "../preload/index.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false,
    },
  });
  editor = window;
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("will-frame-navigate", (event) => {
    if (event.isMainFrame) {
      event.preventDefault();
      return;
    }
    try {
      const expected = projects.current?.info.previewUrl;
      if (!expected) {
        event.preventDefault();
        return;
      }
      const target = new URL(event.url);
      const allowed = new URL(expected);
      if (
        target.origin !== allowed.origin ||
        target.pathname !== allowed.pathname ||
        target.search !== ""
      )
        event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
  window.webContents.on(
    "did-frame-finish-load",
    (_event, main, processId, routingId) => {
      if (main) return;
      const frame = webFrameMain.fromId(processId, routingId);
      const expected = projects.current?.info.previewUrl;
      if (!frame || !expected || frame.parent !== window.webContents.mainFrame)
        return;
      try {
        const target = new URL(frame.url);
        const allowed = new URL(expected);
        if (
          target.origin === allowed.origin &&
          target.pathname === allowed.pathname &&
          target.search === ""
        )
          void frame.executeJavaScript(bridgeScript).catch(() => {
            if (!window.isDestroyed())
              window.webContents.send(
                CHANGE_CHANNEL,
                "The preview bridge could not start. Source files were kept.",
              );
          });
      } catch {
        /* Navigating or detached frame. */
      }
    },
  );
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.on("closed", () => {
    if (editor === window) editor = null;
  });
  await window.loadURL(EDITOR_URL);
}

app
  .whenReady()
  .then(async () => {
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.on("will-download", (event) =>
      event.preventDefault(),
    );
    const rendererDir = await realpath(join(outputDir, "../renderer"));
    const runtime = app.isPackaged
      ? join(process.resourcesPath, "local-runtime")
      : join(outputDir, "../runtime");
    bridgeScript = await readFile(join(runtime, "preview-bridge.js"), "utf8");
    projects = new Projects(
      app.getPath("userData"),
      runtime,
      () => {
        if (!editor || editor.isDestroyed())
          throw new Error("Desktop window unavailable");
        return editor;
      },
      (message) => {
        if (editor && !editor.isDestroyed())
          editor.webContents.send(CHANGE_CHANNEL, message);
      },
    );
    protocol.handle("app", async (request) => {
      const target = assetPath(request.url, rendererDir);
      if (!target || request.method !== "GET")
        return new Response(null, { status: 403 });
      try {
        if ((await realpath(target)) !== target)
          return new Response(null, { status: 403 });
        return await net.fetch(pathToFileURL(target).href);
      } catch {
        return new Response(null, { status: 404 });
      }
    });
    ipcMain.handle(RUNTIME_CHANNEL, (event, ...args): RuntimeInfo => {
      if (!editor || !isTrustedRequest(event, editor.webContents, args)) {
        throw new Error("Unauthorized desktop request");
      }
      return {
        version: app.getVersion(),
        electron: process.versions.electron,
        packaged: app.isPackaged,
      };
    });
    ipcMain.handle(PROJECT_CHANNEL, async (event, ...args) => {
      if (
        !editor ||
        !isTrustedRequest(event, editor.webContents, []) ||
        args.length !== 1
      )
        throw new Error("Unauthorized desktop request");
      const body: unknown = args[0];
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new Error("Invalid desktop request");
      const value = body as Record<string, unknown>;
      if (value.action === "recent" && hasExactKeys(value, ["action"]))
        return projects.recent();
      if (value.action === "choose" && hasExactKeys(value, ["action"]))
        return projects.choose();
      if (
        value.action === "open" &&
        hasExactKeys(value, ["action", "id"]) &&
        typeof value.id === "string" &&
        /^[a-f0-9]{64}$/.test(value.id)
      )
        return projects.reopen(value.id);
      if (value.action === "close" && hasExactKeys(value, ["action"]))
        return projects.close();
      const current = projects.current;
      if (!current || value.projectId !== current.info.id)
        return sourceEditFailure("unauthorized");
      if (
        (value.action === "undo" || value.action === "redo") &&
        hasExactKeys(value, ["action", "projectId"])
      )
        return current.workspace[value.action]();
      if (!hasExactKeys(value, ["action", "projectId", "request"]))
        return sourceEditFailure("invalid-request");
      if (value.action === "locate") {
        const parsed = parseLocateBody(value.request);
        return parsed
          ? current.workspace.locate(parsed.oid)
          : sourceEditFailure("invalid-request");
      }
      if (value.action === "select-route") {
        const parsed = parseSelectRouteBody(value.request);
        return parsed
          ? projects.selectRoute(parsed.route)
          : sourceEditFailure("invalid-request");
      }
      if (value.action === "preview-text" || value.action === "apply-text") {
        const parsed = parseTextEditBody(value.request);
        return parsed
          ? value.action === "apply-text"
            ? current.workspace.applyTextEdit(parsed)
            : current.workspace.previewTextEdit(parsed)
          : sourceEditFailure("invalid-request");
      }
      if (value.action === "preview-class" || value.action === "apply-class") {
        const parsed = parseClassEditBody(value.request);
        return parsed
          ? value.action === "apply-class"
            ? current.workspace.applyClassEdit(parsed)
            : current.workspace.previewClassEdit(parsed)
          : sourceEditFailure("invalid-request");
      }
      return sourceEditFailure("invalid-request");
    });
    await createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  })
  .catch((error: unknown) => {
    console.error("Desktop startup failed", error);
    app.exit(1);
  });

app.on("window-all-closed", () => app.quit());
let quitting = false;
app.on("before-quit", (event) => {
  if (quitting || !projects) return;
  event.preventDefault();
  quitting = true;
  void projects.dispose().then(
    () => app.exit(0),
    () => app.exit(1),
  );
});
