// Requires bun run dev with disposable fixture copies.
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const evidence = await mkdtemp(join(tmpdir(), "allstudio-spacing-e2e-"));
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
  await page.locator(".fixture-picker select").selectOption("harbor-studio");
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60000 });
  await preview.locator("#hero").click({ position: { x: 5, y: 5 } });
  await expect(page.getByTestId("source-location")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Spacing", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Classes", { exact: true })
    .fill(
      "mx-auto grid max-w-5xl gap-8 px-6 py-20 md:grid-cols-2 md:items-center lg:py-28",
    );
  await page
    .getByRole("button", { name: "Apply classes", exact: true })
    .click();
  await expect
    .poll(() =>
      preview
        .locator("#hero")
        .evaluate((el) => getComputedStyle(el).paddingInlineStart),
    )
    .toBe("24px");
  await expect(
    page.getByRole("button", { name: "Apply classes", exact: true }),
  ).toBeEnabled();
  const before = await readFile(file, "utf8");
  const measure = () =>
    preview.locator("#hero").evaluate((el) => {
      const css = getComputedStyle(el);
      return {
        inlineStart: css.paddingInlineStart,
        inlineEnd: css.paddingInlineEnd,
        blockStart: css.paddingBlockStart,
        blockEnd: css.paddingBlockEnd,
        childX: el.firstElementChild.getBoundingClientRect().x,
      };
    });
  const baseline = await measure();
  await page
    .getByLabel("Padding inline preset", { exact: true })
    .selectOption("custom:px");
  await page.getByLabel("Padding inline px", { exact: true }).fill("32");
  assert.equal(await readFile(file, "utf8"), before);
  await page
    .getByRole("button", { name: "Preview spacing patch", exact: true })
    .click();
  await expect(page.locator(".diff")).toContainText("px-[32px]");
  assert.equal(await readFile(file, "utf8"), before);
  await page
    .getByRole("button", { name: "Apply spacing", exact: true })
    .click();
  await expect(page.getByText(/Saved spacing.*observed/)).toBeVisible({
    timeout: 30000,
  });
  const after = await readFile(file, "utf8"),
    observed = await measure();
  assert.equal(after, before.replace("px-6", "px-[32px]"));
  assert.equal(observed.inlineStart, "32px");
  assert.equal(observed.inlineEnd, "32px");
  assert.equal(observed.blockStart, baseline.blockStart);
  assert.equal(observed.blockEnd, baseline.blockEnd);
  assert.ok(Math.abs(observed.childX - baseline.childX - 8) < 1);
  await writeFile(join(evidence, "source-before.tsx"), before);
  await writeFile(join(evidence, "source-after.tsx"), after);
  await writeFile(
    join(evidence, "measured.json"),
    JSON.stringify({ baseline, observed }, null, 2),
  );
  await page.screenshot({ path: join(evidence, "spacing.png") });
  pass(
    "inline padding changes exact source and actual child geometry while preserving block and responsive utilities",
  );
  const apply = async () => {
    await page
      .getByRole("button", { name: "Preview spacing patch", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Apply spacing", exact: true })
      .click();
    await expect(page.getByText(/Saved spacing.*observed/)).toBeVisible({
      timeout: 30000,
    });
  };
  const custom = async (label, value) => {
    await page
      .getByLabel(`${label} preset`, { exact: true })
      .selectOption("custom:px");
    await page.getByLabel(`${label} px`, { exact: true }).fill(value);
  };
  await custom("Row gap", "12");
  await apply();
  let text = await readFile(file, "utf8");
  assert.equal(text, after.replace("gap-8", "gap-x-8 gap-y-[12px]"));
  assert.deepEqual(
    await preview.locator("#hero").evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.columnGap, s.rowGap];
    }),
    ["32px", "12px"],
  );
  await custom("Column gap", "24");
  await apply();
  let next = await readFile(file, "utf8");
  assert.equal(next, text.replace("gap-x-8", "gap-x-[24px]"));
  text = next;
  await custom("Gap all", "20");
  await apply();
  next = await readFile(file, "utf8");
  assert.equal(
    next,
    text.replace("gap-x-[24px]", "gap-[20px]").replace("gap-y-[12px]", ""),
  );
  text = next;
  pass(
    "row, column and All gap controls preserve companion values and exact unrelated source",
  );
  await custom("Margin inline", "-8");
  await apply();
  next = await readFile(file, "utf8");
  assert.equal(next, text.replace("mx-auto", "-mx-[8px]"));
  text = next;
  assert.deepEqual(
    await preview.locator("#hero").evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.marginInlineStart, s.marginInlineEnd];
    }),
    ["-8px", "-8px"],
  );
  await custom("Margin block", "16");
  await apply();
  const withBlock = await page
    .getByLabel("Classes", { exact: true })
    .inputValue();
  assert.ok(withBlock.endsWith("my-[16px]"));
  text = await readFile(file, "utf8");
  await custom("Margin all", "0");
  await apply();
  next = await readFile(file, "utf8");
  assert.equal(
    next,
    text.replace("-mx-[8px]", "m-[0px]").replace("my-[16px]", ""),
  );
  text = next;
  pass(
    "negative and axis/All margin controls persist real source and rendered margins",
  );
  await custom("Padding inline", "2049");
  await expect(
    page.getByRole("button", { name: "Apply spacing", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Apply typography", exact: true }),
  ).toBeDisabled();
  assert.equal(await readFile(file, "utf8"), text);
  await page.getByLabel("Padding inline px", { exact: true }).fill("32");
  await page
    .getByLabel("Font size preset", { exact: true })
    .selectOption("custom:px");
  await page.getByLabel("Font size px", { exact: true }).fill("513");
  await expect(
    page.getByRole("button", { name: "Apply spacing", exact: true }),
  ).toBeDisabled();
  const currentClasses = await preview.locator("#hero").getAttribute("class");
  await page
    .getByLabel("Classes", { exact: true })
    .fill(`${currentClasses} text-base`);
  await page.getByLabel("Classes", { exact: true }).fill(currentClasses);
  await expect(
    page.getByRole("button", { name: "Apply spacing", exact: true }),
  ).toBeEnabled();
  pass(
    "invalid spacing and typography drafts block every design Apply without source writes",
  );
  await custom("Padding all", "40");
  await page
    .getByRole("button", { name: "Apply spacing", exact: true })
    .click();
  await expect(
    page.getByText(/Spacing source saved, but rendering is unconfirmed/),
  ).toBeVisible({ timeout: 30000 });
  next = await readFile(file, "utf8");
  assert.equal(
    next,
    text.replace("px-[32px]", "p-[40px]").replace("py-20", ""),
  );
  text = next;
  const overridden = await measure();
  assert.equal(overridden.inlineStart, "40px");
  assert.equal(overridden.blockStart, baseline.blockStart);
  await writeFile(join(evidence, "all-padding-overridden.tsx"), text);
  pass(
    "All padding source edits retain lg block override and truthfully remain visually unconfirmed",
  );
  await custom("Padding block", "24");
  await page
    .getByRole("button", { name: "Apply spacing", exact: true })
    .click();
  await expect(
    page.getByText(/Spacing source saved, but rendering is unconfirmed/),
  ).toBeVisible({ timeout: 30000 });
  next = await readFile(file, "utf8");
  assert.equal(next, text.replace("p-[40px]", "px-[40px] py-[24px]"));
  text = next;
  assert.equal((await measure()).blockStart, baseline.blockStart);
  pass(
    "block padding preserves inline shorthand companion and does not overwrite responsive behavior",
  );
  await preview.locator("#harbor-heading").click();
  await expect(page.getByLabel("Classes", { exact: true })).toHaveValue(
    await preview.locator("#harbor-heading").getAttribute("class"),
  );
  await page
    .getByLabel("Classes", { exact: true })
    .fill("text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl");
  await page
    .getByRole("button", { name: "Apply classes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Apply classes", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByLabel("Column gap preset", { exact: true }),
  ).toBeEnabled();
  const inactiveBefore = await readFile(file, "utf8");
  await custom("Column gap", "16");
  await page
    .getByRole("button", { name: "Apply spacing", exact: true })
    .click();
  await expect(
    page.getByText(/Spacing source saved, but rendering is unconfirmed/),
  ).toBeVisible({ timeout: 30000 });
  const inactiveClass = await preview
    .locator("#harbor-heading")
    .getAttribute("class");
  assert.ok(inactiveClass.includes("gap-x-[16px]"));
  assert.equal(
    await preview
      .locator("#harbor-heading")
      .evaluate((el) => getComputedStyle(el).display),
    "block",
  );
  assert.equal(
    await readFile(file, "utf8"),
    inactiveBefore.replace(
      "text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl",
      "text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl gap-x-[16px]",
    ),
  );
  pass(
    "an inactive block gap keeps the exact source edit and reports unconfirmed despite changed computed CSS",
  );
  await custom("Padding inline", "8");
  await page
    .getByLabel("Font weight preset", { exact: true })
    .selectOption("font-medium");
  const combinedBefore = await readFile(file, "utf8"),
    combinedClass = await page
      .getByLabel("Classes", { exact: true })
      .inputValue();
  await page
    .getByRole("button", { name: "Preview spacing patch", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply spacing", exact: true })
    .click();
  await expect(page.getByText(/Saved design properties.*observed/)).toBeVisible(
    { timeout: 30000 },
  );
  assert.equal(
    await readFile(file, "utf8"),
    combinedBefore.replace(inactiveClass, combinedClass),
  );
  assert.deepEqual(
    await preview.locator("#harbor-heading").evaluate((el) => {
      const css = getComputedStyle(el);
      return [css.fontWeight, css.paddingInlineStart, css.paddingInlineEnd];
    }),
    ["500", "8px", "8px"],
  );
  pass(
    "a mixed typography and spacing draft verifies both groups through one source patch",
  );
  const inodeBefore = await stat(file);
  await page
    .getByRole("button", { name: "Apply spacing", exact: true })
    .click();
  await expect(page.getByText(/No change:/)).toBeVisible();
  const inodeAfter = await stat(file);
  assert.equal(inodeBefore.ino, inodeAfter.ino);
  assert.equal(inodeBefore.mtimeMs, inodeAfter.mtimeMs);
  pass("a no-op spacing Apply does not rewrite source");
  await custom("Padding inline", "12");
  const external = `${await readFile(file, "utf8")}\n// Owned spacing conflict test\n`;
  await writeFile(file, external);
  await page
    .getByRole("button", { name: "Apply spacing", exact: true })
    .click();
  await expect(page.locator(".status-error")).toContainText(
    /changed|stale|conflict/i,
  );
  assert.equal(await readFile(file, "utf8"), external);
  pass("stale spacing writes refuse safely and preserve external source bytes");
  await preview.locator("#harbor-secondary").click();
  await expect(
    page.getByText("className is an expression", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply spacing", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Padding inline preset", { exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Text", { exact: true })).toBeEnabled();
  pass(
    "dynamic class expressions keep spacing disabled and static text editable",
  );
  await preview.locator("#hero").click({ position: { x: 5, y: 5 } });
  await expect(
    page.getByLabel("Padding inline preset", { exact: true }),
  ).toBeEnabled();
  await custom("Padding inline", "48");
  const beforeCollapse = await readFile(file, "utf8");
  await page.locator(".spacing-inspector > summary").click();
  await expect(
    page.getByRole("region", { name: "Spacing", exact: true }),
  ).toBeHidden();
  await page.locator(".spacing-inspector > summary").click();
  await expect(
    page.getByLabel("Padding inline px", { exact: true }),
  ).toHaveValue("48");
  assert.equal(await readFile(file, "utf8"), beforeCollapse);
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await page.setViewportSize({ width: 900, height: 800 });
  await page.getByLabel("Padding inline preset", { exact: true }).focus();
  await page.getByLabel("Padding inline preset", { exact: true }).press("Tab");
  await expect(
    page.getByLabel("Padding inline px", { exact: true }),
  ).toBeFocused();
  await page.screenshot({ path: join(evidence, "spacing-dark-narrow.png") });
  pass(
    "dark narrow controls preserve drafts through collapse and maintain native keyboard focus order",
  );
  console.log(`${checks} spacing checks passed.`);
} catch (error) {
  await page
    .screenshot({ path: join(evidence, "failure.png") })
    .catch(() => {});
  throw error;
} finally {
  await context.tracing.stop({ path: join(evidence, "trace.zip") });
  await browser.close();
}
