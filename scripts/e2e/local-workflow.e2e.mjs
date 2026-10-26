import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  access,
  appendFile,
  cp,
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { _electron, expect } from "@playwright/test";

const desktop = resolve("apps/desktop");
const executablePath = process.argv
  .slice(2)
  .find((argument) => !argument.startsWith("--"));
const offline = process.argv.includes("--offline");
const evidence = await mkdtemp(join(desktop, "dist/local-workflow-"));
const project = join(evidence, "project");
const profile = join(evidence, "profile");
await mkdir(project);
await mkdir(profile);
const fixtureName = process.env.ALLSTUDIO_FIXTURE ?? "nextjs-site-fixture";
assert.ok(
  [
    "nextjs-site-fixture",
    "nested-components-fixture",
    "tailwind-variants-fixture",
  ].includes(fixtureName),
);
const fixture = resolve("examples", fixtureName);
for (const entry of [
  "src",
  "public",
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "next-env.d.ts",
]) {
  try {
    await cp(join(fixture, entry), join(project, entry), { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT" || !["public", "next-env.d.ts"].includes(entry))
      throw error;
  }
}
await symlink(
  join(fixture, "node_modules"),
  join(project, "node_modules"),
  "dir",
);
const sourceFile = join(project, "src/app/page.tsx");
await appendFile(
  sourceFile,
  `\n// data-oid="comment-only"\nconst htmlSnippet = "<p data-oid='example'>Example</p>";\n`,
);
const original = await readFile(sourceFile, "utf8");
if (offline) {
  assert.equal(
    process.platform,
    "darwin",
    "The OS-enforced offline harness currently requires macOS sandbox-exec.",
  );
  const probe = `\nimport { createConnection } from "node:net";\nimport { writeFileSync } from "node:fs";\nconst probe = createConnection({ host: "198.51.100.1", port: 443 });\nconst recordProbe = (code: string) => writeFileSync(${JSON.stringify(join(project, "network-proof.json"))}, JSON.stringify({ code, secret: process.env.ALLSTUDIO_SECRET_SENTINEL ?? null }));\nprobe.once("error", (error: NodeJS.ErrnoException) => recordProbe(error.code ?? "unknown"));\nprobe.once("connect", () => { recordProbe("connected"); probe.destroy(); });\nprobe.setTimeout(1500, () => { recordProbe("timeout"); probe.destroy(); });\n`;
  await writeFile(
    join(project, "next.config.ts"),
    (await readFile(join(project, "next.config.ts"), "utf8")) + probe,
  );
}
const config = await readFile(join(project, "next.config.ts"), "utf8");
const replacement = join(evidence, "replacement");
await cp(project, replacement, { recursive: true });
const frameProbe = join(evidence, "frame-probe.cjs");
await writeFile(
  frameProbe,
  'const { contextBridge, ipcRenderer } = require("electron"); if (!process.isMainFrame) contextBridge.exposeInMainWorld("testFrameIpc", () => ipcRenderer.invoke("allstudio:project", { action: "recent" }).then(() => "allowed", () => "denied"));\n',
);
let application;
let checks = 0;
let orphanPid;
function pass(message) {
  checks++;
  console.log(`PASS ${message}`);
}

async function toolbar(page, name) {
  const button = page.getByRole("button", { name, exact: true });
  await expect(button).toBeEnabled();
  await button.press("Enter");
}

async function launch() {
  application = await _electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: [
      ...(executablePath ? [] : [desktop]),
      `--user-data-dir=${profile}`,
      ...(offline
        ? [
            "--proxy-server=127.0.0.1:9",
            "--proxy-bypass-list=localhost;127.0.0.1;[::1]",
          ]
        : []),
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      ALLSTUDIO_SECRET_SENTINEL: "test-only-parent-sentinel",
    },
    timeout: 30_000,
  });
  await application.evaluate(
    async ({ dialog, session }, { root, offline, frameProbe }) => {
      globalThis.testDialogs = [];
      globalThis.previewLogs = "";
      globalThis.requestedOrigins = [];
      session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        const url = new URL(details.url);
        const origin = `${url.protocol}//${url.host}`;
        if (!globalThis.requestedOrigins.includes(origin))
          globalThis.requestedOrigins.push(origin);
        callback({});
      });
      session.defaultSession.registerPreloadScript({
        type: "frame",
        filePath: frameProbe,
      });
      const childProcess = process.getBuiltinModule("node:child_process");
      const originalSpawn = childProcess.spawn;
      childProcess.spawn = (...args) => {
        const preview = String(args[1]?.[0]).includes("preview-runner.cjs");
        const child =
          offline && preview
            ? originalSpawn(
                "/usr/bin/sandbox-exec",
                [
                  "-p",
                  '(version 1)(allow default)(deny network-outbound)(allow network-outbound (remote ip "localhost:*"))',
                  args[0],
                  ...args[1],
                ],
                args[2],
              )
            : originalSpawn(...args);
        if (preview) {
          globalThis.previewPid = child.pid;
          for (const stream of [child.stdout, child.stderr])
            stream?.on("data", (chunk) => {
              globalThis.previewLogs = (
                globalThis.previewLogs + chunk.toString()
              ).slice(-12000);
            });
        }
        return child;
      };
      process.getBuiltinModule("node:module").syncBuiltinESMExports();
      dialog.showOpenDialog = async () => {
        const selected = {
          canceled: Boolean(globalThis.cancelPicker),
          filePaths: globalThis.cancelPicker
            ? []
            : [globalThis.nextFolder ?? root],
        };
        globalThis.lastPickerResult = selected;
        return selected;
      };
      dialog.showMessageBox = async (...args) => {
        globalThis.testDialogs.push(args.at(-1));
        return {
          response:
            args.at(-1).message === "An interrupted save needs review" &&
            globalThis.cancelRecovery
              ? 2
              : (args.at(-1).message === "Run this project's preview?" &&
                    globalThis.cancelRun) ||
                  (args.at(-1).message ===
                    "Set up this project for visual editing?" &&
                    globalThis.cancelIntegration)
                ? 1
                : 0,
          checkboxChecked: true,
        };
      };
    },
    { root: project, offline, frameProbe },
  );
  await application
    .context()
    .tracing.start({ screenshots: true, snapshots: true });
  assert.equal(
    await application.evaluate(({ app }) => app.getPath("userData")),
    profile,
  );
  return application.firstWindow();
}

