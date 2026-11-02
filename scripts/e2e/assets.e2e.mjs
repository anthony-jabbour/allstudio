// Requires ALLSTUDIO_RESET_WORKSPACE=1 bun run dev, with one browser harness at a time.
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { clickPreview } from "./preview-pointer.mjs";

const evidence = await mkdtemp(join(tmpdir(), "allstudio-assets-e2e-"));
console.log(`Evidence: ${evidence}`);
const sourceFile = resolve(
  "apps/playground/.workspace/aurora-atelier/src/app/assets/page.tsx",
);
const original = await readFile(sourceFile, "utf8");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
const preview = page.frameLocator('iframe[title="Project preview"]');
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto("http://localhost:5173/");
  await page.locator(".fixture-picker select").selectOption("aurora-atelier");
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60000 });
  await page
    .getByRole("list", { name: "Pages", exact: true })
    .locator('button[data-route="/assets"]')
    .click();
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60000 });
  const images = preview.locator("main img");
  await expect(images).toHaveCount(2, { timeout: 30000 });
  const firstOid = await images.first().getAttribute("data-oid");
  assert.ok(firstOid);
  await clickPreview(page, images.first());
  await expect(
    page
      .getByRole("tree", { name: "Rendered layers" })
      .locator(`[data-source-oid="${firstOid}"]`),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("source-location")).toContainText(
    "src/app/assets/page.tsx",
  );
  const assetSelect = page.locator(".asset-inspector select");
  await expect(assetSelect).toContainText("public/studio-arc.svg");
  await assetSelect.selectOption("public/studio-arc.svg");
  await page.getByRole("button", { name: "Preview asset patch" }).click();
  await expect(page.locator(".diff")).toContainText('src="/studio-arc.svg"');
  assert.equal(await readFile(sourceFile, "utf8"), original);
  await page.getByRole("button", { name: "Use asset" }).click();
  await expect(images.first()).toHaveAttribute("src", "/studio-arc.svg", {
    timeout: 30000,
  });
  try {
    await expect(
      page.getByText(
        /Saved to src\/app\/assets\/page\.tsx and the preview shows the new image/,
      ),
    ).toBeVisible({ timeout: 30000 });
  } catch (error) {
    console.log(
      "Asset status:",
      await page.locator(".status").allTextContents(),
    );
    console.log(
      "Rendered image:",
      await images.first().evaluate((image) => ({
        src: image.currentSrc,
        complete: image.complete,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })),
    );
    throw error;
  }
  const rendered = await images.first().evaluate((image) => ({
    complete: image.complete,
    width: image.naturalWidth,
    height: image.naturalHeight,
    url: image.currentSrc,
  }));
  assert.equal(rendered.complete, true);
  assert.ok(rendered.width > 0 && rendered.height > 0);
  assert.ok(rendered.url.endsWith("/studio-arc.svg"));
  const after = await readFile(sourceFile, "utf8");
  assert.equal(
    after,
    original.replace(
      '<img\n        src="/studio-orbit.svg"',
      '<img\n        src="/studio-arc.svg"',
    ),
  );
  await writeFile(join(evidence, "before.tsx"), original);
  await writeFile(join(evidence, "after.tsx"), after);
  await page.screenshot({ path: join(evidence, "asset-applied.png") });
  console.log(
    "PASS static img source diff, persisted source, rendered image and refresh confirmation",
  );
  const secondOid = await images.nth(1).getAttribute("data-oid");
  assert.ok(secondOid);
  await clickPreview(page, images.nth(1));
  await expect(
    page
      .getByRole("tree", { name: "Rendered layers" })
      .locator(`[data-source-oid="${secondOid}"]`),
  ).toHaveAttribute("aria-selected", "true");
  await expect(images.nth(1)).toHaveAttribute("src", "/studio-orbit.svg");
  await expect(page.getByTestId("source-location")).toContainText(
    "src/app/assets/page.tsx",
  );
  await assetSelect.selectOption("public/studio-arc.svg");
  await page.getByRole("button", { name: "Preview asset patch" }).click();
  await expect(page.locator(".diff")).toContainText('src="/studio-arc.svg"');
  await page.getByRole("button", { name: "Use asset" }).click();
  await expect(images.nth(1)).toHaveAttribute("src", "/studio-arc.svg", {
    timeout: 30000,
  });
  await expect(
    page.getByText(
      /Saved to src\/app\/assets\/page\.tsx and the preview shows the new image/,
    ),
  ).toBeVisible({ timeout: 30000 });
  assert.equal(
    await images
      .nth(1)
      .evaluate((image) => image.complete && image.naturalWidth > 0),
    true,
  );
  await writeFile(
    join(evidence, "after-next-image.tsx"),
    await readFile(sourceFile, "utf8"),
  );
  console.log(
    "PASS verified next/image alias source association and loaded rendering",
  );
  assert.deepEqual(errors, []);
} finally {
  await writeFile(sourceFile, original);
  await context.tracing.stop({ path: join(evidence, "trace.zip") });
  await browser.close();
}
