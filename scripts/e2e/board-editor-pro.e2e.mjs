// Framer/Onlook-parity features walkthrough. Requires `bun run dev:studio`.
// Usage: node scripts/e2e/board-editor-pro.e2e.mjs [evidence-dir]
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const BASE = process.env.STUDIO_URL ?? "http://localhost:5180/";
const evidence = resolve(
  process.argv[2] ?? "docs/validation/evidence/board-editor-pro",
);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
let checks = 0;
const pass = (m) => {
  checks++;
  console.log(`PASS ${m}`);
};
const context = await browser.newContext({
  viewport: { width: 1600, height: 960 },
  colorScheme: "dark",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = async (name) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(evidence, `${name}.png`) });
};
const canvas = page.getByTestId("board-canvas");
const layers = page.getByRole("tree", { name: "Layers" });
const layer = (name) =>
  layers.getByRole("treeitem").filter({ hasText: name }).first();
const inspector = page.getByRole("complementary", { name: "Inspector" });
const field = (name) => inspector.getByRole("textbox", { name, exact: true });
const setField = async (name, value) => {
  await field(name).fill(String(value));
  await field(name).press("Enter");
};
const selectLayer = (name, shift = false) =>
  layer(name)
    .locator(".bx-row-main")
    .click(shift ? { modifiers: ["Shift"] } : undefined);
const box = async (l) => {
  const b = await l.boundingBox();
  assert.ok(b);
  return b;
};
const node = (name) => canvas.locator(`[data-node-id="${name}"]`);
const idOf = (name) => layer(name).getAttribute("data-layer-id");

// --- Landing template: context menu, palette, measurement, group resize ---
await page.goto(BASE);
await page.getByRole("button", { name: "New file" }).click();
await page.getByRole("menuitem", { name: "Landing page" }).click();
await expect(canvas).toBeVisible();

// Right-click a layer: it gets selected and the menu shows real shortcuts.
const sphere = await box(node(await idOf("Orange sphere")));
await page.mouse.click(
  sphere.x + sphere.width / 2,
  sphere.y + sphere.height / 2,
  { button: "right" },
);
const menu = page.getByRole("menu", { name: "Layer actions" });
await expect(menu).toBeVisible();
await expect(layer("Orange sphere")).toHaveAttribute("aria-selected", "true");
await expect(
  menu.getByRole("menuitem", { name: /Add auto layout/ }),
).toBeVisible();
await expect(menu.getByRole("menuitem", { name: /Duplicate/ })).toContainText(
  /D/,
);
await shot("01-context-menu");
await menu.getByRole("menuitem", { name: /Duplicate/ }).click();
await expect(
  layers.getByRole("treeitem").filter({ hasText: "Orange sphere" }),
).toHaveCount(2);
await page.keyboard.press("Control+z");
await expect(
  layers.getByRole("treeitem").filter({ hasText: "Orange sphere" }),
).toHaveCount(1);
pass("right-click selects, shows registry shortcuts, and runs commands");

// Command palette.
await page.keyboard.press("Control+k");
const palette = page.getByRole("dialog", { name: "Command palette" });
await expect(palette).toBeVisible();
await page.keyboard.type("align");
await shot("02-command-palette");
await page.keyboard.press("Escape");
await expect(palette).toBeHidden();
await selectLayer("Orange sphere");
await page.keyboard.press("Control+k");
await page.keyboard.type("align left");
await page.keyboard.press("Enter");
await expect(field("X")).toHaveValue("0");
pass("⌘K palette searches and runs commands (Align left inside the frame)");
await page.keyboard.press("Control+z");

// Alt measurement from the selection to a hovered layer.
await selectLayer("Orange sphere");
const pill = await box(node(await idOf("Blue pill")));
await page.mouse.move(pill.x + pill.width - 10, pill.y + pill.height - 10);
await page.keyboard.down("Alt");
await expect(page.locator(".bx-measure-label").first()).toBeVisible();
await shot("03-alt-measure");
await page.keyboard.up("Alt");
await expect(page.getByTestId("measurement")).toHaveCount(0);
pass("holding Alt shows distances to the hovered layer");

// Group resize: two layers scale with the selection box.
await selectLayer("Orange sphere");
await selectLayer("Blue pill", true);
const sphereW = (await box(node(await idOf("Orange sphere")))).width;
const se = await box(page.locator(".bx-handle.h-se"));
await page.mouse.move(se.x + 4, se.y + 4);
await page.mouse.down();
await page.mouse.move(se.x + 80, se.y + 40, { steps: 6 });
await page.mouse.up();
const sphereW2 = (await box(node(await idOf("Orange sphere")))).width;
assert.ok(
  sphereW2 > sphereW,
  `sphere grew with the group (${sphereW} → ${sphereW2})`,
);
pass("multi-selection resize scales every selected layer");

// Copy style / paste style.
await selectLayer("Button");
await page.keyboard.press("Control+Alt+c");
await selectLayer("Blue pill");
await page.keyboard.press("Control+Alt+v");
await expect(node(await idOf("Blue pill"))).toHaveCSS(
  "background-color",
  "rgb(17, 17, 17)",
);
pass("⌥⌘C / ⌥⌘V copies and pastes style");

