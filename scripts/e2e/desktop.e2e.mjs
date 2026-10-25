import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron } from "@playwright/test";

const desktop = resolve("apps/desktop");
const executablePath = process.argv[2];
if (executablePath) await access(executablePath);
else await access(join(desktop, "out/main/index.js"));
const evidence = join(
  desktop,
  "dist/evidence",
  executablePath ? "packaged" : "development",
);
await mkdir(evidence, { recursive: true });
const userData = await mkdtemp(join(tmpdir(), "allstudio-s0-"));
const server = createServer((_request, response) => {
  response.setHeader("Content-Type", "text/html");
  response.end(
    "<!doctype html><title>Hostile preview</title><p>Untrusted project content</p>",
  );
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}/`;
let application;
let checks = 0;
function pass(message) {
  checks++;
  console.log(`PASS ${message}`);
}
try {
  application = await _electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: [
      ...(executablePath ? [] : [desktop]),
      `--user-data-dir=${userData}`,
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: "1" },
    timeout: 30_000,
  });
  await application
    .context()
    .tracing.start({ screenshots: true, snapshots: true });
  const page = await application.firstWindow();
  await page
    .getByRole("status")
    .filter({
      hasText: `Electron 45.0.0 · ${executablePath ? "Packaged" : "Development"}`,
    })
    .waitFor();
  await page
    .getByRole("heading", { name: "Source editing", exact: true })
    .waitFor();
  assert.equal(page.url(), "app://editor/index.html");
  const info = await page.evaluate(() => window.allstudio.runtime());
  assert.equal(info.electron, "45.0.0");
  assert.equal(info.packaged, Boolean(executablePath));
  pass("native shell uses the real preload IPC and shared editor");

  assert.deepEqual(
    await page.evaluate(() => ({
      require: typeof window.require,
      process: typeof window.process,
      api: Object.keys(window.allstudio),
    })),
    { require: "undefined", process: "undefined", api: ["runtime"] },
  );
  const preferences = await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
  );
  assert.equal(preferences.sandbox, true);
  assert.equal(preferences.contextIsolation, true);
  assert.equal(preferences.nodeIntegration, false);
  assert.equal(preferences.webSecurity, true);
  pass("renderer has no Node or raw IPC access; sandbox and isolation enabled");

  // Exercise hostile content against the actual app window, without production test hooks.
  await page.evaluate((previewUrl) => {
    const frame = document.createElement("iframe");
    frame.id = "hostile-preview";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    frame.src = previewUrl;
    document.body.append(frame);
  }, url);
  const frame = page.frame({ url });
  // Wait for the frame load rather than relying on the synchronous frame lookup.
  const hostile =
    frame ??
    (await page.waitForEvent("framenavigated", {
      predicate: (f) => f.url() === url,
    }));
  await hostile.waitForLoadState();
  assert.deepEqual(
    await hostile.evaluate(() => {
      let parentDenied = false;
      try {
        window.parent.allstudio.runtime();
      } catch {
        parentDenied = true;
      }
      return {
        require: typeof window.require,
        process: typeof window.process,
        api: typeof window.allstudio,
        parentDenied,
      };
    }),
    {
      require: "undefined",
      process: "undefined",
      api: "undefined",
      parentDenied: true,
    },
  );
  pass(
    "hostile cross-origin iframe cannot access native APIs or the parent bridge",
  );

  // Give another top-level WebContents the real preload: main must still reject its IPC.
  await application.evaluate(async ({ BrowserWindow }, previewUrl) => {
    const trusted = BrowserWindow.getAllWindows()[0];
    const attacker = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: trusted.webContents.getLastWebPreferences().preload,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    await attacker.loadURL(previewUrl);
  }, url);
  const attacker = application.windows().find((item) => item !== page);
  assert.ok(attacker);
  assert.equal(
    await attacker.evaluate(async () => {
      try {
        await window.allstudio.runtime();
        return "allowed";
      } catch {
        return "denied";
      }
    }),
    "denied",
  );
  await attacker.close();
  pass(
    "main rejects IPC from a different WebContents even with the real preload",
  );

  await page.evaluate((external) => {
    window.location.href = external;
  }, url);
  await page.waitForTimeout(150);
  assert.equal(page.url(), "app://editor/index.html");
  await page.evaluate((external) => window.open(external), url);
  await page.waitForTimeout(150);
  assert.equal(application.windows().length, 1);
  pass("untrusted top navigation and popups denied");

  const forbidden = await application.evaluate(async ({ net }) => {
    const response = await net.fetch("app://editor/%2e%2e%2fpackage.json");
    return response.status;
  });
  assert.equal(forbidden, 403);
  pass("app asset traversal denied");
  await page.screenshot({ path: join(evidence, "desktop.png") });
  console.log(
    `${checks} desktop checks passed (${executablePath ? "packaged" : "development"}).`,
  );
} finally {
  if (application) {
    await application
      .context()
      .tracing.stop({ path: join(evidence, "trace.zip") });
    await application.close();
  }
  await new Promise((done) => server.close(done));
  await rm(userData, { recursive: true, force: true });
}
