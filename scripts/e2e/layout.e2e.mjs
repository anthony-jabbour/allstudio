// Requires bun run dev with disposable fixture copies.
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const evidence = await mkdtemp(join(tmpdir(), "allstudio-layout-e2e-"));
console.log(`Evidence: ${evidence}`);
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
});
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage(),
  preview = page.frameLocator('iframe[title="Project preview"]');
const file = resolve(
  "apps/playground/.workspace/harbor-studio/src/app/page.tsx",
);
const HERO =
  "mx-auto grid max-w-5xl gap-8 px-6 py-20 md:grid-cols-2 md:items-center lg:py-28";
const CTA =
  "rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-sky-600";
let checks = 0;
const pass = (message) => {
  checks++;
  console.log(`PASS ${message}`);
};
try {
  await page.goto("http://localhost:5173/");
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60000 });
  await page
    .getByLabel("Edit breakpoint", { exact: true })
    .selectOption("base");
  await page.locator(".fixture-picker select").selectOption("harbor-studio");
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60000 });
  await page
    .getByLabel("Edit breakpoint", { exact: true })
    .selectOption("base");
  await preview.locator("#hero").click({ position: { x: 5, y: 5 } });
  await expect(page.getByTestId("source-location")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Layout", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Classes", { exact: true }).fill(HERO);
  await page
    .getByRole("button", { name: "Apply classes", exact: true })
    .click();
  await expect
    .poll(() =>
      preview.locator("#hero").evaluate((el) => getComputedStyle(el).display),
    )
    .toBe("grid");
  await expect(
    page.getByRole("button", { name: "Apply classes", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Classes", { exact: true })).toHaveValue(HERO);

  const before = await readFile(file, "utf8");
  const measureHero = () =>
    preview.locator("#hero").evaluate((el) => {
      const css = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        display: css.display,
        flexDirection: css.flexDirection,
        gridTemplateColumns: css.gridTemplateColumns,
        gridTemplateRows: css.gridTemplateRows,
        width: css.width,
        maxWidth: css.maxWidth,
        rectWidth: rect.width,
        rectHeight: rect.height,
      };
    });
  const heroBaseline = await measureHero();
  await expect(page.getByTestId("constraint-width")).toContainText("max-w-5xl");
  await expect(page.getByTestId("constraint-width")).toContainText("1024px");

  await page
    .getByLabel("Grid rows preset", { exact: true })
    .selectOption("grid-rows-2");
  assert.equal(await readFile(file, "utf8"), before);
  await page
    .getByRole("button", { name: "Preview layout patch", exact: true })
    .click();
  await expect(page.locator(".diff")).toContainText("grid-rows-2");
  assert.equal(await readFile(file, "utf8"), before);
  await page.getByRole("button", { name: "Apply layout", exact: true }).click();
  await expect(page.getByText(/Saved layout.*observed/)).toBeVisible({
    timeout: 30000,
  });
  const afterRows = await readFile(file, "utf8");
  const observedRows = await measureHero();
  assert.equal(afterRows, before.replace("lg:py-28", "lg:py-28 grid-rows-2"));
  assert.ok(afterRows.includes("md:grid-cols-2 md:items-center lg:py-28"));
  assert.equal(observedRows.gridTemplateRows.trim().split(/\s+/).length, 2);
  pass(
    "Harbor #hero gridRows preview and apply confirm 2 rendered tracks and preserve responsive utilities",
  );

  await page
    .getByLabel("Width preset", { exact: true })
    .selectOption("custom:px");
  await page.getByLabel("Width px", { exact: true }).fill("800");
  assert.equal(await readFile(file, "utf8"), afterRows);
  await page
    .getByRole("button", { name: "Preview layout patch", exact: true })
    .click();
  await expect(page.locator(".diff")).toContainText("w-[800px]");
  assert.equal(await readFile(file, "utf8"), afterRows);
  await page.getByRole("button", { name: "Apply layout", exact: true }).click();
  await expect(page.getByText(/Saved layout.*observed/)).toBeVisible({
    timeout: 30000,
  });
  const afterWidth800 = await readFile(file, "utf8");
  const observedWidth800 = await measureHero();
  assert.equal(
    afterWidth800,
    afterRows.replace("grid-rows-2", "grid-rows-2 w-[800px]"),
  );
  assert.ok(afterWidth800.includes("max-w-5xl"));
  assert.equal(observedWidth800.width, "800px");
  assert.ok(Math.abs(observedWidth800.rectWidth - 800) < 1);
  assert.ok(observedWidth800.rectWidth < heroBaseline.rectWidth);
  await writeFile(join(evidence, "source-before.tsx"), before);
  await writeFile(join(evidence, "source-after.tsx"), afterWidth800);
  await page.screenshot({ path: join(evidence, "layout.png") });
  pass(
    "unconstrained 800px width under max-w-5xl updates source, computed width and bounding-box geometry while preserving max-w-5xl",
  );

  await expect(page.getByTestId("constraint-width")).toBeVisible();
  await page.getByLabel("Width px", { exact: true }).fill("1200");
  await page.getByRole("button", { name: "Apply layout", exact: true }).click();
  await expect(
    page.getByText(/Layout source saved, but rendering is unconfirmed/),
  ).toBeVisible({ timeout: 30000 });
  const afterWidth1200 = await readFile(file, "utf8");
  const observedWidth1200 = await measureHero();
  assert.equal(
    afterWidth1200,
    afterWidth800.replace("w-[800px]", "w-[1200px]"),
  );
  assert.ok(afterWidth1200.includes("max-w-5xl"));
  assert.equal(observedWidth1200.width, "1024px");
  await page.screenshot({
    path: join(evidence, "constrained-unconfirmed.png"),
  });
  pass(
    "constrained 1200px width clamped by max-w-5xl at 1024px preserves max-w-5xl and truthfully reports rendering unconfirmed",
  );

  await page
    .getByLabel("Grid columns preset", { exact: true })
    .selectOption("grid-cols-3");
  await page.getByRole("button", { name: "Apply layout", exact: true }).click();
  await expect(
    page.getByText(/Layout source saved, but rendering is unconfirmed/),
  ).toBeVisible({ timeout: 30000 });
  const afterCols3 = await readFile(file, "utf8");
  const observedCols3 = await measureHero();
  assert.equal(
    afterCols3,
    afterWidth1200.replace("w-[1200px]", "w-[1200px] grid-cols-3"),
  );
  assert.ok(afterCols3.includes("md:grid-cols-2"));
  assert.equal(observedCols3.gridTemplateColumns.trim().split(/\s+/).length, 2);
  pass(
    "Base grid-cols-3 under active md:grid-cols-2 at 1440px preserves md:grid-cols-2 and reports rendering unconfirmed",
  );

  await expect(
    page.getByText("Flex direction is inactive for rendered display grid"),
  ).toBeVisible();
  await expect(
    page.getByLabel("Flex direction preset", { exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Flex direction preset", { exact: true })
    .selectOption("flex-col");
  await page.getByRole("button", { name: "Apply layout", exact: true }).click();
  await expect(
    page.getByText(/Layout source saved, but rendering is unconfirmed/),
  ).toBeVisible({ timeout: 30000 });
  const afterInactiveFlex = await readFile(file, "utf8");
  assert.equal(
    afterInactiveFlex,
    afterCols3.replace("grid-cols-3", "grid-cols-3 flex-col"),
  );
  pass(
    "inactive flex-col edit on a grid container saves source and truthfully reports rendering unconfirmed",
  );

  const ctaWrapperOid = await preview
    .locator("#harbor-cta")
    .locator("..")
    .getAttribute("data-oid");
  assert.ok(ctaWrapperOid);
  const layers = page.getByRole("tree", { name: "Rendered layers" });
  await layers
    .locator(`[data-source-oid="${ctaWrapperOid}"] > .layer-row`)
    .click();
  await expect(page.getByLabel("Classes", { exact: true })).toHaveValue(
    await preview.locator("#harbor-cta").locator("..").getAttribute("class"),
  );
  await page
    .getByLabel("Classes", { exact: true })
    .fill("flex flex-wrap gap-3");
  await page
    .getByRole("button", { name: "Apply classes", exact: true })
    .click();
  await expect
    .poll(() =>
      preview
        .locator("#harbor-cta")
        .locator("..")
        .evaluate((el) => getComputedStyle(el).flexDirection),
    )
    .toBe("row");
  await expect(
    page.getByRole("button", { name: "Apply classes", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Classes", { exact: true })).toHaveValue(
    "flex flex-wrap gap-3",
  );
  const measureFlex = () =>
    preview
      .locator("#harbor-cta")
      .locator("..")
      .evaluate((el) => {
        const css = getComputedStyle(el);
        const cta = el
          .querySelector("#harbor-cta")
          .getBoundingClientRect()
          .toJSON();
        const secondary = el
          .querySelector("#harbor-secondary")
          .getBoundingClientRect()
          .toJSON();
        return {
          display: css.display,
          flexDirection: css.flexDirection,
          justifyContent: css.justifyContent,
          alignItems: css.alignItems,
          cta,
          secondary,
        };
      });
  const flexBefore = await readFile(file, "utf8");
  const flexBaseline = await measureFlex();
  assert.ok(flexBaseline.secondary.left > flexBaseline.cta.left);
  assert.ok(Math.abs(flexBaseline.secondary.top - flexBaseline.cta.top) < 5);

  await page
    .getByLabel("Flex direction preset", { exact: true })
    .selectOption("flex-col");
  await page
    .getByLabel("Justify content preset", { exact: true })
    .selectOption("justify-between");
  await page
    .getByLabel("Align items preset", { exact: true })
    .selectOption("items-start");
  await page
    .getByRole("button", { name: "Preview layout patch", exact: true })
    .click();
  await expect(page.locator(".diff")).toContainText(
    "flex-col justify-between items-start",
  );
  assert.equal(await readFile(file, "utf8"), flexBefore);
  await page.getByRole("button", { name: "Apply layout", exact: true }).click();
  await expect(page.getByText(/Saved layout.*observed/)).toBeVisible({
    timeout: 30000,
  });
  const flexAfter = await readFile(file, "utf8");
  const flexObserved = await measureFlex();
  assert.equal(
    flexAfter,
    flexBefore.replace(
      "flex flex-wrap gap-3",
      "flex flex-wrap gap-3 flex-col justify-between items-start",
    ),
  );
  assert.equal(flexObserved.flexDirection, "column");
  assert.equal(flexObserved.justifyContent, "space-between");
  assert.equal(flexObserved.alignItems, "flex-start");
  assert.ok(flexObserved.secondary.top >= flexObserved.cta.bottom);
  assert.ok(Math.abs(flexObserved.secondary.left - flexObserved.cta.left) < 1);
  await writeFile(join(evidence, "flex-before.tsx"), flexBefore);
  await writeFile(join(evidence, "flex-after.tsx"), flexAfter);
  await writeFile(
    join(evidence, "measured.json"),
    JSON.stringify(
      {
        heroBaseline,
        observedRows,
        observedWidth800,
        observedWidth1200,
        observedCols3,
        flexBaseline,
        flexObserved,
      },
      null,
      2,
    ),
  );
  pass(
    "multi-child flex container updates flexDirection, justifyContent and alignItems, preserves flex-wrap gap-3, and moves #harbor-secondary below #harbor-cta",
  );

  await preview.locator("#harbor-cta").click();
  await expect(page.getByLabel("Classes", { exact: true })).toHaveValue(
    await preview.locator("#harbor-cta").getAttribute("class"),
  );
  await expect(page.getByLabel("Width preset", { exact: true })).toBeEnabled();
  await page.getByLabel("Classes", { exact: true }).fill(`${CTA} size-20`);
  await page
    .getByRole("button", { name: "Apply classes", exact: true })
    .click();
  await expect
    .poll(() =>
      preview
        .locator("#harbor-cta")
        .evaluate((el) => getComputedStyle(el).width),
    )
    .toBe("80px");
  await expect(
    page.getByRole("button", { name: "Apply classes", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Width preset", { exact: true })).toHaveValue(
    "w-20",
  );
  await expect(page.getByLabel("Height preset", { exact: true })).toHaveValue(
    "h-20",
  );
  await expect(
    page.locator(".layout-inspector code", { hasText: "size-20" }),
  ).toHaveCount(2);

  const sizeBefore = await readFile(file, "utf8");
  await page
    .getByLabel("Width preset", { exact: true })
    .selectOption("custom:px");
  await page.getByLabel("Width px", { exact: true }).fill("220");
  await page
    .getByRole("button", { name: "Preview layout patch", exact: true })
    .click();
  await expect(page.locator(".diff")).toContainText("w-[220px] h-20");
  await page.getByRole("button", { name: "Apply layout", exact: true }).click();
  await expect(page.getByText(/Saved layout.*observed/)).toBeVisible({
    timeout: 30000,
  });
  const sizeAfter = await readFile(file, "utf8");
  assert.equal(sizeAfter, sizeBefore.replace("size-20", "w-[220px] h-20"));
  assert.deepEqual(
    await preview.locator("#harbor-cta").evaluate((el) => {
      const css = getComputedStyle(el);
      return [css.width, css.height];
    }),
    ["220px", "80px"],
  );
  pass(
    "editing width on size-20 splits shorthand into w-[220px] h-20 and preserves 80px companion height",
  );

  const savedCtaClasses = `${CTA} w-[220px] h-20`;
  await page.getByLabel("Classes", { exact: true }).fill(`${CTA} size-20 w-40`);
  await expect(page.getByLabel("Width preset", { exact: true })).toBeDisabled();
  await expect(
    page.getByLabel("Height preset", { exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .getByText(
        "Conflicting base utilities make this property ambiguous. Resolve them in Classes first.",
      )
      .first(),
  ).toBeVisible();
  await page
    .getByLabel("Classes", { exact: true })
    .fill(`${CTA} grid-cols-subgrid`);
  await expect(
    page.getByLabel("Grid columns preset", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "This property uses an unsupported, custom or important source utility. Other classes were preserved.",
    ),
  ).toBeVisible();
  await page.getByLabel("Classes", { exact: true }).fill(savedCtaClasses);
  await expect(page.getByLabel("Width px", { exact: true })).toHaveValue("220");
  pass(
    "mixed size-20 w-40 conflicts and unsupported grid-cols-subgrid tokens fail closed in the inspector",
  );

  await page.getByLabel("Width px", { exact: true }).fill("4097");
  await expect(page.locator('.layout-inspector [role="alert"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply layout", exact: true }),
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
  assert.equal(await readFile(file, "utf8"), sizeAfter);
  await page.getByLabel("Width px", { exact: true }).fill("220");
  await expect(
    page.getByRole("button", { name: "Apply layout", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Apply typography", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Apply spacing", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Apply appearance", exact: true }),
  ).toBeEnabled();
  pass(
    "invalid layout px drafts block all four design Apply buttons without writing source",
  );

  await page.getByLabel("Width px", { exact: true }).fill("260");
  const draftA = await page.getByLabel("Classes", { exact: true }).inputValue();
  await page
    .getByLabel("Classes", { exact: true })
    .fill(draftA.replace("w-[260px]", "w-[180px]"));
  await expect(page.getByLabel("Width px", { exact: true })).toHaveValue("180");
  await page.getByLabel("Classes", { exact: true }).fill(draftA);
  await expect(page.getByLabel("Width px", { exact: true })).toHaveValue("260");
  await page.getByLabel("Classes", { exact: true }).fill(savedCtaClasses);
  await expect(page.getByLabel("Width px", { exact: true })).toHaveValue("220");
  pass(
    "manual class draft A/B/A changes resynchronize the layout inspector without stale values",
  );

  const inodeBefore = await stat(file);
  await page.getByRole("button", { name: "Apply layout", exact: true }).click();
  await expect(page.getByText(/No change:/)).toBeVisible();
  const inodeAfter = await stat(file);
  assert.equal(inodeAfter.ino, inodeBefore.ino);
  assert.equal(inodeAfter.mtimeMs, inodeBefore.mtimeMs);
  pass("unchanged layout Apply is a no-op and preserves inode/mtime");

  await page
    .getByLabel("Font weight preset", { exact: true })
    .selectOption("font-bold");
  await page.getByLabel("Width px", { exact: true }).fill("240");
  const mixedClass = await page
    .getByLabel("Classes", { exact: true })
    .inputValue();
  await page
    .getByRole("button", { name: "Preview layout patch", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply layout", exact: true }).click();
  await expect(page.getByText(/Saved design properties.*observed/)).toBeVisible(
    { timeout: 30000 },
  );
  const mixedAfter = await readFile(file, "utf8");
  assert.equal(mixedAfter, sizeAfter.replace(savedCtaClasses, mixedClass));
  assert.deepEqual(
    await preview.locator("#harbor-cta").evaluate((el) => {
      const css = getComputedStyle(el);
      return [css.fontWeight, css.width];
    }),
    ["700", "240px"],
  );
  pass(
    "mixed typography and layout draft confirms both groups through a single source patch",
  );

  await page.getByLabel("Width px", { exact: true }).fill("280");
  const external = `${await readFile(file, "utf8")}\n// Owned layout conflict test\n`;
  await writeFile(file, external);
  await page.getByRole("button", { name: "Apply layout", exact: true }).click();
  await expect(page.locator(".status-error")).toContainText(
    /changed|stale|conflict/i,
  );
  assert.equal(await readFile(file, "utf8"), external);
  pass("stale layout writes refuse safely and preserve external source bytes");

  await preview.locator("#harbor-secondary").click();
  await expect(
    page.getByText("className is an expression", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply layout", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Display preset", { exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Width preset", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Text", { exact: true })).toBeEnabled();
  pass(
    "dynamic class expressions disable layout controls while static text remains editable",
  );

  await preview.locator("#harbor-cta").click();
  await expect(page.getByLabel("Width preset", { exact: true })).toBeEnabled();
  await page.getByLabel("Width px", { exact: true }).fill("300");
  const beforeCollapse = await readFile(file, "utf8");
  await page.locator(".layout-inspector > summary").click();
  await expect(
    page.getByRole("region", { name: "Layout", exact: true }),
  ).toBeHidden();
  await page.locator(".layout-inspector > summary").click();
  await expect(page.getByLabel("Width px", { exact: true })).toHaveValue("300");
  assert.equal(await readFile(file, "utf8"), beforeCollapse);
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await page.setViewportSize({ width: 900, height: 800 });
  await page.getByLabel("Width preset", { exact: true }).focus();
  await page.getByLabel("Width preset", { exact: true }).press("Tab");
  await expect(page.getByLabel("Width px", { exact: true })).toBeFocused();
  await page.screenshot({ path: join(evidence, "layout-dark-narrow.png") });
  pass(
    "dark narrow layout controls preserve drafts through collapse and maintain native keyboard focus order",
  );
  console.log(`${checks} layout checks passed.`);
} catch (error) {
  await page
    .screenshot({ path: join(evidence, "failure.png") })
    .catch(() => {});
  throw error;
} finally {
  await context.tracing.stop({ path: join(evidence, "trace.zip") });
  await browser.close();
}
