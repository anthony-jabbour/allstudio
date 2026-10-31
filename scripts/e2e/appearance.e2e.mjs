// Requires bun run dev with disposable fixture copies.
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const evidence = await mkdtemp(join(tmpdir(), "allstudio-appearance-e2e-"));
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
const CTA =
  "rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-sky-600";
let checks = 0;
const pass = (message) => {
  checks++;
  console.log(`PASS ${message}`);
};
const apply = async () => {
  await page
    .getByRole("button", { name: "Preview appearance patch", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply appearance", exact: true })
    .click();
  await expect(page.getByText(/Saved appearance.*observed/)).toBeVisible({
    timeout: 15000,
  });
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
  await preview.locator("#harbor-cta").click();
  await expect(page.getByTestId("source-location")).toBeVisible();
  await page.getByLabel("Classes", { exact: true }).fill(CTA);
  await page
    .getByRole("button", { name: "Apply classes", exact: true })
    .click();
  await expect
    .poll(() => preview.locator("#harbor-cta").getAttribute("class"))
    .toContain("bg-sky-600");
  await expect(
    page.getByRole("button", { name: "Apply classes", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Classes", { exact: true })).toHaveValue(CTA);
  await expect(
    page.getByRole("region", { name: "Appearance properties", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Background colour preset", { exact: true }),
  ).toBeEnabled();
  const before = await readFile(file, "utf8");
  await page
    .getByLabel("Background colour preset", { exact: true })
    .selectOption("custom:hex");
  await page
    .getByLabel("Background colour hex", { exact: true })
    .pressSequentially("#112233");
  assert.equal(await readFile(file, "utf8"), before);
  await page
    .getByRole("button", { name: "Preview appearance patch", exact: true })
    .click();
  await expect(page.locator(".diff")).toContainText("bg-[#112233]");
  assert.equal(await readFile(file, "utf8"), before);
  await page
    .getByRole("button", { name: "Apply appearance", exact: true })
    .click();
  await expect
    .poll(() =>
      preview
        .locator("#harbor-cta")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .toBe("rgb(17, 34, 51)");
  await expect(page.getByText(/Saved appearance.*observed/)).toBeVisible({
    timeout: 15000,
  });
  const afterColor = await readFile(file, "utf8");
  assert.equal(afterColor, before.replace("bg-sky-600", "bg-[#112233]"));
  assert.ok(afterColor.includes("hover:bg-sky-500"));
  assert.ok(afterColor.includes("focus-visible:outline-sky-600"));
  await writeFile(join(evidence, "source-before.tsx"), before);
  await writeFile(join(evidence, "source-after.tsx"), afterColor);
  await page.screenshot({ path: join(evidence, "appearance.png") });
  pass(
    "Harbor CTA Base colour previews then saves only bg-sky-600 and confirms rendered sRGB",
  );

  await page
    .getByLabel("Corner radius preset", { exact: true })
    .selectOption("custom:px");
  await page.getByLabel("Corner radius px", { exact: true }).fill("12");
  await apply();
  await expect
    .poll(() =>
      preview
        .locator("#harbor-cta")
        .evaluate((el) => getComputedStyle(el).borderRadius),
    )
    .toBe("12px");
  const afterRadius = await readFile(file, "utf8");
  assert.equal(
    afterRadius,
    afterColor.replace("rounded-full", "rounded-[12px]"),
  );
  assert.ok(afterRadius.includes("hover:bg-sky-500"));
  pass("uniform radius 12px replaces rounded-full and keeps hover/focus bytes");

  const inode = await stat(file);
  await page
    .getByRole("button", { name: "Apply appearance", exact: true })
    .click();
  await expect(page.getByText(/No change:/)).toBeVisible();
  const noChange = await stat(file);
  assert.equal(noChange.ino, inode.ino);
  assert.equal(noChange.mtimeMs, inode.mtimeMs);
  pass("unchanged appearance does not rewrite source");

  await page.getByLabel("Corner radius px", { exact: true }).fill("2049");
  await expect(
    page.getByRole("button", { name: "Apply appearance", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Apply typography", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Apply spacing", exact: true }),
  ).toBeDisabled();
  assert.equal(await readFile(file, "utf8"), afterRadius);
  await page.getByLabel("Corner radius px", { exact: true }).fill("12");
  await expect(
    page.getByRole("button", { name: "Apply appearance", exact: true }),
  ).toBeEnabled();
  pass(
    "invalid appearance drafts block every design Apply without source writes",
  );

  await page.getByLabel("Corner radius px", { exact: true }).fill("16");
  const draftA = await page.getByLabel("Classes", { exact: true }).inputValue();
  await page
    .getByLabel("Classes", { exact: true })
    .fill(draftA.replace("rounded-[16px]", "rounded-[8px]"));
  await expect(
    page.getByLabel("Corner radius px", { exact: true }),
  ).toHaveValue("8");
  await page.getByLabel("Classes", { exact: true }).fill(draftA);
  await expect(
    page.getByLabel("Corner radius px", { exact: true }),
  ).toHaveValue("16");
  await page
    .getByLabel("Classes", { exact: true })
    .fill(afterRadius.match(/className="([^"]*rounded-\[12px\][^"]*)"/)[1]);
  await expect(
    page.getByLabel("Corner radius px", { exact: true }),
  ).toHaveValue("12");
  pass(
    "manual class draft A/B/A changes resynchronize the inspector without stale local values",
  );

  const cssFile = resolve(
    "apps/playground/.workspace/harbor-studio/src/app/globals.css",
  );
  const originalCss = await readFile(cssFile, "utf8");
  try {
    await writeFile(
      cssFile,
      `${originalCss}\n#harbor-cta { background-color: rgb(2, 132, 199) !important; }\n`,
    );
    await page.reload();
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
    await preview.locator("#harbor-cta").click();
    await expect(page.getByLabel("Classes", { exact: true })).toHaveValue(
      /bg-\[#112233\]/,
    );
    await expect
      .poll(() =>
        preview
          .locator("#harbor-cta")
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      )
      .toBe("rgb(2, 132, 199)");
    await page
      .getByLabel("Background colour hex", { exact: true })
      .fill("#445566");
    await page
      .getByRole("button", { name: "Apply appearance", exact: true })
      .click();
    await expect(
      page.getByText(/Appearance source saved, but rendering is unconfirmed/),
    ).toBeVisible({ timeout: 25000 });
    assert.equal(
      await readFile(file, "utf8"),
      afterRadius.replace("bg-[#112233]", "bg-[#445566]"),
    );
    assert.equal(
      await preview
        .locator("#harbor-cta")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(2, 132, 199)",
    );
    await page.screenshot({
      path: join(evidence, "overridden-unconfirmed.png"),
    });
    pass(
      "overriding CSS keeps the source colour edit and reports rendering unconfirmed",
    );
  } finally {
    await writeFile(cssFile, originalCss);
  }
  await page.reload();
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
  await preview.locator("#harbor-cta").click();
  await expect(page.getByLabel("Classes", { exact: true })).toHaveValue(
    /bg-\[#445566\]/,
  );
  await expect(
    page.getByLabel("Background colour preset", { exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Font weight preset", { exact: true })
    .selectOption("font-medium");
  await expect(
    page.getByLabel("Corner radius px", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Corner radius px", { exact: true }).fill("8");
  const mixedBefore = await readFile(file, "utf8");
  const previousClass = mixedBefore.match(
    /id="harbor-cta"[\s\S]*?className="([^"]+)"/,
  )?.[1];
  const mixedClass = await page
    .getByLabel("Classes", { exact: true })
    .inputValue();
  assert.ok(previousClass);
  await page
    .getByRole("button", { name: "Preview appearance patch", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply appearance", exact: true })
    .click();
  await expect(page.getByText(/Saved design properties.*observed/)).toBeVisible(
    {
      timeout: 15000,
    },
  );
  assert.equal(
    await readFile(file, "utf8"),
    mixedBefore.replace(previousClass, mixedClass),
  );
  assert.deepEqual(
    await preview.locator("#harbor-cta").evaluate((el) => {
      const css = getComputedStyle(el);
      return [css.fontWeight, css.backgroundColor, css.borderRadius];
    }),
    ["500", "rgb(68, 85, 102)", "8px"],
  );
  pass(
    "a mixed typography and appearance draft verifies both groups through one source patch",
  );

  await preview.locator("#harbor-secondary").click();
  await expect(
    page.getByText("className is an expression", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply appearance", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Background colour preset", { exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Text", { exact: true })).toBeEnabled();
  pass(
    "dynamic class expressions keep appearance disabled and static text editable",
  );

  await preview.locator("#harbor-cta").click();
  await expect(
    page.getByLabel("Background colour preset", { exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Background colour preset", { exact: true })
    .selectOption("bg-white");
  const external = `${await readFile(file, "utf8")}\n// Owned appearance conflict test\n`;
  await writeFile(file, external);
  await page
    .getByRole("button", { name: "Apply appearance", exact: true })
    .click();
  await expect(page.locator(".status-error")).toContainText(
    /changed|stale|conflict/i,
  );
  assert.equal(await readFile(file, "utf8"), external);
  pass(
    "stale appearance writes refuse safely and preserve external source bytes",
  );

  await page.locator(".appearance-inspector > summary").click();
  await expect(
    page.getByRole("region", { name: "Appearance properties", exact: true }),
  ).toBeHidden();
  const beforeCollapse = await readFile(file, "utf8");
  await page.locator(".appearance-inspector > summary").click();
  await expect(
    page.getByLabel("Background colour preset", { exact: true }),
  ).toHaveValue("bg-white");
  assert.equal(await readFile(file, "utf8"), beforeCollapse);
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await page.setViewportSize({ width: 900, height: 800 });
  await page.getByLabel("Background colour preset", { exact: true }).focus();
  await expect(
    page.getByLabel("Background colour preset", { exact: true }),
  ).toBeFocused();
  await page.screenshot({ path: join(evidence, "appearance-dark-narrow.png") });
  pass(
    "dark narrow controls preserve drafts through collapse and remain keyboard reachable",
  );
  console.log(`${checks} appearance checks passed.`);
} catch (error) {
  await page
    .screenshot({ path: join(evidence, "failure.png") })
    .catch(() => {});
  throw error;
} finally {
  await context.tracing.stop({ path: join(evidence, "trace.zip") });
  await browser.close();
}
