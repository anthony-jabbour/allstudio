import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const evidence = await mkdtemp(join(tmpdir(), "allstudio-responsive-e2e-"));
console.log(`Evidence: ${evidence}`);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1100 },
});
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
const preview = page.frameLocator('iframe[title="Project preview"]');
const file = resolve(
  "apps/playground/.workspace/aurora-atelier/src/app/page.tsx",
);
const initial = await readFile(file, "utf8");
try {
  await page.goto("http://localhost:5173/");
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60000 });
  for (const [label, width, scope] of [
    ["Mobile", 390, "base"],
    ["Tablet", 768, "md"],
    ["Desktop", 1440, "xl"],
  ]) {
    await page
      .getByRole("button", { name: `${label} viewport`, exact: true })
      .click();
    await expect
      .poll(() => preview.locator("html").evaluate(() => innerWidth))
      .toBe(width);
    await expect(
      page.getByLabel("Edit breakpoint", { exact: true }),
    ).toHaveValue(scope);
  }
  assert.equal(await readFile(file, "utf8"), initial);
  console.log(
    "PASS true iframe widths auto-select exact edit scopes without source writes",
  );
  await page
    .getByRole("button", { name: "Tablet viewport", exact: true })
    .click();
  await page.getByLabel("Canvas zoom", { exact: true }).selectOption("0.5");
  await preview.locator("h1").click();
  await expect(page.getByTestId("source-location")).toBeVisible();
  const checkGeometry = async () => {
    await expect
      .poll(async () => {
        const box = await page.locator(".selection-box").boundingBox();
        const element = await preview.locator("h1").boundingBox();
        return box && element
          ? Math.max(
              ...["x", "y", "width", "height"].map((key) =>
                Math.abs(box[key] - element[key]),
              ),
            )
          : 1000;
      })
      .toBeLessThan(1.1);
  };
  await checkGeometry();
  await page
    .getByLabel("Font size preset", { exact: true })
    .selectOption("custom:px");
  await page.getByLabel("Font size px", { exact: true }).fill("36");
  await page
    .getByRole("button", { name: "Mobile viewport", exact: true })
    .click();
  await expect(
    page.getByRole("alert", { name: "Unsaved responsive draft confirmation" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Keep responsive editing", exact: true })
    .click();
  await expect(page.getByLabel("Edit breakpoint", { exact: true })).toHaveValue(
    "md",
  );
  await expect
    .poll(() => preview.locator("html").evaluate(() => innerWidth))
    .toBe(768);
  await page
    .getByRole("button", { name: "Preview typography patch", exact: true })
    .click();
  await expect(page.locator(".diff")).toContainText("md:text-[36px]");
  const sizeDraft = await page
    .getByLabel("Classes", { exact: true })
    .inputValue();
  assert.equal(await readFile(file, "utf8"), initial);
  await page
    .getByRole("button", { name: "Apply typography", exact: true })
    .click();
  await expect(page.getByText(/Saved typography.*observed/)).toBeVisible({
    timeout: 20000,
  });
  await expect
    .poll(() =>
      preview.locator("h1").evaluate((el) => getComputedStyle(el).fontSize),
    )
    .toBe("36px");
  const after = await readFile(file, "utf8");
  assert.match(after, /md:text-\[36px\]/);
  assert.equal(
    after,
    initial.replace(/(id="hero-heading"\s+className=")[^"]+/, `$1${sizeDraft}`),
  );
  await writeFile(join(evidence, "before.tsx"), initial);
  await writeFile(join(evidence, "md-size-after.tsx"), after);
  await checkGeometry();
  await page.screenshot({ path: join(evidence, "tablet-50.png") });
  console.log(
    "PASS guarded drafts, exact md source diff, actual rendering and scaled overlay",
  );
  await page
    .getByRole("button", { name: "Clear Font size override", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply typography", exact: true })
    .click();
  await expect(page.getByText(/Saved typography.*observed/)).toBeVisible({
    timeout: 20000,
  });
  const cleared = after.replace("md:text-[36px]", "");
  assert.equal(await readFile(file, "utf8"), cleared);
  console.log(
    "PASS Clear removes only md override with source readback and rendered confirmation",
  );
  const previousClasses = await page
    .getByLabel("Classes", { exact: true })
    .inputValue();
  const padding = previousClasses.includes("md:px-4") ? 20 : 16;
  const background = previousClasses.includes("md:bg-[#112233]")
    ? "#445566"
    : "#112233";
  const width = previousClasses.includes("md:w-[300px]") ? 280 : 300;
  await page
    .getByLabel("Padding inline preset", { exact: true })
    .selectOption(padding === 16 ? "px-4" : "px-5");
  await page
    .getByLabel("Background colour preset", { exact: true })
    .selectOption("custom:hex");
  await page
    .getByLabel("Background colour hex", { exact: true })
    .fill(background);
  await page
    .getByLabel("Width preset", { exact: true })
    .selectOption("custom:px");
  await page.getByLabel("Width px", { exact: true }).fill(String(width));
  const classes = await page
    .getByLabel("Classes", { exact: true })
    .inputValue();
  assert.ok(classes.includes(padding === 16 ? "md:px-4" : "md:px-5"));
  assert.ok(classes.includes(`md:bg-[${background}]`));
  assert.ok(classes.includes(`md:w-[${width}px]`));
  await page
    .getByRole("button", { name: "Preview layout patch", exact: true })
    .click();
  assert.equal(await readFile(file, "utf8"), cleared);
  await page.getByRole("button", { name: "Apply layout", exact: true }).click();
  await expect(page.getByText(/Saved design properties.*observed/)).toBeVisible(
    { timeout: 20000 },
  );
  const groupAfter = await readFile(file, "utf8");
  const renderedClass = await preview.locator("h1").getAttribute("class");
  assert.equal(renderedClass, classes);
  assert.equal(
    groupAfter,
    cleared.replace(/(id="hero-heading"\s+className=")[^"]+/, `$1${classes}`),
  );
  await expect
    .poll(() =>
      preview.locator("h1").evaluate((el) => ({
        padding: getComputedStyle(el).paddingLeft,
        background: getComputedStyle(el).backgroundColor,
        width: getComputedStyle(el).width,
      })),
    )
    .toEqual({
      padding: `${padding}px`,
      background:
        background === "#112233" ? "rgb(17, 34, 51)" : "rgb(68, 85, 102)",
      width: `${width}px`,
    });
  await writeFile(join(evidence, "md-design-after.tsx"), groupAfter);
  console.log(
    "PASS scoped spacing, appearance and sizing share exact source diff and rendered confirmation",
  );
  for (const zoom of ["0.75", "fit", "1"]) {
    await page.getByLabel("Canvas zoom", { exact: true }).selectOption(zoom);
    await checkGeometry();
  }
  await page
    .getByRole("button", { name: "Mobile viewport", exact: true })
    .click();
  await expect(page.getByLabel("Edit breakpoint", { exact: true })).toHaveValue(
    "base",
  );
  await page.getByLabel("Edit breakpoint", { exact: true }).selectOption("md");
  await expect(
    page.getByText("Manual edit scope", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60000 });
  assert.equal(await readFile(file, "utf8"), groupAfter);
  console.log(
    "PASS zoom modes, explicit scope override and reload preserve source",
  );
  await page
    .getByRole("button", { name: "Tablet viewport", exact: true })
    .click();
  await preview.locator("h1").click();
  await page
    .getByLabel("Font weight preset", { exact: true })
    .selectOption("custom:number");
  await page.getByLabel("Font weight number", { exact: true }).fill("650");
  const cssFile = resolve(
    "apps/playground/.workspace/aurora-atelier/src/app/globals.css",
  );
  const css = await readFile(cssFile, "utf8");
  try {
    await writeFile(cssFile, css + "\n@theme { --breakpoint-md: 900px; }\n");
    await page
      .getByRole("button", { name: "Apply typography", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: /breakpoint/i }),
    ).toBeVisible();
    assert.equal(await readFile(file, "utf8"), groupAfter);
  } finally {
    await writeFile(cssFile, css);
  }
  console.log(
    "PASS external custom breakpoint mutation refuses a scoped save and preserves source",
  );
} finally {
  await context.tracing.stop({ path: join(evidence, "trace.zip") });
  await browser.close();
}
