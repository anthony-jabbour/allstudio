// Chat / agent workspace walkthrough. Requires the studio dev server.
// Usage: STUDIO_URL=http://localhost:5181/ node scripts/e2e/studio-chat.e2e.mjs [evidence-dir]
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const BASE = process.env.STUDIO_URL ?? "http://localhost:5180/";
const evidence = resolve(
  process.argv[2] ?? "docs/validation/evidence/studio-chat",
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
const shot = async (page, name) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(evidence, `${name}.png`) });
};

async function session(colorScheme) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme,
  });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on(
    "console",
    (msg) => msg.type() === "error" && errors.push(msg.text()),
  );
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== new URL(BASE).origin && !url.protocol.startsWith("data"))
      requests.push(request.url());
  });
  return { context, page, errors, requests };
}

{
  const { context, page, errors, requests } = await session("light");
  await page.goto(BASE);
  await page.evaluate(() =>
    localStorage.setItem(
      "allstudio.settings.v1",
      JSON.stringify({ displayName: "Adarsh" }),
    ),
  );

  // Free plan: the chat surface is gated, nothing can be sent.
  await page.goto(`${BASE}#/chat`);
  await expect(
    page.getByRole("heading", { name: /What are we working on today/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chat is part of allstudio Pro" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Message Alli/ })).toHaveCount(
    0,
  );
  await expect(page.locator(".ch-suggestion").first()).toBeDisabled();
  await expect(page.locator(".ch-cast img")).toHaveCount(6);
  pass("free plan sees the welcome and the Pro gate, composer is locked");
  await shot(page, "01-chat-free-gate");

  // Preview Pro locally.
  await page.getByRole("button", { name: "Preview Pro locally" }).click();
  await expect(
    page.getByRole("textbox", { name: /Message Alli/ }),
  ).toBeVisible();
  await expect(page.getByText("Pro · local preview")).toBeVisible();
  pass("Pro preview unlocks the composer");
  await shot(page, "02-chat-welcome-pro");

  // Generate from a brief.
  const box = page.getByRole("textbox", { name: /Message Alli/ });
  await box.fill(
    "I want to create a homepage for a creative studio called “Lumen”. It should feel modern, bold, and minimal. Include a hero, some work sections, and a simple navigation.",
  );
  await box.press("Enter");
  await expect(page).toHaveURL(/#\/chat\/c_/);
  await expect(page.locator(".ch-step.active")).toBeVisible();
  pass("sending creates a chat and shows live plan progress");
  await page.waitForTimeout(1500);
  await shot(page, "03-chat-planning");
  await expect(page.locator(".ch-preview-card")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator(".ch-step.done")).toHaveCount(5);
  await expect(page.locator(".ch-panel")).toContainText("Lumen — Landing page");
  await expect(page.locator(".ch-recents")).toContainText(
    "I want to create a homepage",
  );
  pass("agent generates a real board, preview and activity panel update");
  await shot(page, "04-chat-generated");

  // Refine with quick actions.
  await page.getByRole("button", { name: "Refine" }).click();
  await expect(page.locator(".ch-msg.agent").last()).toContainText(
    "dark palette",
    { timeout: 10000 },
  );
  await page.getByRole("button", { name: "Add section" }).click();
  await expect(page.locator(".ch-msg.agent").last()).toContainText(
    "Selected work",
    { timeout: 10000 },
  );
  await expect(page.locator(".ch-activity li")).toHaveCount(4);
  pass("quick actions refine and extend the same board");
  await shot(page, "05-chat-refined");

  // Stop a run midway.
  await box.fill("Generate a mobile app for “Tally”");
  await box.press("Enter");
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.locator(".ch-msg.agent").last()).toContainText("Stopped.");
  pass("stop cancels the run");

  // Persistence across reload, then open the board in Studio.
  await page.reload();
  await expect(page.locator(".ch-msg")).toHaveCount(8);
  pass("conversation persists across reload");
  await page
    .locator(".ch-topbar")
    .getByRole("button", { name: /Open in Studio/ })
    .click();
  await expect(page).toHaveURL(/#\/file\//);
  await expect(page.getByText("Selected work").first()).toBeVisible();
  pass("Open in Studio shows the generated, edited board");

  if (errors.length) throw new Error(`console errors: ${errors.join("\n")}`);
  if (requests.length)
    throw new Error(`unexpected network: ${requests.join("\n")}`);
  pass("no console errors and no off-origin network requests");
  await context.close();
}

{
  const { context, page, errors } = await session("dark");
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.setItem("allstudio.plan", "pro");
    localStorage.setItem(
      "allstudio.settings.v1",
      JSON.stringify({ displayName: "Adarsh" }),
    );
  });
  await page.goto(`${BASE}#/chat`);
  await expect(
    page.getByRole("textbox", { name: /Message Alli/ }),
  ).toBeVisible();
  await shot(page, "06-chat-welcome-dark");
  await page.locator(".ch-suggestion").nth(2).click();
  await expect(page.locator(".ch-preview-card")).toBeVisible({
    timeout: 15000,
  });
  await shot(page, "07-chat-mobile-dark");
  pass("dark theme suggestion card generates a mobile board");
  if (errors.length) throw new Error(`console errors: ${errors.join("\n")}`);
  await context.close();
}

await browser.close();
console.log(`\n${checks} checks passed`);