const occupied = createServer((_request, response) =>
  response.end("Existing local service"),
);
const legacyPort =
  40000 +
  (Number.parseInt(
    createHash("sha256").update(project).digest("hex").slice(0, 8),
    16,
  ) %
    15000);
await new Promise((resolve, reject) => {
  occupied.once("error", (error) =>
    error.code === "EADDRINUSE" ? resolve() : reject(error),
  );
  occupied.listen(legacyPort, "127.0.0.1", resolve);
});
try {
  let page = await launch();
  await toolbar(page, "Open project");
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60_000 });
  const preview = page.frameLocator('iframe[title="Project preview"]');
  await preview.locator("h1").click();
  const originalHeading = await preview.locator("h1").innerText();
  assert.notEqual(
    new URL(
      page
        .frames()
        .find((frame) => frame.url().startsWith("http://127.0.0.1:"))
        ?.url(),
    ).port,
    String(legacyPort),
  );
  pass(
    "preview binds an available OS-assigned port while the old fixed port is occupied; HTML snippets and comments still compile",
  );
  await page.getByTestId("source-location").waitFor();
  assert.equal(await readFile(sourceFile, "utf8"), original);
  assert.equal(
    await readFile(join(project, "next.config.allstudio-original.ts"), "utf8"),
    config,
  );
  pass(
    "open, explicit config backup and real preview bridge without instrumenting source",
  );
  if (offline) {
    await expect
      .poll(
        async () => {
          try {
            return JSON.parse(
              await readFile(join(project, "network-proof.json"), "utf8"),
            );
          } catch {
            return null;
          }
        },
        { timeout: 10_000 },
      )
      .toEqual({ code: "EPERM", secret: null });
    const browserNetwork = await application.evaluate(async ({ net }) => {
      try {
        await net.fetch("https://example.invalid/offline-probe");
        return "connected";
      } catch (error) {
        return String(error);
      }
    });
    assert.match(
      browserNetwork,
      /ERR_PROXY_CONNECTION_FAILED|ERR_TUNNEL_CONNECTION_FAILED|ERR_BLOCKED_BY_CLIENT/,
    );
    pass(
      "Electron external HTTP is disabled; the preview child gets OS egress denial and no parent secret",
    );
  }
  const originalClasses = await page
    .getByLabel("Classes", { exact: true })
    .inputValue();
  await page
    .getByLabel("Classes", { exact: true })
    .fill("keep-this-unsaved-class-draft");
  await page.getByLabel("Text", { exact: true }).fill("Saved locally");
  await page
    .getByRole("button", { name: "Preview text patch", exact: true })
    .click();
  assert.equal(await readFile(sourceFile, "utf8"), original);
  await page.getByRole("button", { name: "Apply text", exact: true }).click();
  await preview
    .getByRole("heading", { name: "Saved locally", exact: true })
    .waitFor({ timeout: 30_000 });
  await page
    .getByText(
      /Saved to src\/app\/page\.tsx and the preview shows the new text/,
    )
    .waitFor({ timeout: 30_000 });
  const saved = await readFile(sourceFile, "utf8");
  assert.equal(saved, original.replace(originalHeading, "Saved locally"));
  await expect(page.getByLabel("Classes", { exact: true })).toHaveValue(
    "keep-this-unsaved-class-draft",
  );
  await page.getByLabel("Classes", { exact: true }).fill(originalClasses);
  assert.ok(saved.includes("Saved locally"));
  assert.ok(!saved.includes('data-oid="p:'));
  assert.ok(saved.includes("<p data-oid='example'>Example</p>"));
  pass("Apply saves real uninstrumented source and live preview refreshes");
  const info = (await page.evaluate(() => window.allstudio.recent()))[0];
  const oid = await preview.locator("h1").getAttribute("data-oid");
  assert.ok(oid);
  const located = await page.evaluate(
    ([id, selected]) => window.allstudio.locate(id, selected),
    [info.id, oid],
  );
  assert.equal(located.ok, true);
  assert.equal(
    located.element.location.start.line,
    original.slice(0, original.indexOf("<h1")).split("\n").length,
  );
  const dialogs = await application.evaluate(() => globalThis.testDialogs);
  assert.deepEqual(
    dialogs.map((item) => item.message),
    ["Set up this project for visual editing?", "Run this project's preview?"],
  );
  assert.ok(
    dialogs[1].detail.includes(
      "Project code runs with your user account’s access. Only run projects you trust.",
    ),
  );
  pass(
    "real source location and explicit integration/script permission sequence",
  );

  await page
    .getByLabel("Text", { exact: true })
    .fill("Keep this unapplied draft");
  await application.evaluate(() => {
    globalThis.cancelPicker = true;
  });
  await toolbar(page, "Open project");
  await expect(
    page.getByRole("button", { name: "Open project", exact: true }),
  ).toBeEnabled();
  await page
    .getByText("Current project kept.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    (await application.evaluate(() => globalThis.lastPickerResult)).canceled,
    true,
  );
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    "Keep this unapplied draft",
  );
  await application.evaluate(() => {
    globalThis.cancelPicker = false;
  });
  await application.evaluate((_, replacement) => {
    globalThis.nextFolder = replacement;
    globalThis.cancelIntegration = true;
  }, replacement);
  await toolbar(page, "Open project");
  await page
    .getByText("Integration cancelled. Project files were kept.", {
      exact: true,
    })
    .waitFor();
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    "Keep this unapplied draft",
  );
  await application.evaluate(() => {
    globalThis.cancelIntegration = false;
    globalThis.cancelRun = true;
  });
  await toolbar(page, "Open project");
  await page
    .getByText("Preview execution cancelled.", { exact: true })
    .waitFor();
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    "Keep this unapplied draft",
  );
  await appendFile(
    join(replacement, "next.config.allstudio-original.ts"),
    '\nthrow new Error("ALLSTUDIO_STARTUP_DIAGNOSTIC_TEST");\n',
  );
  await application.evaluate(() => {
    globalThis.cancelRun = false;
  });
  await toolbar(page, "Open project");
  await expect(page.locator(".project-status")).toContainText(
    "ALLSTUDIO_STARTUP_DIAGNOSTIC_TEST",
    { timeout: 60_000 },
  );
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    "Keep this unapplied draft",
  );
  await expect(preview.locator("h1")).toHaveText("Saved locally");
  await application.evaluate(() => {
    globalThis.nextFolder = undefined;
  });
  pass(
    "cancelled integration, denied execution and failed replacement startup retain preview and draft; errors include child diagnostics",
  );
  await page.getByLabel("Text", { exact: true }).fill("Saved locally");
  pass(
    "cancelling folder selection retains the current project and unapplied draft",
  );
  await toolbar(page, "Undo saved edit");
  await expect
    .poll(() => preview.locator("h1").innerText(), { timeout: 30_000 })
    .toBe(originalHeading);
  assert.equal(await readFile(sourceFile, "utf8"), original);
  await toolbar(page, "Redo saved edit");
  await preview
    .getByRole("heading", { name: "Saved locally", exact: true })
    .waitFor({ timeout: 30_000 });
  assert.equal(await readFile(sourceFile, "utf8"), saved);
  pass("session undo and redo persist actual source and refresh the preview");

  await preview.locator("h1").click();
  await page
    .getByLabel("Text", { exact: true })
    .fill("Must not overwrite external edit");
  const external = `${saved}\n// External editor change\n`;
  await writeFile(sourceFile, external);
  await page
    .getByText(/Project files changed|source file changed/)
    .waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Apply text", exact: true }).click();
  await page
    .getByText(/file changed since this element was selected/)
    .waitFor();
  assert.equal(await readFile(sourceFile, "utf8"), external);
  pass(
    "file watching detects external change; a stale save is non-destructive",
  );

  const outsideDir = join(evidence, "outside-dir");
  await mkdir(outsideDir);
  const outside = join(outsideDir, "outside.tsx");
  await writeFile(outside, '<p data-oid="outside">Private outside source</p>');
  await symlink(outside, join(project, "src/escape.tsx"));
  await link(outside, join(project, "src/hardlink.tsx"));
  await symlink(outsideDir, join(project, "src/escape-dir"), "dir");
  for (const path of [
    "../outside.tsx",
    "src/../outside.tsx",
    "src//app/page.tsx",
    "src/./app/page.tsx",
    "src\\app\\page.tsx",
    outside,
    "src/escape.tsx",
    "src/hardlink.tsx",
    "src/escape-dir/outside.tsx",
    "next.config.ts",
  ]) {
    const result = await page.evaluate(
      ([id, selected, target]) =>
        window.allstudio.applyTextEdit(id, {
          path: target,
          oid: selected,
          expectedSha256: "0".repeat(64),
          text: "unsafe",
        }),
      [info.id, oid, path],
    );
    assert.equal(result.ok, false, path);
    assert.equal(result.reason, "path-rejected", path);
  }
  assert.equal(
    await readFile(outside, "utf8"),
    '<p data-oid="outside">Private outside source</p>',
  );
  const unauthorized = await page.evaluate(
    (selected) => window.allstudio.locate("0".repeat(64), selected),
    oid,
  );
  assert.equal(unauthorized.reason, "unauthorized");
  pass(
    "IPC denies traversal, symlink/hardlink escapes, config writes and ungranted project IDs",
  );
  // Remove the deliberate escapes before asking the real compiler to rebuild.
  for (const name of ["escape.tsx", "hardlink.tsx", "escape-dir"])
    await rm(join(project, "src", name));

  const frame = page
    .frames()
    .find((item) => item.url().startsWith("http://127.0.0.1:"));
  assert.ok(frame);
  const attack = await frame.evaluate(() => {
    let ipcDenied = false,
      parentDenied = false;
    try {
      require("electron").ipcRenderer.invoke("allstudio:project", {
        action: "recent",
      });
    } catch {
      ipcDenied = true;
    }
    try {
      window.parent.allstudio.recent();
    } catch {
      parentDenied = true;
    }
    return {
      ipcDenied,
      parentDenied,
      api: typeof window.allstudio,
      process: typeof window.process,
    };
  });
  assert.deepEqual(attack, {
    ipcDenied: true,
    parentDenied: true,
    api: "undefined",
    process: "undefined",
  });
  const frameIpc = await frame.evaluate(async () =>
    typeof window.testFrameIpc === "function"
      ? window.testFrameIpc()
      : "unavailable",
  );
  assert.ok(frameIpc === "denied" || frameIpc === "unavailable");
  pass(`subframe IPC probe: ${frameIpc}`);
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
  await frame.evaluate(() => {
    window.location.href = "http://127.0.0.1:9/untrusted";
  });
  assert.deepEqual(await application.evaluate(() => globalThis.frameAttempt), {
    url: "http://127.0.0.1:9/untrusted",
    denied: true,
  });
  assert.ok(
    frame.url().startsWith("http://127.0.0.1:") && !frame.url().includes(":9/"),
  );
  pass(
    "actual preview content cannot use Node/IPC, reach the parent bridge or navigate to another origin",
  );
  const origins = await application.evaluate(() => globalThis.requestedOrigins);
  assert.equal(
    origins.some((origin) => /clerk|railway/i.test(origin)),
    false,
  );
  await writeFile(
    join(evidence, "requested-origins.json"),
    JSON.stringify(origins, null, 2),
  );
  pass(
    "no Clerk/Railway requests; local editing makes no model-provider requests",
  );
  await page.screenshot({ path: join(evidence, "saved.png") });
  await application
    .context()
    .tracing.stop({ path: join(evidence, "edit-trace.zip") });
  await application.close();
  application = undefined;
  page = await launch();
  await toolbar(page, "Reopen");
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60_000 });
  await page
    .frameLocator('iframe[title="Project preview"]')
    .getByRole("heading", { name: "Saved locally", exact: true })
    .waitFor();
  assert.equal(await readFile(sourceFile, "utf8"), external);
  assert.deepEqual(
    await application.evaluate(() => globalThis.testDialogs),
    [],
  );
  pass("quit, reopen recent project and inspect persisted source");
  await application
    .context()
    .tracing.stop({ path: join(evidence, "reopen-trace.zip") });
  const reopenedPreview = page.frameLocator('iframe[title="Project preview"]');
  await reopenedPreview.locator("h1").click();
  await page.getByLabel("Text", { exact: true }).fill("Recovered local edit");
  const beforeCrash = await readFile(sourceFile, "utf8");
  orphanPid = await application.evaluate(() => globalThis.previewPid);
  assert.ok(orphanPid, "The preview must be a separately owned process group");
  // Pause the real helper at its existing commit handshake, without production test hooks.
  await application.evaluate(() => {
    globalThis.commitHeld = false;
    const childProcess = process.getBuiltinModule("node:child_process");
    const originalSpawn = childProcess.spawn;
    childProcess.spawn = (...args) => {
      const child = originalSpawn(...args);
      if (
        String(args[0]).endsWith("/files") &&
        args[1]?.[0] === "write" &&
        args[1]?.[2]?.startsWith("src/")
      ) {
        const end = child.stdin.end.bind(child.stdin);
        child.stdin.end = (value, ...rest) => {
          if (value === "C") {
            globalThis.commitHeld = true;
            return child.stdin;
          }
          return end(value, ...rest);
        };
      }
      return child;
    };
    process.getBuiltinModule("node:module").syncBuiltinESMExports();
  });
  await page.getByRole("button", { name: "Apply text", exact: true }).click();
  await expect
    .poll(() => application.evaluate(() => globalThis.commitHeld), {
      timeout: 7000,
    })
    .toBe(true);
  assert.equal(await readFile(sourceFile, "utf8"), beforeCrash);
  await page.screenshot({ path: join(evidence, "interrupted.png") });
  const mainProcess = application.process();
  const exited = once(mainProcess, "exit");
  mainProcess.kill("SIGKILL");
  await exited;
  application = undefined;
  await expect
    .poll(
      () => {
        try {
          return execFileSync("ps", ["-p", String(orphanPid), "-o", "stat="], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          })
            .trim()
            .startsWith("Z");
        } catch {
          return true;
        }
      },
      { timeout: 8000 },
    )
    .toBe(true);
  orphanPid = undefined;
  assert.equal(await readFile(sourceFile, "utf8"), beforeCrash);
  pass(
    "forced Electron termination before commit retains source and stops the orphan preview",
  );
  page = await launch();
  await toolbar(page, "Reopen");
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60_000 });
  await page
    .frameLocator('iframe[title="Project preview"]')
    .getByRole("heading", { name: "Recovered local edit", exact: true })
    .waitFor({ timeout: 30_000 });
  const recovered = await readFile(sourceFile, "utf8");
  assert.equal(
    recovered,
    beforeCrash.replace("Saved locally", "Recovered local edit"),
  );
  assert.deepEqual(
    await application.evaluate(() =>
      globalThis.testDialogs.map((item) => item.message),
    ),
    ["An interrupted save needs review"],
  );
  pass(
    "restart restores the durable pending edit while retaining the external change",
  );
  await application
    .context()
    .tracing.stop({ path: join(evidence, "recovery-trace.zip") });
  await toolbar(page, "Close project");
  await expect(
    page.getByRole("button", { name: "Reopen", exact: true }),
  ).toBeEnabled();
  const runMarker = join(project, "run-consent-marker");
  await appendFile(
    join(project, "next.config.allstudio-original.ts"),
    `\nimport { writeFileSync as recordRunConsent } from "node:fs";\nrecordRunConsent(${JSON.stringify(runMarker)}, "ran");\n`,
  );
  await application.evaluate(() => {
    globalThis.cancelRun = true;
  });
  await toolbar(page, "Reopen");
  await page
    .getByText("Preview execution cancelled.", { exact: true })
    .waitFor();
  await assert.rejects(access(runMarker), (error) => error.code === "ENOENT");
  assert.equal(await readFile(sourceFile, "utf8"), recovered);
  pass(
    "changed config invalidates remembered execution permission; Cancel executes no project code",
  );
  await application.evaluate(() => {
    globalThis.cancelRun = false;
  });
  await toolbar(page, "Reopen");
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60_000 });
  assert.equal(await readFile(runMarker, "utf8"), "ran");
  assert.equal(
    (await application.evaluate(() => globalThis.testDialogs)).filter(
      (item) => item.message === "Run this project's preview?",
    ).length,
    2,
  );
  pass(
    "explicit reapproval runs the changed project and remembers the new fingerprint",
  );
  const liveBefore = await readFile(sourceFile, "utf8");
  const liveAfter = `${liveBefore}\n// Recovered while preview was alive\n`;
  const journal = join(
    profile,
    "recovery",
    info.id,
    `${createHash("sha256").update("src/app/page.tsx").digest("hex")}.json`,
  );
  await writeFile(
    journal,
    JSON.stringify({
      schema: 1,
      path: "src/app/page.tsx",
      before: Buffer.from(liveBefore).toString("base64"),
      after: Buffer.from(liveAfter).toString("base64"),
    }),
    { mode: 0o600 },
  );
  await page
    .frameLocator('iframe[title="Project preview"]')
    .locator("h1")
    .click();
  await page
    .getByLabel("Text", { exact: true })
    .fill("Retain draft on cancelled recovery");
  await application.evaluate(() => {
    globalThis.cancelRecovery = true;
  });
  await toolbar(page, "Reopen");
  await expect(page.locator(".project-status")).toContainText(
    "Recovery cancelled.",
  );
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    "Retain draft on cancelled recovery",
  );
  assert.equal(await readFile(sourceFile, "utf8"), liveBefore);
  await application.evaluate(() => {
    globalThis.cancelRecovery = false;
  });
  await toolbar(page, "Reopen");
  await expect(
    page.getByRole("button", { name: "Reopen", exact: true }),
  ).toBeEnabled();
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60_000 });
  assert.equal(await readFile(sourceFile, "utf8"), liveAfter);
  await assert.rejects(access(journal), (error) => error.code === "ENOENT");
  pass(
    "reopening a live project handles pending recovery; Cancel retains its draft and later Restore succeeds",
  );
  await toolbar(page, "Close project");
  await expect(
    page.getByRole("button", { name: "Reopen", exact: true }),
  ).toBeEnabled();
  if (offline) {
    console.log(
      "NOT RUN in this manual offline gate: production next build. An earlier attempt failed on the fixture's remote Google fonts; online portability is tested separately.",
    );
  } else {
    const nextBin = createRequire(join(project, "package.json")).resolve(
      "next/dist/bin/next",
    );
    const built = await promisify(execFile)(
      process.execPath,
      [nextBin, "build"],
      {
        cwd: project,
        env: {
          PATH: process.env.PATH ?? "/usr/bin:/bin",
          NODE_ENV: "production",
          NEXT_TELEMETRY_DISABLED: "1",
          CI: "1",
        },
        timeout: 90_000,
        maxBuffer: 32 * 1024 * 1024,
      },
    );
    await writeFile(
      join(evidence, "standalone-build.log"),
      built.stdout + built.stderr,
    );
    const html = await readFile(
      join(project, ".next/server/app/index.html"),
      "utf8",
    );
    assert.ok(html.includes("Recovered local edit"));
    assert.ok(!html.includes('data-oid="p:'));
    pass(
      "edited project builds outside Electron with the config wrapper inactive and no preview attributes",
    );
  }
  console.log(`${checks} local-workflow checks passed. Evidence: ${evidence}`);
} catch (error) {
  if (application) {
    console.error(
      "Picker result:",
      await application
        .evaluate(() => globalThis.lastPickerResult)
        .catch(() => "unavailable"),
    );
    console.error(
      "Project diagnostics:",
      await application
        .evaluate(() => globalThis.previewLogs)
        .catch(() => "unavailable"),
    );
    console.error("Evidence:", evidence);
    const page = await application.firstWindow().catch(() => null);
    if (page)
      console.error(
        "Desktop status:",
        await page
          .locator(".project-status")
          .textContent()
          .catch(() => "unavailable"),
      );
    if (page)
      await page
        .screenshot({ path: join(evidence, "failure.png") })
        .catch(() => {});
  }
  throw error;
} finally {
  if (occupied.listening) {
    occupied.closeAllConnections();
    await new Promise((resolve) => occupied.close(resolve));
  }
  if (application) await application.close();
  if (orphanPid) {
    try {
      process.kill(-orphanPid, "SIGKILL");
    } catch {
      /* Owned group already ended. */
    }
  }
}
