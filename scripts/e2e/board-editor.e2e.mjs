// Board editor walkthrough. Requires `bun run dev:studio` (port 5180).
// Usage: node scripts/e2e/board-editor.e2e.mjs [evidence-dir]
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const BASE = process.env.STUDIO_URL ?? "http://localhost:5180/";
const evidence = resolve(
  process.argv[2] ?? "docs/validation/evidence/board-editor",
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
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(evidence, `${name}.png`) });
};

const context = await browser.newContext({
  viewport: { width: 1600, height: 960 },
  colorScheme: "dark",
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

const canvas = page.getByTestId("board-canvas");
const layers = page.getByRole("tree", { name: "Layers" });
const layer = (name) =>
  layers.getByRole("treeitem").filter({ hasText: name }).first();
const nodeByText = (text) =>
  canvas.locator('[data-node-type="text"]', { hasText: text }).first();
const field = (name) =>
  page
    .getByRole("complementary", { name: "Inspector" })
    .getByRole("textbox", { name, exact: true });
const box = async (locator) => {
  const b = await locator.boundingBox();
  assert.ok(b, "element has a box");
  return b;
};

// 1. Create a file from a template; the editor opens on it.
await page.goto(BASE);
await page.getByRole("button", { name: "New file" }).click();
await page.getByRole("menuitem", { name: "Responsive set" }).click();
await expect(canvas).toBeVisible();
await expect(layer("Desktop — Home")).toBeVisible();
await expect(
  page.locator(".bx-frame-label", { hasText: "Mobile — Home" }),
).toBeVisible();
pass("template opens in the editor with frames, labels and layers");
await shot(page, "01-editor-overview-dark");

// 2. Select the headline on the canvas; inspector shows text controls.
await nodeByText("Ideas that").click();
await expect(page.getByTestId("selection-box")).toBeVisible();
await expect(layer("Ideas that").first()).toHaveAttribute(
  "aria-selected",
  "true",
);
await expect(page.getByRole("combobox", { name: "Font family" })).toBeVisible();
pass("canvas click selects the layer and syncs the layers tree");

// 3. Change font size through the inspector; the canvas re-renders.
await field("Size").fill("72");
await field("Size").press("Enter");
await expect(nodeByText("Ideas that")).toHaveCSS("font-size", "72px");
pass("inspector font size edits the rendered layer");
await shot(page, "02-text-selected-inspector-dark");

// 4. Drag a shape on the canvas; one undo step restores it, redo re-applies.
await layer("Orange sphere").locator(".bx-row-main").click();
const xBefore = await field("X").inputValue();
const sphere = await box(
  canvas.locator(`[data-node-id][data-selected="true"]`),
);
await page.mouse.move(
  sphere.x + sphere.width / 2,
  sphere.y + sphere.height / 2,
);
await page.mouse.down();
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(
    sphere.x + sphere.width / 2 + i * 9,
    sphere.y + sphere.height / 2 + i * 3,
  );
}
await page.mouse.up();
const xAfter = await field("X").inputValue();
assert.notEqual(xAfter, xBefore, "drag changed X");
pass(`drag moves the layer (X ${xBefore} → ${xAfter})`);
await canvas.focus();
await page.keyboard.press("Control+z");
await expect(field("X")).toHaveValue(xBefore);
await page.keyboard.press("Control+Shift+z");
await expect(field("X")).toHaveValue(xAfter);
pass("a whole drag is one undo step; redo re-applies it");

// 5. Resize from the south-east handle.
const wBefore = Number(await field("W").inputValue());
const handle = await box(page.locator(".bx-handle.h-se"));
await page.mouse.move(handle.x + 4, handle.y + 4);
await page.mouse.down();
await page.mouse.move(handle.x + 40, handle.y + 30, { steps: 6 });
await page.mouse.up();
const wAfter = Number(await field("W").inputValue());
assert.ok(wAfter > wBefore, `width grew ${wBefore} → ${wAfter}`);
pass("resize handle changes width");

// 6. Draw a rectangle inside the desktop frame: it nests under that frame.
const frame = await box(canvas.locator('[data-node-type="frame"]').first());
await page.keyboard.press("Escape");
await page.keyboard.press("r");
await page.mouse.move(
  frame.x + frame.width * 0.55,
  frame.y + frame.height * 0.75,
);
await page.mouse.down();
await page.mouse.move(
  frame.x + frame.width * 0.75,
  frame.y + frame.height * 0.9,
  { steps: 5 },
);
await page.mouse.up();
const rect = layers
  .getByRole("treeitem")
  .filter({ hasText: "Rectangle" })
  .first();
await expect(rect).toHaveAttribute("aria-level", "2");
await expect(rect).toHaveAttribute("aria-selected", "true");
pass("drawn rectangle is created inside the frame under the pointer");

// 7. Fill color via hex field.
await page
  .getByRole("textbox", { name: "Fill color", exact: true })
  .fill("#ff5a1f");
await page
  .getByRole("textbox", { name: "Fill color", exact: true })
  .press("Enter");
await expect(
  canvas.locator('[data-node-type="rect"][data-selected="true"]'),
).toHaveCSS("background-color", "rgb(255, 90, 31)");
pass("fill color edit renders on canvas");

// 8. Text tool: click, type, commit.
await page.keyboard.press("t");
await page.mouse.click(
  frame.x + frame.width * 0.1,
  frame.y + frame.height * 0.85,
);
await page.keyboard.type("Hello from allstudio");
await page.keyboard.press("Escape");
await expect(nodeByText("Hello from allstudio")).toBeVisible();
await expect(layer("Hello from allstudio")).toBeVisible();
pass("text tool creates and edits a text layer inline");

// 9. Image upload (generated PNG) becomes an image layer.
const png = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 200;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 320, 200);
  grad.addColorStop(0, "#ffb27a");
  grad.addColorStop(1, "#3d7bff");
  g.fillStyle = grad;
  g.fillRect(0, 0, 320, 200);
  return c.toDataURL("image/png").split(",")[1];
});
await page.getByTestId("image-input").setInputFiles({
  name: "gradient.png",
  mimeType: "image/png",
  buffer: Buffer.from(png, "base64"),
});
await expect(layer("gradient")).toBeVisible();
await expect(canvas.locator('[data-node-type="image"] img')).toHaveCount(1);
pass("image upload inserts an inline image layer");

