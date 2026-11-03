import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron, expect } from "@playwright/test";

const desktop = resolve("apps/desktop");
const executablePath = process.argv[2];
if (executablePath) await access(executablePath);
else await access(join(desktop, "out/main/index.js"));
const evidence = join(desktop, "dist/evidence/studio");
await mkdir(evidence, { recursive: true });
const userData = await mkdtemp(join(tmpdir(), "allstudio-studio-"));
let application;
let checks = 0;
let page;
const errors = [];
const externalRequests = [];
let observeExternalRequests = false;
const pass = (message) => {
  checks++;
  console.log(`PASS ${message}`);
};
const shot = (name) => page.screenshot({ path: join(evidence, `${name}.png`) });
const launch = () =>
  _electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: [
      ...(executablePath ? [] : [desktop]),
      `--user-data-dir=${userData}`,
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    ],
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: "1" },
    timeout: 30_000,
  });
const observePage = (target) => {
  target.on("pageerror", (error) => errors.push(error.message));
  target.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  target.on("request", (request) => {
    if (!observeExternalRequests) return;
    const url = new URL(request.url());
    if (url.protocol === "http:" || url.protocol === "https:")
      externalRequests.push(url.href);
  });
};

try {
  application = await launch();
  page = await application.firstWindow();
  observePage(page);

  await expect(page.getByRole("heading", { name: "Recents" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Website projects", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Account and appearance" }).click();
  await page.getByRole("menuitem", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await shot("home-paper");
  pass("Electron starts in the shared Paper-style Studio Home");

  await page.getByRole("button", { name: "New file" }).click();
  await page.getByRole("menuitem", { name: "Responsive set" }).click();
  const canvas = page.getByTestId("board-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.locator(".bx-editor")).toHaveCSS("display", "grid");
  const layers = page.getByRole("tree", { name: "Layers" });
  const headline = canvas
    .locator('[data-node-type="text"]', {
      hasText: "Ideas that",
    })
    .first();
  await headline.click();
  const size = page
    .getByRole("complementary", { name: "Inspector" })
    .getByRole("textbox", { name: "Size", exact: true });
  await size.fill("72");
  await size.press("Enter");
  await expect(headline).toHaveCSS("font-size", "72px");
  await expect(page.locator(".bx-editor")).toHaveAttribute(
    "data-save-state",
    "saving",
  );
  await expect(page.locator(".bx-editor")).toHaveAttribute(
    "data-save-state",
    "saved",
  );
  await expect(
    layers.getByRole("treeitem").filter({ hasText: "Ideas that" }).first(),
  ).toHaveAttribute("aria-selected", "true");
  await shot("board-editor");
  pass(
    "Electron opens the shared board editor and applies a real inspector edit",
  );

  await page.reload();
  await expect(canvas).toBeVisible();
  await headline.click();
  await expect(size).toHaveValue("72");
  const x = page
    .getByRole("complementary", { name: "Inspector" })
    .getByRole("textbox", { name: "X", exact: true });
  const savedX = await x.inputValue();
  pass("board edits persist through an Electron renderer reload");

  await page.getByRole("button", { name: "App menu" }).click();
  await page.getByRole("menuitem", { name: "Website projects" }).click();
  await expect(
    page.getByRole("button", { name: "Open project", exact: true }),
  ).toBeVisible();
  const runtime = await page.evaluate(() => window.allstudio.runtime());
  assert.equal(runtime.electron, "45.0.0");
  await page.evaluate(() => window.allstudio.recent());
  await expect(page.locator(".desktop-status:visible")).toHaveCount(0);
  await expect(
    page.getByText("Recent projects could not be read", { exact: false }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Appearance", { exact: true })).toHaveValue(
    "dark",
  );
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("Control+f");
  await expect(page.getByLabel("Search projects")).toBeFocused();
  await page.getByRole("heading", { name: "Home", exact: true }).click();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  await page.keyboard.press("ArrowRight");
  await shot("website-projects");
  pass(
    "the shared Electron shell enters the existing source-backed website editor",
  );

  await page.getByRole("button", { name: "Back to Studio" }).click();
  await expect(canvas).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(headline).toHaveCSS("font-size", "72px");
  await expect(
    layers.getByRole("treeitem").filter({ hasText: "Ideas that" }).first(),
  ).toHaveAttribute("aria-selected", "true");
  await expect(x).toHaveValue(savedX);
  assert.deepEqual(errors, [], `renderer errors: ${errors.join("\n")}`);
  pass("switching back preserves the board editor state without remounting it");

  await page.getByRole("button", { name: "App menu" }).click();
  await page.getByRole("menuitem", { name: "Studio home" }).click();
  await expect(
    page.getByRole("link", { name: "Chat", exact: true }),
  ).toBeVisible();
  observeExternalRequests = true;
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chat is part of allstudio Pro" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Message Alli/ })).toHaveCount(
    0,
  );
  await expect(page.locator(".chat-app")).toHaveCSS("display", "grid");
  await page.getByRole("button", { name: "Preview Pro locally" }).click();
  await expect(
    page.getByRole("textbox", { name: /Message Alli/ }),
  ).toBeVisible();
  const chatBox = page.getByRole("textbox", { name: /Message Alli/ });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "allstudio.chats.v1") {
        Storage.prototype.setItem = original;
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await chatBox.fill("This message should show a storage error.");
  await chatBox.press("Enter");
  await expect(page.getByText(/Chat storage is full/i)).toBeVisible();
  await expect(chatBox).toHaveValue(
    "This message should show a storage error.",
  );
  await expect(page.locator(".ch-msg.user")).toHaveCount(0);
  await expect(page.locator(".ch-recents a")).toHaveCount(0);
  await chatBox.fill(
    "I want to create a homepage for a creative studio called “Lumen”. It should feel modern, bold, and minimal. Include a hero, some work sections, and a simple navigation.",
  );
  await chatBox.press("Enter");
  await expect(page).toHaveURL(/#\/chat\/c_/);
  await expect(page.locator(".ch-preview-card").last()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(".ch-panel")).toContainText("Lumen — Landing page");
  await page.getByRole("button", { name: "Refine" }).click();
  await expect(page.locator(".ch-msg.agent").last()).toContainText(
    "dark palette",
    { timeout: 10_000 },
  );
  await page.getByRole("button", { name: "Add section" }).click();
  await expect(page.locator(".ch-msg.agent").last()).toContainText(
    "Selected work",
    { timeout: 10_000 },
  );
  await shot("chat-generated");
  pass("Electron hosts the shared local Chat UI and generates a real board");

  await page.reload();
  await expect(page.locator(".ch-msg.user").first()).toContainText(
    "I want to create a homepage",
  );
  await expect(page.locator(".ch-preview-card").last()).toBeVisible();
  await page
    .locator(".ch-topbar")
    .getByRole("button", { name: /Open in Studio/ })
    .click();
  await expect(page).toHaveURL(/#\/file\//);
  await expect(page.locator(".bx-editor")).toBeVisible();
  await expect(page.getByText("Selected work").first()).toBeVisible();
  pass(
    "chat board opens in the shared Studio editor and survives renderer reload",
  );

  await application.close();
  application = await launch();
  page = await application.firstWindow();
  observePage(page);
  await expect(page.getByRole("heading", { name: "Recents" })).toBeVisible();
  await page.getByRole("link", { name: "Studio home" }).click();
  await page.getByRole("link", { name: "Chat", exact: true }).click();
  const recentChat = page.locator(".ch-recents").getByRole("link").first();
  await expect(recentChat).toContainText("I want to create a homepage");
  await recentChat.click();
  await expect(page.locator(".ch-msg.user").first()).toContainText(
    "I want to create a homepage",
  );
  await expect(page.locator(".ch-preview-card").last()).toBeVisible();
  await page
    .locator(".ch-topbar")
    .getByRole("button", { name: /Open in Studio/ })
    .click();
  await expect(page.locator(".bx-editor")).toBeVisible();
  await expect(page.getByText("Selected work").first()).toBeVisible();
  assert.deepEqual(
    externalRequests,
    [],
    `off-origin requests: ${externalRequests.join("\n")}`,
  );
  assert.deepEqual(errors, [], `renderer errors: ${errors.join("\n")}`);
  pass(
    "Chat transcript and board survive Electron restart with no external requests",
  );

  await page.evaluate(() => {
    const index = JSON.parse(
      localStorage.getItem("allstudio.files.v1") ?? "[]",
    );
    localStorage.setItem(
      "allstudio.files.v1",
      JSON.stringify(index.filter((file) => file.id !== "scratchpad")),
    );
    localStorage.setItem("allstudio.board.scratchpad", "not a board document");
  });
  await page.reload();
  await page.getByRole("button", { name: "App menu" }).click();
  await page.getByRole("menuitem", { name: "Studio home" }).click();
  const damagedScratchpad = page.getByRole("link", {
    name: "Scratchpad (damaged)",
    exact: true,
  });
  await expect(damagedScratchpad).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Website projects", exact: true }),
  ).toBeVisible();
  await damagedScratchpad.click();
  await expect(
    page.getByRole("heading", { name: "This file can’t be opened" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(/damaged/i);
  assert.deepEqual(errors, [], `renderer errors: ${errors.join("\n")}`);
  pass(
    "damaged scratchpad data remains preserved and opens a recovery message",
  );
} finally {
  await application?.close().catch((error) => {
    console.error(`Could not close Electron: ${error.message}`);
  });
  await rm(userData, { recursive: true, force: true }).catch((error) => {
    console.error(`Could not remove E2E profile: ${error.message}`);
  });
}

console.log(`${checks} desktop Studio checks passed. Screenshots: ${evidence}`);
