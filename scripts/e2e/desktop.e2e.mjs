import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron, expect } from "@playwright/test";

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
let tracingStarted = false;
let primaryFailure;
const cleanupErrors = [];
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
  tracingStarted = true;
  const page = await application.firstWindow();
  await page
    .getByRole("status")
    .filter({
      hasText: `Electron 45.0.0 · ${executablePath ? "Packaged" : "Development"}`,
    })
    .waitFor();
  await page.getByRole("heading", { name: "Home", exact: true }).waitFor();
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.reload();
  await expect(page.getByLabel("Appearance", { exact: true })).toHaveValue(
    "dark",
  );
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.emulateMedia({ colorScheme: "dark" });
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    ),
    "light",
  );
  await page.getByLabel("Appearance", { exact: true }).selectOption("system");
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    ),
    "dark",
  );
  await page.emulateMedia({ colorScheme: null });
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
    {
      require: "undefined",
      process: "undefined",
      api: [
        "runtime",
        "recent",
        "chooseProject",
        "openRecent",
        "closeProject",
        "locate",
        "previewTextEdit",
        "applyTextEdit",
        "previewClassEdit",
        "applyClassEdit",
        "selectRoute",
        "undo",
        "redo",
        "onChange",
      ],
    },
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
  await application.evaluate(({ BrowserWindow }) => {
    globalThis.frameAttempt = new Promise((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error("Frame navigation did not reach main")),
        5000,
      );
      BrowserWindow.getAllWindows()[0].webContents.once(
        "will-frame-navigate",
        (event) => {
          clearTimeout(deadline);
          resolve({ url: event.url, denied: event.defaultPrevented });
        },
      );
    });
  });
  await page.evaluate((previewUrl) => {
    const frame = document.createElement("iframe");
    frame.id = "hostile-preview";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    frame.src = previewUrl;
    document.body.append(frame);
  }, url);
  assert.deepEqual(await application.evaluate(() => globalThis.frameAttempt), {
    url,
    denied: true,
  });
  assert.equal(
    page.frames().some((frame) => frame.url() === url),
    false,
  );
  await page.locator("#hostile-preview").evaluate((frame) => frame.remove());
  pass("ungranted preview navigation is denied before content can load");

  // Give another top-level WebContents the real preload: main must still reject its IPC.
  const attackerWindow = application.waitForEvent("window");
  await application.evaluate(async ({ app, BrowserWindow }, previewUrl) => {
    const attacker = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: process
          .getBuiltinModule("node:path")
          .join(app.getAppPath(), "out/preload/index.cjs"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    await attacker.loadURL(previewUrl);
  }, url);
  const attacker = await attackerWindow;
  assert.ok(attacker);
  assert.notEqual(attacker, page);
  assert.equal(
    await attacker.evaluate(() => typeof window.allstudio?.runtime),
    "function",
    "The hostile window must load the real bridge before testing main's authorization",
  );
  await assert.rejects(
    attacker.evaluate(() => window.allstudio.runtime()),
    /Unauthorized desktop request/,
  );
  await attacker.close();
  pass(
    "main rejects IPC from a different WebContents even with the real preload",
  );

  await page.evaluate((external) => {
    const button = document.createElement("button");
    button.id = "popup-attempt";
    button.textContent = "Attempt untrusted popup";
    button.addEventListener("click", () => {
      window.popupDenied = window.open(external) === null;
    });
    document.body.append(button);
  }, url);
  await page.locator("#popup-attempt").press("Enter");
  assert.equal(
    await page.evaluate(() => window.popupDenied),
    true,
    "A real user-activated window.open must receive the deny response",
  );
  assert.equal(
    await application.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
    ),
    1,
  );
  await application.evaluate(({ BrowserWindow }) => {
    globalThis.navigationAttempt = new Promise((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error("Navigation did not reach main")),
        5000,
      );
      BrowserWindow.getAllWindows()[0].webContents.once(
        "will-frame-navigate",
        (event) => {
          clearTimeout(deadline);
          resolve({ url: event.url, denied: event.defaultPrevented });
        },
      );
    });
  });
  await page.evaluate((external) => {
    window.location.href = external;
  }, url);
  assert.deepEqual(
    await application.evaluate(() => globalThis.navigationAttempt),
    { url, denied: true },
  );
  assert.equal(page.url(), "app://editor/index.html");
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
} catch (error) {
  primaryFailure = error;
  throw error;
} finally {
  if (application) {
    try {
      if (tracingStarted)
        await application
          .context()
          .tracing.stop({ path: join(evidence, "trace.zip") });
    } catch (error) {
      cleanupErrors.push(error);
    } finally {
      try {
        await application.close();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }
  try {
    server.closeAllConnections();
    await new Promise((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  } catch (error) {
    cleanupErrors.push(error);
  } finally {
    try {
      await rm(userData, { recursive: true, force: true });
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length && primaryFailure)
    console.error(
      "Cleanup also failed:",
      cleanupErrors.map((error) => String(error)),
    );
}
if (cleanupErrors.length)
  throw new AggregateError(cleanupErrors, "Desktop test cleanup failed");