// 10. Copy/paste, then delete.
const count = async () => layers.getByRole("treeitem").count();
const beforePaste = await count();
await canvas.focus();
await page.keyboard.press("Control+d");
await expect.poll(count).toBe(beforePaste + 1);
await page.keyboard.press("Delete");
await expect.poll(count).toBe(beforePaste);
pass("duplicate (⌘D) and delete update the layer tree");

// 11. Frame selection (⌘G) wraps layers in a new frame.
await layer("Hello from allstudio").locator(".bx-row-main").click();
await layer("gradient")
  .locator(".bx-row-main")
  .click({ modifiers: ["Shift"] });
await canvas.focus();
await page.keyboard.press("Control+g");
await expect(
  layers
    .getByRole("treeitem")
    .filter({ hasText: /^Frame$/ })
    .first(),
).toBeVisible();
pass("⌘G frames the selection");
await shot(page, "03-editing-session-dark");

// 12. Pages: add, rename via double-click, switch.
await page.getByRole("tab", { name: "Pages" }).click();
await page.getByRole("button", { name: "Add page" }).click();
await page.locator(".bx-row-main", { hasText: "Page 2" }).dblclick();
await page.getByRole("textbox", { name: "Page name" }).fill("Explorations");
await page.getByRole("textbox", { name: "Page name" }).press("Enter");
await expect(page.locator(".bx-row", { hasText: "Explorations" })).toHaveClass(
  /active/,
);
await expect(page.locator(".bx-empty")).toBeVisible();
pass("pages can be added, renamed and switched");
await page.keyboard.press("f");
const c = await box(canvas);
await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
await expect(
  page.locator(".bx-frame-label", { hasText: "Frame" }),
).toBeVisible();
await shot(page, "04-pages-panel-dark");

// 13. Agent tab is honest and its quick actions are local.
await page.getByRole("tab", { name: "Agent" }).click();
await expect(page.getByText("Agent isn't connected")).toBeVisible();
await page.getByRole("button", { name: "Add mobile + desktop frames" }).click();
await expect(
  page.locator(".bx-frame-label", { hasText: "Mobile" }),
).toBeVisible();
pass("agent quick actions run locally");
await shot(page, "05-agent-tab-dark");

// 14. Autosave + reload: everything persisted.
await expect(page.locator(".bx-save")).toHaveText("Saved");
await page.reload();
await page.getByRole("tab", { name: "Pages" }).click();
await expect(
  page.locator(".bx-row", { hasText: "Explorations" }),
).toBeVisible();
await page.locator(".bx-row-main", { hasText: "Design" }).click();
await page.getByRole("tab", { name: "Layers" }).click();
await expect(nodeByText("Hello from allstudio")).toBeVisible();
await expect(nodeByText("Ideas that")).toHaveCSS("font-size", "72px");
pass("edits survive a reload (autosaved to the file store)");

// 15. Export downloads valid portable JSON.
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "Export", exact: true }).click(),
]);
const exported = JSON.parse(await readFile(await download.path(), "utf8"));
assert.equal(exported.schemaVersion, 1);
assert.equal(exported.pages.length, 2);
pass(`export downloads ${download.suggestedFilename()} (schema v1, 2 pages)`);

// 16. Dashboard thumbnail reflects the edited board.
await page.getByRole("button", { name: "App menu" }).click();
await page.getByRole("menuitem", { name: "Back to files" }).click();
await expect(
  page.locator(".file-card", { hasText: "Responsive set" }),
).toBeVisible();
pass("back to files from the app menu");
await shot(page, "06-home-after-editing-dark");

// 17. Light theme.
await page
  .locator(".file-card", { hasText: "Responsive set" })
  .locator(".file-card-open")
  .click();
await page.getByRole("button", { name: "Light theme" }).click();
await nodeByText("Ideas that").click();
await shot(page, "07-editor-light");
await page.getByRole("button", { name: "Dark theme" }).click();

assert.deepEqual(errors, [], `page errors:\n${errors.join("\n")}`);
pass("no page errors");
await context.close();
await browser.close();
console.log(`${checks} checks passed. Screenshots: ${evidence}`);
