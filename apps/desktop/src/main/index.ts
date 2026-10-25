import { realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, ipcMain, net, protocol, session } from "electron";
import { RUNTIME_CHANNEL, type RuntimeInfo } from "../shared/desktop-api.ts";
import { assetPath, EDITOR_URL, isTrustedRequest } from "./security.ts";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

const outputDir = dirname(fileURLToPath(import.meta.url));
let editor: BrowserWindow | null = null;

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
    },
  });
  editor = window;
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
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
