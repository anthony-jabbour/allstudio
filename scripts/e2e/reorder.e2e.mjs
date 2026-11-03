import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { clickPreview } from "./preview-pointer.mjs";

const evidence = await mkdtemp(join(tmpdir(), "allstudio-reorder-e2e-"));
console.log(`Evidence: ${evidence}`);
const file = resolve(
  "apps/playground/.workspace/aurora-atelier/src/app/page.tsx",
);
const before = await readFile(file, "utf8");
const first = before.match(
  /<p\b[^>]*>[\s\S]*?allstudio fixture[\s\S]*?<\/p>/,
)?.[0];
const heading = before.match(/<h1\b[\s\S]*?<\/h1>/)?.[0];
if (!first || !heading) throw new Error("Missing representative siblings");
const gap = before.slice(
  before.indexOf(first) + first.length,
  before.indexOf(heading),
);
const expectedSource = before.replace(
  first + gap + heading,
  heading + gap + first,
);
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1100 },
});
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
const preview = page.frameLocator('iframe[title="Project preview"]');
try {
  await page.goto("http://localhost:5173/");
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60000 });
  await clickPreview(page, preview.locator("h1"));
  await expect(page.getByTestId("source-location")).toBeVisible();
  const oid = await preview.locator("h1").getAttribute("data-oid");
  const peerOid = await preview
    .locator("main > p")
    .first()
    .getAttribute("data-oid");
  const originalBox = await preview.locator("h1").boundingBox();
  await page
    .getByRole("button", { name: "Move layer up", exact: true })
    .click();
  await expect(page.locator(".diff")).toBeVisible();
  assert.equal(await readFile(file, "utf8"), before);
  await expect(
    page.getByLabel("Font size preset", { exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Mobile viewport", exact: true })
    .click();
  await expect(
    page.getByRole("alert", { name: "Unsaved responsive draft confirmation" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Keep responsive editing", exact: true })
    .click();
  await page.locator('button[data-route="/about"]').click();
  await expect(page.getByTestId("route-draft-confirm")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await page
    .getByRole("button", { name: "Cancel layer move", exact: true })
    .press("Escape");
  await expect(
    page.getByRole("button", { name: "Apply layer move", exact: true }),
  ).toHaveCount(0);
  assert.equal(await readFile(file, "utf8"), before);
  await page
    .getByRole("button", { name: "Move layer up", exact: true })
    .click();
  console.log(
    "PASS pending moves guard property/viewport/route changes and Escape cancels without a write",
  );
  await page
    .getByRole("button", { name: "Apply layer move", exact: true })
    .click();
  await expect(page.getByText(/Saved sibling order.*observed/)).toBeVisible({
    timeout: 20000,
  });
  assert.equal(await readFile(file, "utf8"), expectedSource);
  await expect
    .poll(() =>
      preview
        .locator("main")
        .evaluate((el) =>
          [...el.children].slice(0, 2).map((child) => child.tagName),
        ),
    )
    .toEqual(["H1", "P"]);
  const movedBox = await preview.locator("h1").boundingBox();
  assert.ok(
    originalBox && movedBox && Math.abs(originalBox.y - movedBox.y) > 1,
  );
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    "Aurora Atelier",
  );
  await writeFile(join(evidence, "before.tsx"), before);
  await writeFile(join(evidence, "button-after.tsx"), expectedSource);
  await page.screenshot({ path: join(evidence, "button-move.png") });
  console.log(
    "PASS button preview/Apply changes exact JSX, actual sibling order/geometry and retains moved identity",
  );
  const tree = page.getByRole("tree", { name: "Rendered layers" });
  const selected = tree.locator(`[data-source-oid="${oid}"] > .layer-row`);
  const target = tree.locator(`[data-source-oid="${peerOid}"] > .layer-row`);
  await selected.dragTo(target);
  await expect(
    page.getByRole("button", { name: "Apply layer move", exact: true }),
  ).toBeEnabled();
  assert.equal(await readFile(file, "utf8"), expectedSource);
  await page
    .getByRole("button", { name: "Apply layer move", exact: true })
    .click();
  await expect(page.getByText(/Saved sibling order.*observed/)).toBeVisible({
    timeout: 20000,
  });
  assert.equal(await readFile(file, "utf8"), before);
  await expect
    .poll(() =>
      preview
        .locator("main")
        .evaluate((el) =>
          [...el.children].slice(0, 2).map((child) => child.tagName),
        ),
    )
    .toEqual(["P", "H1"]);
  console.log(
    "PASS selected-layer drag previews the same adjacent swap and Apply restores exact original source/order",
  );
  await page
    .getByRole("button", { name: "Move layer up", exact: true })
    .click();
  const external = `${before}\n// External reorder conflict\n`;
  await writeFile(file, external);
  await page
    .getByRole("button", { name: "Apply layer move", exact: true })
    .click();
  await expect(page.locator(".status-error")).toContainText(
    /changed|stale|conflict/i,
  );
  assert.equal(await readFile(file, "utf8"), external);
  await page
    .getByRole("button", { name: "Cancel layer move", exact: true })
    .click();
  console.log(
    "PASS external source revision refuses a queued structural write without losing external bytes",
  );
  const conditional = external
    .replace("  return (", "  if (true) { return (")
    .replace("\n  );\n}", "\n  ); }\n  return null;\n}");
  assert.notEqual(conditional, external);
  try {
    await writeFile(file, conditional);
    await page.reload();
    await page
      .getByText("Preview bridge: connected", { exact: false })
      .waitFor({ timeout: 60000 });
    await clickPreview(page, preview.locator("h1"));
    await expect(page.getByTestId("source-location")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Move layer up", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Move layer down", exact: true }),
    ).toBeDisabled();
    await expect(page.getByLabel("Text", { exact: true })).toBeEnabled();
    assert.equal(await readFile(file, "utf8"), conditional);
  } finally {
    await writeFile(file, external);
  }
  console.log(
    "PASS statement-level conditional JSX stays non-reorderable while existing static text editing remains available",
  );
  await page.locator(".fixture-picker select").selectOption("lumen-notes");
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60000 });
  await clickPreview(page, preview.locator("nav a").first());
  await expect(
    page.getByRole("button", { name: "Move layer up", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Move layer down", exact: true }),
  ).toBeDisabled();
  console.log(
    "PASS repeated component instances remain uneditable by reorder controls",
  );
} finally {
  await context.tracing.stop({ path: join(evidence, "trace.zip") });
  await browser.close();
}
