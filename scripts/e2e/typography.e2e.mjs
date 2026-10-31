// Run with bun run dev and disposable fixtures. Uses the installed Playwright dependency.
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const evidence = await mkdtemp(join(tmpdir(), "allstudio-typography-e2e-"));
console.log(`Evidence: ${evidence}`);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
});
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
const preview = page.frameLocator('iframe[title="Project preview"]');
const file = resolve(
  "apps/playground/.workspace/aurora-atelier/src/app/page.tsx",
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
  await page
    .getByLabel("Edit breakpoint", { exact: true })
    .selectOption("base");
  await preview.locator("h1").click();
  await expect(page.getByTestId("source-location")).toBeVisible();
  const typography = page.getByRole("region", {
    name: "Typography",
    exact: true,
  });
  await expect(typography).toBeVisible({ timeout: 5000 });

  await page
    .getByLabel("Classes", { exact: true })
    .fill(
      "max-w-xl text-5xl leading-tight font-semibold tracking-tight text-zinc-950",
    );
  await page
    .getByRole("button", { name: "Apply classes", exact: true })
    .click();
  await expect
    .poll(() =>
      preview
        .locator("h1")
        .evaluate((element) => getComputedStyle(element).fontSize),
    )
    .toBe("48px");
  await expect(
    page.getByRole("button", { name: "Apply classes", exact: true }),
  ).toBeEnabled();
  const before = await readFile(file, "utf8");
  await page.getByLabel("Text", { exact: true }).fill("Keep this text draft");
  await page
    .getByLabel("Font size preset", { exact: true })
    .selectOption("custom:px");
  await page.getByLabel("Font size px", { exact: true }).fill("36");
  assert.equal(await readFile(file, "utf8"), before);
  await page
    .getByRole("button", { name: "Preview typography patch", exact: true })
    .click();
  await expect(page.locator(".diff")).toContainText("text-[36px]");
  assert.equal(await readFile(file, "utf8"), before);
  await page
    .getByRole("button", { name: "Apply typography", exact: true })
    .click();
  await expect
    .poll(() =>
      preview
        .locator("h1")
        .evaluate((element) => getComputedStyle(element).fontSize),
    )
    .toBe("36px");
  await expect(page.getByText(/Saved typography.*observed/)).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByTestId("rendered-fontSize")).toHaveText("36px");
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    "Keep this text draft",
  );
  const after = await readFile(file, "utf8");
  assert.equal(after, before.replace("text-5xl", "text-[36px]"));
  await writeFile(join(evidence, "size-before.tsx"), before);
  await writeFile(join(evidence, "size-after.tsx"), after);
  await page.screenshot({ path: join(evidence, "typography.png") });
  pass(
    "visual size control previews then saves only the intended utility and confirms real rendering",
  );
  const fileInfo = await stat(file);
  await page
    .getByRole("button", { name: "Apply typography", exact: true })
    .click();
  await expect(page.getByText(/No change:/)).toBeVisible();
  const noChange = await stat(file);
  assert.equal(noChange.ino, fileInfo.ino);
  assert.equal(noChange.mtimeMs, fileInfo.mtimeMs);
  pass(
    "unchanged typography does not rewrite source and preserves the unsaved text draft",
  );

  const apply = async () => {
    await page
      .getByRole("button", { name: "Preview typography patch", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Apply typography", exact: true })
      .click();
    await expect(page.getByText(/Saved typography.*observed/)).toBeVisible({
      timeout: 15000,
    });
  };
  await page
    .getByLabel("Font weight preset", { exact: true })
    .selectOption("font-bold");
  await apply();
  assert.equal(
    await preview
      .locator("h1")
      .evaluate((element) => getComputedStyle(element).fontWeight),
    "700",
  );
  await page
    .getByLabel("Line height preset", { exact: true })
    .selectOption("custom:ratio");
  await page.getByLabel("Line height ratio", { exact: true }).fill("1.5");
  await apply();
  assert.equal(
    await preview
      .locator("h1")
      .evaluate((element) => getComputedStyle(element).lineHeight),
    "54px",
  );
  await page
    .getByLabel("Text alignment preset", { exact: true })
    .selectOption("text-center");
  await apply();
  assert.equal(
    await preview
      .locator("h1")
      .evaluate((element) => getComputedStyle(element).textAlign),
    "center",
  );
  await page
    .getByLabel("Text colour preset", { exact: true })
    .selectOption("custom:hex");
  await page
    .getByLabel("Text colour hex", { exact: true })
    .pressSequentially("#112233");
  await expect(page.getByLabel("Text colour hex", { exact: true })).toHaveValue(
    "#112233",
  );
  await apply();
  assert.equal(
    await preview
      .locator("h1")
      .evaluate((element) => getComputedStyle(element).color),
    "rgb(17, 34, 51)",
  );
  await page
    .getByLabel("Font family preset", { exact: true })
    .selectOption("font-mono");
  await apply();
  assert.ok(
    (
      await preview
        .locator("h1")
        .evaluate((element) => getComputedStyle(element).fontFamily)
    ).includes("Geist Mono"),
  );
  const six = await readFile(file, "utf8");
  assert.equal(
    six,
    before
      .replace("text-5xl", "text-[36px]")
      .replace("leading-tight", "leading-[1.5]")
      .replace("font-semibold", "font-bold")
      .replace("text-zinc-950", "text-[#112233] text-center font-mono"),
  );
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    "Keep this text draft",
  );
  await page.screenshot({ path: join(evidence, "six-properties.png") });
  await writeFile(join(evidence, "six-after.tsx"), six);
  pass(
    "all six controls persist their scoped source changes and actual computed properties",
  );
  await page.getByLabel("Font size px", { exact: true }).fill("513");
  await expect(
    page.getByRole("button", { name: "Apply typography", exact: true }),
  ).toBeDisabled();
  assert.equal(await readFile(file, "utf8"), six);
  await page.getByLabel("Font size px", { exact: true }).fill("36");
  await expect(
    page.getByRole("button", { name: "Apply typography", exact: true }),
  ).toBeEnabled();
  pass("invalid property values remain local drafts and cannot write source");
  await page.getByLabel("Font size px", { exact: true }).fill("40");
  const draftA = await page.getByLabel("Classes", { exact: true }).inputValue();
  await page
    .getByLabel("Classes", { exact: true })
    .fill(draftA.replace("text-[40px]", "text-[35px]"));
  await expect(page.getByLabel("Font size px", { exact: true })).toHaveValue(
    "35",
  );
  await page.getByLabel("Classes", { exact: true }).fill(draftA);
  await expect(page.getByLabel("Font size px", { exact: true })).toHaveValue(
    "40",
  );
  await page
    .getByLabel("Classes", { exact: true })
    .fill(six.match(/className="([^"]*text-\[36px\][^"]*)"/)[1]);
  await expect(page.getByLabel("Font size px", { exact: true })).toHaveValue(
    "36",
  );
  pass(
    "manual class draft A/B/A changes resynchronize the inspector without stale local values",
  );
  const cssFile = resolve(
    "apps/playground/.workspace/aurora-atelier/src/app/globals.css",
  );
  const originalCss = await readFile(cssFile, "utf8");
  try {
    await writeFile(
      cssFile,
      `${originalCss}\nh1 { font-size: 36px !important; }\n`,
    );
    await page.reload();
    await page
      .getByText("Preview bridge: connected", { exact: false })
      .waitFor({ timeout: 60000 });
    await page
      .getByLabel("Edit breakpoint", { exact: true })
      .selectOption("base");
    await preview.locator("h1").click();
    await expect
      .poll(() =>
        preview
          .locator("h1")
          .evaluate((element) => getComputedStyle(element).fontSize),
      )
      .toBe("36px");
    await page.getByLabel("Font size px", { exact: true }).fill("40");
    await page
      .getByRole("button", { name: "Apply typography", exact: true })
      .click();
    await expect(
      page.getByText(/Typography source saved, but rendering is unconfirmed/),
    ).toBeVisible({ timeout: 25000 });
    assert.equal(
      await readFile(file, "utf8"),
      six.replace("text-[36px]", "text-[40px]"),
    );
    assert.equal(
      await preview
        .locator("h1")
        .evaluate((element) => getComputedStyle(element).fontSize),
      "36px",
    );
    await page.screenshot({
      path: join(evidence, "overridden-unconfirmed.png"),
    });
    await writeFile(
      join(evidence, "overridden-source.tsx"),
      await readFile(file, "utf8"),
    );
    pass(
      "overriding CSS keeps the source edit and reports rendering unconfirmed without automatic rollback",
    );
  } finally {
    await writeFile(cssFile, originalCss);
  }
  // The external CSS override is test-owned. Reload after teardown so a
  // cached stylesheet cannot leak into the remaining independent checks.
  await page.reload();
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60000 });
  await page
    .getByLabel("Edit breakpoint", { exact: true })
    .selectOption("base");
  await preview.locator("h1").click();
  await expect
    .poll(() =>
      preview
        .locator("h1")
        .evaluate((element) => getComputedStyle(element).fontSize),
    )
    .toBe("40px");
  await page.setViewportSize({ width: 900, height: 800 });
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await page.screenshot({ path: join(evidence, "dark-narrow.png") });
  await page.getByLabel("Font weight preset", { exact: true }).focus();
  await expect(
    page.getByLabel("Font weight preset", { exact: true }),
  ).toBeFocused();
  pass(
    "typography controls remain keyboard reachable in dark mode at a narrow desktop width",
  );
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.locator(".fixture-picker select").selectOption("harbor-studio");
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60000 });
  await page
    .getByLabel("Edit breakpoint", { exact: true })
    .selectOption("base");
  await preview.locator("#harbor-secondary").click();
  await expect(
    page.getByText("className is an expression", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Font size preset", { exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Text", { exact: true })).toBeEnabled();
  pass(
    "dynamic class expressions disable typography while static text remains editable",
  );
  await preview.locator("#harbor-heading").click();
  await expect(
    page.getByLabel("Font size preset", { exact: true }),
  ).toBeEnabled();
  const harborFile = resolve(
    "apps/playground/.workspace/harbor-studio/src/app/page.tsx",
  );
  const harborBefore = await readFile(harborFile, "utf8");
  await page
    .getByLabel("Font size preset", { exact: true })
    .selectOption("text-3xl");
  await page
    .getByRole("button", { name: "Apply typography", exact: true })
    .click();
  await expect(
    page.getByText(/Typography source saved, but rendering is unconfirmed/),
  ).toBeVisible({ timeout: 25000 });
  assert.equal(
    await readFile(harborFile, "utf8"),
    harborBefore.replace("text-4xl", "text-3xl"),
  );
  assert.equal(
    await preview
      .locator("#harbor-heading")
      .evaluate((el) => getComputedStyle(el).fontSize),
    "60px",
  );
  await writeFile(
    join(evidence, "responsive-after.tsx"),
    await readFile(harborFile, "utf8"),
  );
  pass(
    "Base edit preserves sm/lg variants and truthfully reports unchanged desktop rendering",
  );
  await page
    .getByLabel("Font size preset", { exact: true })
    .selectOption("text-2xl");
  const external = `${await readFile(harborFile, "utf8")}\n// Owned stale-write test\n`;
  await writeFile(harborFile, external);
  await page
    .getByRole("button", { name: "Apply typography", exact: true })
    .click();
  await expect(page.locator(".status-error")).toContainText(
    /changed|stale|conflict/i,
  );
  assert.equal(await readFile(harborFile, "utf8"), external);
  pass(
    "stale typography hash refuses the save and preserves external source bytes",
  );
  console.log(`${checks} typography checks passed.`);
} catch (error) {
  await page
    .screenshot({ path: join(evidence, "failure.png") })
    .catch(() => {});
  throw error;
} finally {
  await context.tracing.stop({ path: join(evidence, "trace.zip") });
  await browser.close();
}
