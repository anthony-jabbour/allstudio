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
const pass = (message) => {
  checks++;
  console.log(`PASS ${message}`);
};
const shot = (name) => page.screenshot({ path: join(evidence, `${name}.png`) });

let page;
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
  page = await application.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

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
  await expect(page.getByLabel("Appearance", { exact: true })).toHaveValue(
    "dark",
  );
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("Control+f");
  await expect(page.getByLabel("Search projects")).toBeFocused();
  await expect(page.getByLabel("Search files")).not.toBeFocused();
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
} finally {
  await application?.close().catch((error) => {
    console.error(`Could not close Electron: ${error.message}`);
  });
  await rm(userData, { recursive: true, force: true }).catch((error) => {
    console.error(`Could not remove E2E profile: ${error.message}`);
  });
}

console.log(`${checks} desktop Studio checks passed. Screenshots: ${evidence}`);
