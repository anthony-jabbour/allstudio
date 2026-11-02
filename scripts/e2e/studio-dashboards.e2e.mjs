// Studio dashboards walkthrough. Requires `bun run dev:studio` (port 5180).
// Usage: node scripts/e2e/studio-dashboards.e2e.mjs [evidence-dir]
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const BASE = process.env.STUDIO_URL ?? "http://localhost:5180/";
const evidence = resolve(
  process.argv[2] ?? "docs/validation/evidence/studio-dashboards",
);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
let checks = 0;
const pass = (message) => {
  checks++;
  console.log(`PASS ${message}`);
};

async function session(colorScheme) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return { context, page, errors };
}

// Thumbnails size themselves after layout (ResizeObserver); let them settle.
const shot = async (page, name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(evidence, `${name}.png`) });
};

// --- Dark theme: Paper-style home ---------------------------------------
{
  const { context, page, errors } = await session("dark");
  await page.goto(BASE);
  await expect(page.getByRole("heading", { name: "Recents" })).toBeVisible();
  const scratch = page.locator('[data-file-id="scratchpad"]');
  await expect(scratch).toContainText("Your permanent draft");
  pass("home shows the permanent scratchpad");

  // Create from template through the New file menu.
  for (const template of ["Landing page", "Mobile app", "Moodboard"]) {
    await page.getByRole("button", { name: "New file" }).click();
    await page.getByRole("menuitem", { name: template }).click();
    await expect(page).toHaveURL(/#\/file\//);
    await page.goto(BASE);
  }
  await expect(page.locator(".file-card")).toHaveCount(4);
  await expect(page.locator(".file-card").nth(1)).toContainText("Moodboard");
  pass("New file creates persisted files, newest first after the scratchpad");
  await expect(page.locator('.file-card [role="img"]').first()).toBeVisible();
  pass("cards render real board thumbnails");
  await shot(page, "01-home-recents-dark");

  // Rename via card menu.
  const landing = page.locator(".file-card", { hasText: "Landing page" });
  await landing.hover();
  await landing.getByRole("button", { name: /Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill("Lumen — Homepage");
  await page.getByRole("button", { name: "Rename" }).click();
  await expect(
    page.locator(".file-card", { hasText: "Lumen — Homepage" }),
  ).toBeVisible();
  pass("rename persists through the store");

  // Search with ⌘F focus.
  await page.keyboard.press("Control+f");
  await expect(page.getByLabel("Search files")).toBeFocused();
  await page.keyboard.type("lumen");
  await expect(page.locator(".file-card")).toHaveCount(1);
  pass("⌘F focuses search and filters files");
  await page.getByLabel("Search files").fill("");

  // List view.
  await page.getByRole("button", { name: "List view" }).click();
  await expect(page.locator(".file-table tbody tr")).toHaveCount(4);
  await shot(page, "02-home-list-dark");
  await page.getByRole("button", { name: "Grid view" }).click();
  pass("grid/list toggle");

  // Archive and restore.
  const mood = page.locator(".file-card", { hasText: "Moodboard" });
  await mood.hover();
  await mood.getByRole("button", { name: /Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Move to archive" }).click();
  await expect(page.locator(".file-card")).toHaveCount(3);
  await page
    .getByRole("link", { name: /Archive/ })
    .first()
    .click();
  await expect(
    page.locator(".file-card", { hasText: "Moodboard" }),
  ).toBeVisible();
  await shot(page, "03-home-archive-dark");
  pass("archive moves files out of Recents into Archive");

  // Reload: everything survived in local storage.
  await page.goto(`${BASE}#/`);
  await page.reload();
  await expect(page.locator(".file-card")).toHaveCount(3);
  await expect(
    page.locator(".file-card", { hasText: "Lumen — Homepage" }),
  ).toBeVisible();
  pass("files survive reload");

  // Settings: display name drives the greeting.
  await page.goto(`${BASE}#/settings`);
  await page.getByLabel("Display name").fill("Anthony");
  await page.getByRole("button", { name: "Save" }).click();
  await shot(page, "04-settings-dark");

  // Framer-style inner Studio dashboard.
  await page.goto(`${BASE}#/studio`);
  await expect(
    page.getByRole("heading", {
      name: /^Good (morning|afternoon|evening), Anthony\.$/,
    }),
  ).toBeVisible();
  pass("studio greeting uses the saved display name and local time");
  await expect(page.locator(".project-card")).toHaveCount(2);
  await expect(page.locator(".template-card")).toHaveCount(4);
  await shot(page, "05-studio-home-dark");
  await page.locator(".ws-main").evaluate((el) => el.scrollTo(0, 2000));
  await shot(page, "06-studio-home-scrolled-dark");

  // Template → new project; then projects search.
  await page.getByRole("link", { name: "Templates", exact: true }).click();
  await page.locator('[data-template="responsive"]').click();
  await expect(page).toHaveURL(/#\/file\//);
  await page.goto(`${BASE}#/studio/projects`);
  await expect(page.locator(".project-card")).toHaveCount(4);
  await page.getByLabel("Search projects").fill("respon");
  await expect(page.locator(".project-card")).toHaveCount(1);
  pass("template creates a project; project search filters");

  // Hostile import is refused with a visible error.
  await page.goto(BASE);
  await page.getByTestId("import-input").setInputFiles({
    name: "evil.board.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        id: "x",
        name: "Evil",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        pages: [
          {
            id: "p",
            name: "P",
            background: "#000",
            nodes: [
              {
                id: "i",
                type: "image",
                name: "I",
                x: 0,
                y: 0,
                width: 1,
                height: 1,
                src: "https://tracker.example/pixel.png",
                fit: "cover",
              },
            ],
          },
        ],
      }),
    ),
  });
  await expect(page.locator(".toast.error")).toContainText("Import refused");
  pass("remote-image board import is refused");

  assert.deepEqual(errors, [], `page errors: ${errors.join("\n")}`);
  pass("no page errors (dark)");
  await context.close();
}

// --- Light theme pass --------------------------------------------------------
{
  const { context, page, errors } = await session("light");
  await page.goto(BASE);
  await page.getByRole("button", { name: "New file" }).click();
  await page.getByRole("menuitem", { name: "Responsive set" }).click();
  await page.goto(BASE);
  await shot(page, "07-home-recents-light");
  await page.goto(`${BASE}#/studio`);
  await shot(page, "08-studio-home-light");
  // Explicit theme override beats the system preference and persists.
  await page.goto(BASE);
  await page.getByRole("button", { name: "Account and appearance" }).click();
  await page.getByRole("menuitem", { name: "Dark theme" }).click();
  await page.reload();
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.theme),
    "dark",
  );
  pass("theme override persists across reload");
  assert.deepEqual(errors, []);
  await context.close();
}

await browser.close();
console.log(`${checks} checks passed. Screenshots: ${evidence}`);
