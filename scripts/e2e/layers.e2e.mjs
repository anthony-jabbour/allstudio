// Requires bun run dev with disposable fixture copies; no dependency installation.
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const evidence = await mkdtemp(join(tmpdir(), "allstudio-layers-e2e-"));
console.log(`Evidence: ${evidence}`);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1400, height: 1000 },
});
await context.addInitScript(() => {
  window.__layerMessages = [];
  window.addEventListener("message", (event) => {
    if (
      event.data?.source === "allstudio-preview" &&
      event.source === document.querySelector("iframe")?.contentWindow
    ) {
      window.__layerMessages.push(event.data);
      if (window.__layerMessages.length > 200) window.__layerMessages.shift();
    }
  });
});
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let checks = 0;
const pass = (message) => {
  checks++;
  console.log(`PASS ${message}`);
};
const tree = page.getByRole("tree", { name: "Rendered layers" });
const preview = page.frameLocator('iframe[title="Project preview"]');
const row = (oid, index = 0) =>
  tree.locator(`[data-source-oid="${oid}"]`).nth(index);
const lastLayers = () =>
  page.evaluate(() =>
    window.__layerMessages.findLast((x) => x.type === "layers"),
  );
const align = async (target) => {
  await expect
    .poll(async () => {
      const a = await target.boundingBox(),
        b = await page.locator(".selection-box").boundingBox();
      return a && b
        ? Math.max(
            ...["x", "y", "width", "height"].map((k) => Math.abs(a[k] - b[k])),
          )
        : Infinity;
    })
    .toBeLessThan(2);
};
const choose = async (fixture) => {
  await page.locator(".fixture-picker select").selectOption(fixture);
  await expect(tree).toBeVisible({ timeout: 60000 });
  await expect(tree.getByRole("treeitem").first()).toBeVisible();
};
try {
  await page.goto("http://localhost:5173/");
  await expect(tree).toBeVisible({ timeout: 5000 });
  await choose("aurora-atelier");
  const scrollReads = await preview.locator("body").evaluate(async (body) => {
    const bulk = document.createElement("div");
    for (let i = 0; i < 1000; i++) bulk.append(document.createElement("span"));
    body.append(bulk);
    const settle = () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      );
    await settle();
    const original = Element.prototype.getAttribute;
    let reads = 0;
    Element.prototype.getAttribute = function (name) {
      if (name === "data-oid") reads++;
      return original.call(this, name);
    };
    try {
      window.dispatchEvent(new Event("scroll"));
      await settle();
      return reads;
    } finally {
      Element.prototype.getAttribute = original;
      bulk.remove();
    }
  });
  assert.ok(
    scrollReads < 50,
    `layout-only scroll must not rescan the hierarchy (${scrollReads} OID reads)`,
  );
  pass("layout-only scroll avoids recollecting an unchanged hierarchy");

  const heading = preview.locator("h1");
  const headingOid = await heading.getAttribute("data-oid");
  const editedText = `Layer tree saved edit ${Date.now()}`;
  const before = await readFile(
    resolve("apps/playground/.workspace/aurora-atelier/src/app/page.tsx"),
    "utf8",
  );
  await row(headingOid).locator(":scope > .layer-row").click();
  await expect(row(headingOid)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("source-location")).toContainText(
    "src/app/page.tsx",
  );
  await align(heading);
  await heading.click();
  await expect(row(headingOid)).toHaveAttribute("aria-selected", "true");
  pass("canvas and tree select the same source-backed heading and rectangle");
  for (const target of [
    preview.locator("button").first(),
    preview.locator("main"),
  ]) {
    const oid = await target.getAttribute("data-oid");
    await row(oid).locator(":scope > .layer-row").click();
    await align(target);
    await expect(row(oid)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("source-location")).toContainText(
      "src/app/page.tsx",
    );
  }
  pass(
    "button and supported container select through the same source inspector",
  );
  await row(headingOid).locator(":scope > .layer-row").click();
  await page.getByLabel("Text", { exact: true }).fill(editedText);
  const root = tree.getByRole("treeitem").first();
  await root.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(root).toHaveAttribute("aria-expanded", "false");
  await expect(tree.getByRole("treeitem")).toHaveCount(1);
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    editedText,
  );
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(tree.getByRole("treeitem").nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(tree.getByRole("treeitem").last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(root).toBeFocused();
  assert.equal(
    await tree
      .getByRole("treeitem")
      .evaluateAll((xs) => xs.filter((x) => x.tabIndex === 0).length),
    1,
  );
  pass("tree keyboard navigation and disclosure preserve unapplied drafts");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(tree.getByRole("treeitem").last()).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
  await expect(root).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(tree.getByRole("treeitem").nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(root).toBeFocused();
  await row(headingOid).locator(":scope > .layer-row").click();
  await page.getByLabel("Text", { exact: true }).fill(editedText);

  await page
    .getByRole("button", { name: "Preview text patch", exact: true })
    .click();
  assert.equal(
    await readFile(
      resolve("apps/playground/.workspace/aurora-atelier/src/app/page.tsx"),
      "utf8",
    ),
    before,
  );
  await page.getByRole("button", { name: "Apply text", exact: true }).click();
  await expect(heading).toHaveText(editedText);
  await expect(row(headingOid)).toContainText(editedText);
  await expect(row(headingOid)).toHaveAttribute("aria-selected", "true");
  const after = await readFile(
    resolve("apps/playground/.workspace/aurora-atelier/src/app/page.tsx"),
    "utf8",
  );
  assert.ok(after.includes(editedText));
  assert.notEqual(after, before);
  await writeFile(join(evidence, "source-before.tsx"), before);
  await writeFile(join(evidence, "source-after.tsx"), after);
  await page.screenshot({ path: join(evidence, "layers.png") });
  pass(
    "tree-selected edit persists to real source and HMR updates the selected row",
  );

  await page
    .getByLabel("Text", { exact: true })
    .fill("Preserve this unsaved draft");
  const oldTree = await lastLayers();
  await preview.locator("body").evaluate((body) => {
    const node = document.createElement("div");
    node.setAttribute("data-oid", "runtime-added");
    node.textContent = "<img src=x onerror=alert(1)>";
    node.setAttribute("data-test-layer-added", "");
    body.append(node);
  });
  await page.evaluate(
    ({ nonce, generation, nodeId }) => {
      const iframe = document.querySelector("iframe");
      iframe.contentWindow.postMessage(
        {
          source: "allstudio-editor",
          version: 5,
          type: "select-layer",
          nonce,
          generation,
          nodeId,
        },
        new URL(iframe.src).origin,
      );
    },
    {
      nonce: oldTree.nonce,
      generation: oldTree.generation,
      nodeId: oldTree.nodes.find((x) => x.oid === headingOid).id,
    },
  );
  await expect(page.getByRole("alert")).toContainText("layer tree changed");
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    "Preserve this unsaved draft",
  );
  assert.equal(
    await readFile(
      resolve("apps/playground/.workspace/aurora-atelier/src/app/page.tsx"),
      "utf8",
    ),
    after,
  );
  pass(
    "stale layer generation is refused without changing selection, draft or source",
  );
  await expect(row("runtime-added")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  assert.equal(await tree.locator("img").count(), 0);

  const currentTree = await lastLayers();
  const sourceBeforeInvalid = await page
    .getByTestId("source-location")
    .textContent();
  const selectedBeforeInvalid = await tree
    .locator('[aria-selected="true"]')
    .getAttribute("data-layer-id");
  const editorRequests = [
    { nonce: "forged" },
    { version: 1 },
    { source: "untrusted" },
    { generation: 0 },
    { nodeId: "../private" },
    { path: "/private/file" },
    { type: "write-file" },
  ];
  await page.evaluate(
    ({ base, bad }) => {
      const iframe = document.querySelector("iframe");
      const request = {
        source: "allstudio-editor",
        version: 5,
        type: "select-layer",
        nonce: base.nonce,
        generation: base.generation,
        nodeId: base.nodes[0].id,
      };
      for (const fields of bad)
        iframe.contentWindow.postMessage(
          { ...request, ...fields },
          new URL(iframe.src).origin,
        );
      iframe.contentWindow.postMessage(
        { ...request, nodeId: "n999999999" },
        new URL(iframe.src).origin,
      );
    },
    { base: currentTree, bad: editorRequests },
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__layerMessages.findLast((x) => x.type === "layer-error")
            ?.reason,
      ),
    )
    .toBe("missing-layer");
  assert.equal(
    await tree.locator('[aria-selected="true"]').getAttribute("data-layer-id"),
    selectedBeforeInvalid,
  );
  assert.equal(
    await page.getByTestId("source-location").textContent(),
    sourceBeforeInvalid,
  );
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    "Preserve this unsaved draft",
  );
  pass(
    "malformed, stale-nonce and unauthorized layer commands cannot change selection or source",
  );
  const goodTree = await lastLayers();
  await preview.locator("body").evaluate((_body, base) => {
    parent.postMessage(
      {
        source: "allstudio-preview",
        version: 5,
        type: "layers",
        nonce: base.nonce,
        generation: base.generation + 1,
        truncated: false,
        nodes: Array.from({ length: 1001 }, (_, i) => ({
          id: `n${i + 1}`,
          parentId: null,
          oid: "untrusted",
          tagName: "div",
          label: "bad",
        })),
      },
      "http://localhost:5173",
    );
  }, goodTree);
  await expect(
    page.getByText("rejected a preview message (malformed)", { exact: false }),
  ).toBeVisible();
  await expect(row(headingOid)).toHaveAttribute("aria-selected", "true");
  pass(
    "oversized untrusted layer payload is rejected before replacing the tree",
  );

  await choose("lumen-notes");
  const repeated = await preview.locator("body").evaluate(() => {
    const all = [...document.querySelectorAll("[data-oid]")];
    return ["a", "article"]
      .map((tag) =>
        all
          .find(
            (el) =>
              el.tagName.toLowerCase() === tag &&
              all.filter(
                (x) =>
                  x.getAttribute("data-oid") === el.getAttribute("data-oid"),
              ).length > 1,
          )
          ?.getAttribute("data-oid"),
      )
      .filter(Boolean);
  });
  assert.equal(
    repeated.length,
    2,
    "real fixture has reused links and mapped cards",
  );
  for (const oid of repeated) {
    const target = preview.locator(`[data-oid="${oid}"]`).nth(1);
    await row(oid, 1).locator(":scope > .layer-row").click();
    await expect(row(oid, 1)).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("button", { name: "Apply text", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Apply typography", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Apply spacing", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Apply appearance", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByLabel("Font size preset", { exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByLabel("Background colour preset", { exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole("alert")).toContainText(/renders [23] times/);
    await align(target);
    await target.click();
    await expect(row(oid, 1)).toHaveAttribute("aria-selected", "true");
  }
  pass(
    "reused component and mapped list rows select their own DOM instance while edits stay refused",
  );

  await choose("harbor-studio");
  const harborHeading = preview.locator("h1");
  const harborOid = await harborHeading.getAttribute("data-oid");
  await row(harborOid).locator(":scope > .layer-row").click();
  await expect(page.getByTestId("source-location")).toContainText(
    "src/app/page.tsx",
  );
  await align(harborHeading);
  pass("the same shared tree works with the Tailwind variants fixture");

  await choose("aurora-atelier");
  await preview.locator("body").evaluate((body) => {
    body.querySelector("[data-test-layer-added]")?.remove();
    const container = document.createElement("div");
    container.setAttribute("data-test-layer-flood", "");
    for (let i = 0; i < 1005; i++) {
      const node = document.createElement("div");
      node.setAttribute("data-oid", `runtime-${i}`);
      container.append(node);
    }
    body.prepend(container);
  });
  await expect(
    page.getByText("Layer tree is partial: inspection limits reached."),
  ).toBeVisible();
  await expect(tree.getByRole("treeitem")).toHaveCount(1000);
  await preview.locator("h1").click();
  await expect(
    page.getByText("Selected element is outside the displayed layer tree."),
  ).toBeVisible();
  await expect(tree.locator('[aria-selected="true"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Apply text", exact: true }),
  ).toBeEnabled();
  await preview.locator("h1").evaluate((heading) => {
    const clone = heading.cloneNode(true);
    clone.setAttribute("data-test-layer-duplicate", "");
    heading.after(clone);
  });
  await preview.locator("h1").first().click();
  await expect(page.getByRole("alert")).toContainText("renders 2 times");
  await expect(
    page.getByRole("button", { name: "Apply text", exact: true }),
  ).toBeDisabled();
  assert.equal(
    await readFile(
      resolve("apps/playground/.workspace/aurora-atelier/src/app/page.tsx"),
      "utf8",
    ),
    after,
  );
  pass(
    "truncation is explicit and a repeated source target beyond the displayed tree never becomes editable",
  );
  const beforeDepth = await lastLayers();
  await preview.locator("body").evaluate((body) => {
    body.querySelector("[data-test-layer-flood]")?.remove();
    body.querySelector("[data-test-layer-duplicate]")?.remove();
    const root = document.createElement("div");
    root.setAttribute("data-test-layer-depth", "");
    let node = root;
    for (let i = 0; i < 70; i++) {
      const child = document.createElement("div");
      node.append(child);
      node = child;
    }
    node.setAttribute("data-oid", "too-deep");
    body.prepend(root);
  });
  await expect
    .poll(async () => (await lastLayers()).generation)
    .toBeGreaterThan(beforeDepth.generation);
  await expect
    .poll(async () =>
      (await lastLayers()).nodes.some((x) => x.oid === "too-deep"),
    )
    .toBe(false);
  await expect(
    page.getByText("Layer tree is partial: inspection limits reached."),
  ).toBeVisible();
  await preview.locator("body").evaluate((body) => {
    body.querySelector("[data-test-layer-depth]")?.remove();
    const root = document.createElement("div");
    root.setAttribute("data-test-layer-visits", "");
    for (let i = 0; i < 10010; i++) root.append(document.createElement("span"));
    root.lastElementChild.setAttribute("data-oid", "past-visit-budget");
    body.prepend(root);
  });
  await expect.poll(async () => (await lastLayers()).nodes.length).toBe(1);
  assert.equal(
    (await lastLayers()).nodes.some((x) => x.oid === "past-visit-budget"),
    false,
  );
  await expect(
    page.getByText("Layer tree is partial: inspection limits reached."),
  ).toBeVisible();
  await preview
    .locator("body")
    .evaluate((body) =>
      body.querySelector("[data-test-layer-visits]")?.remove(),
    );
  await expect(
    page.getByText("Layer tree is partial: inspection limits reached."),
  ).toBeHidden();
  pass(
    "DOM depth and visit budgets truncate explicitly and recover when the oversized subtree is removed",
  );
  await preview.locator("h1").click();
  await expect(page.getByLabel("Text", { exact: true })).toBeEnabled();
  await preview.locator("h1").evaluate((heading) => heading.remove());
  await expect(
    page.getByRole("button", { name: "Apply text", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".selection-box")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("no longer available");
  assert.equal(
    await readFile(
      resolve("apps/playground/.workspace/aurora-atelier/src/app/page.tsx"),
      "utf8",
    ),
    after,
  );
  pass(
    "removed targets clear geometry and disable source edits instead of retaining a stale inspector",
  );
  assert.deepEqual(errors, []);
  console.log(`${checks} layer checks passed.`);
} catch (error) {
  await page
    .screenshot({ path: join(evidence, "failure.png") })
    .catch(() => {});
  throw error;
} finally {
  await context.tracing.stop({ path: join(evidence, "trace.zip") });
  await browser.close();
}