// Independent corners, blur and blend mode.
await selectLayer("Button");
await inspector.getByRole("button", { name: "Independent corners" }).click();
await setField("TL", 0);
await expect(node(await idOf("Button"))).toHaveCSS(
  "border-top-left-radius",
  "0px",
);
await expect(node(await idOf("Button"))).toHaveCSS(
  "border-top-right-radius",
  "26px",
);
await setField("Blur", 4);
await expect(node(await idOf("Button"))).toHaveCSS("filter", "blur(4px)");
await inspector
  .getByRole("combobox", { name: "Blend mode" })
  .selectOption("multiply");
await expect(node(await idOf("Button"))).toHaveCSS(
  "mix-blend-mode",
  "multiply",
);
pass("per-corner radius, layer blur and blend mode render");
await shot("04-effects-inspector");

// Layer search.
await page.getByRole("textbox", { name: "Search layers" }).fill("sphere");
await expect(layers.getByRole("treeitem")).toHaveCount(2); // frame ancestor + match
await page.getByRole("textbox", { name: "Search layers" }).fill("");
pass("layer search filters and keeps ancestors");

// Distribute (3+ layers).
await selectLayer("Orange sphere");
await selectLayer("Blue pill", true);
await selectLayer("Button", true);
await expect(
  inspector.getByRole("button", { name: "Distribute horizontally" }),
).toBeVisible();
await inspector.getByRole("button", { name: "Distribute vertically" }).click();
pass("distribute appears for 3+ layers and runs");

// --- Auto layout on a fresh board ---
await page.getByRole("button", { name: "App menu" }).click();
await page.getByRole("menuitem", { name: "Back to files" }).click();
await page.getByRole("button", { name: "New file" }).click();
await page.getByRole("menuitem", { name: "Blank board" }).click();
await expect(page.locator(".bx-empty")).toBeVisible();
const c = await box(canvas);
for (const [i, w] of [
  [0, 120],
  [1, 80],
  [2, 160],
]) {
  await page.keyboard.press("r");
  const x = c.x + 300 + i * 50;
  const y = c.y + 200 + i * 130;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + w, y + 60, { steps: 3 });
  await page.mouse.up();
}
await canvas.click({ position: { x: 20, y: 20 } });
await page.keyboard.press("Control+a");
await page.keyboard.press("Shift+A");
await expect(inspector.getByRole("group", { name: "Direction" })).toBeVisible();
const kids = layers.getByRole("treeitem").filter({ hasText: "Rectangle" });
await expect(kids).toHaveCount(3);
await expect(kids.first()).toHaveAttribute("aria-level", "2");
pass("⇧A wraps siblings in an auto-layout frame (inferred column)");

const rects = canvas.locator('[data-node-type="rect"]');
const lefts = async () =>
  Promise.all(
    [0, 1, 2].map(async (i) => Math.round((await box(rects.nth(i))).x)),
  );
const tops = async () =>
  Promise.all([0, 1, 2].map(async (i) => (await box(rects.nth(i))).y));
const l = await lefts();
assert.ok(
  l.every((v) => v === l[0]),
  `column stack aligns lefts: ${l}`,
);
await setField("Gap", 40);
const t = await tops();
const h0 = (await box(rects.nth(0))).height;
const zoom =
  Number(
    (await page.getByTestId("zoom-level").textContent()).replace("%", ""),
  ) / 100;
assert.ok(
  Math.abs(t[1] - (t[0] + h0) - 40 * zoom) < 2,
  "gap of 40 between first two children",
);
pass("stack gap edit re-lays out children");
await inspector.getByRole("button", { name: "Horizontal stack" }).click();
const tops2 = await tops();
assert.ok(
  tops2.every((v) => Math.abs(v - tops2[0]) < 1),
  "row stack aligns tops",
);
pass("switching direction turns the column into a row");
await shot("05-auto-layout");

// Drag the first child past the last: live reorder inside the stack.
const firstId = await rects.nth(0).getAttribute("data-node-id");
const first = await box(rects.nth(0));
const last = await box(rects.nth(2));
await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
await page.mouse.down();
await page.mouse.move(last.x + last.width - 4, last.y + last.height / 2, {
  steps: 10,
});
await page.mouse.up();
const order = await rects.evaluateAll((els) =>
  els.map((e) => e.getAttribute("data-node-id")),
);
assert.equal(order.at(-1), firstId, "dragged child is now last");
const tops3 = await tops();
assert.ok(
  tops3.every((v) => Math.abs(v - tops3[0]) < 1),
  "still a tidy row after drop",
);
pass("dragging inside a stack reorders instead of free-moving");

// Persist.
await expect(page.locator(".bx-save")).toHaveText("Saved");
await page.reload();
await layer("Frame").locator(".bx-row-main").click();
await expect(inspector.getByRole("group", { name: "Direction" })).toBeVisible();
await expect(
  inspector.getByRole("button", { name: "Horizontal stack" }),
).toHaveAttribute("aria-pressed", "true");
pass("auto layout survives reload");

assert.deepEqual(errors, [], errors.join("\n"));
pass("no page errors");
await browser.close();
console.log(`${checks} checks passed. Screenshots: ${evidence}`);
