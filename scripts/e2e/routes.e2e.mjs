// Requires bun run dev with disposable fixture copies; no dependency installation.
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const evidence = await mkdtemp(join(tmpdir(), "allstudio-routes-e2e-"));
console.log(`Evidence: ${evidence}`);
const rootFile = resolve(
  "apps/playground/.workspace/aurora-atelier/src/app/page.tsx",
);
const aboutFile = resolve(
  "apps/playground/.workspace/aurora-atelier/src/app/about/page.tsx",
);
const originalRoot = await readFile(rootFile, "utf8");
const originalAbout = await readFile(aboutFile, "utf8");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
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
const pagesList = page.getByRole("list", { name: "Pages", exact: true });
const preview = page.frameLocator('iframe[title="Project preview"]');

try {
  await page.goto("http://localhost:5173/");
  await expect(tree).toBeVisible({ timeout: 30000 });
  await page.locator(".fixture-picker select").selectOption("aurora-atelier");
  await page
    .getByText("Preview bridge: connected", { exact: false })
    .waitFor({ timeout: 60000 });
  await expect(tree.getByRole("treeitem").first()).toBeVisible();

  const rootPageBtn = pagesList.locator('button.page-item[data-route="/"]');
  const aboutPageBtn = pagesList.locator(
    'button.page-item[data-route="/about"]',
  );
  const unsupportedRow = pagesList.locator(
    'li[data-unsupported-route="/journal/[slug]"]',
  );

  await expect(rootPageBtn).toBeVisible();
  await expect(rootPageBtn).toHaveAttribute("aria-current", "page");
  await expect(rootPageBtn).toContainText("src/app/page.tsx");
  await expect(aboutPageBtn).toBeVisible();
  await expect(aboutPageBtn).not.toHaveAttribute("aria-current", "page");
  await expect(aboutPageBtn).toContainText("src/app/about/page.tsx");
  await expect(unsupportedRow).toBeVisible();
  await expect(unsupportedRow).toContainText("Dynamic");
  await expect(unsupportedRow).toContainText("src/app/journal/[slug]/page.tsx");
  await expect(unsupportedRow).toContainText("requires runtime parameters");
  assert.equal(await unsupportedRow.locator("button").count(), 0);
  pass(
    "Pages navigator lists static routes (/ and /about) and marks /journal/[slug] as unsupported Dynamic",
  );

  await preview.locator("#hero-heading").click();
  await expect(page.getByTestId("source-location")).toContainText(
    "src/app/page.tsx",
  );
  await expect(page.getByLabel("Text", { exact: true })).toBeEnabled();
  await page
    .getByLabel("Text", { exact: true })
    .fill("Unsaved heading draft on root");

  await aboutPageBtn.click();
  const confirmBox = page.getByTestId("route-draft-confirm");
  await expect(confirmBox).toBeVisible();
  await expect(confirmBox).toContainText("Unsaved inspector draft on");
  await expect(rootPageBtn).toHaveAttribute("aria-current", "page");
  await expect(preview.locator("#hero-heading")).toBeVisible();
  assert.equal(await readFile(rootFile, "utf8"), originalRoot);
  await page.screenshot({ path: join(evidence, "routes-draft-confirm.png") });
  pass(
    "clicking /about with an unsaved draft opens inline confirmation without navigating or writing disk",
  );

  await confirmBox
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(confirmBox).toBeHidden();
  await expect(rootPageBtn).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("source-location")).toContainText(
    "src/app/page.tsx",
  );
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    "Unsaved heading draft on root",
  );
  pass(
    "Keep editing closes confirmation and preserves current route, selection, and unsaved draft",
  );

  await aboutPageBtn.click();
  await expect(confirmBox).toBeVisible();
  await confirmBox
    .getByRole("button", { name: "Discard and switch", exact: true })
    .click();
  await expect(confirmBox).toBeHidden();
  await expect(aboutPageBtn).toHaveAttribute("aria-current", "page");
  await expect(rootPageBtn).not.toHaveAttribute("aria-current", "page");
  await expect(
    page.getByText("Preview bridge: connected", { exact: false }),
  ).toBeVisible({ timeout: 30000 });
  await expect(preview.locator("#about-heading")).toHaveText(
    "About Aurora Atelier",
    { timeout: 30000 },
  );
  await expect(tree.getByRole("treeitem").first()).toBeVisible();
  await expect(tree).toContainText("About Aurora Atelier");
  await expect(page.getByTestId("source-location")).toHaveCount(0);
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Text", { exact: true })).toBeDisabled();
  assert.equal(await readFile(rootFile, "utf8"), originalRoot);
  pass(
    "Discard and switch navigates preview to /about, refreshes layers, clears inspector selection/drafts, and leaves root source untouched",
  );

  await preview.locator("#about-heading").click();
  await expect(page.getByTestId("source-location")).toContainText(
    "src/app/about/page.tsx",
  );
  await expect(page.getByLabel("Text", { exact: true })).toHaveValue(
    "About Aurora Atelier",
  );
  await page.getByLabel("Text", { exact: true }).fill("About Aurora Studio");
  await page
    .getByRole("button", { name: "Preview text patch", exact: true })
    .click();
  await expect(page.locator(".diff")).toContainText("About Aurora Studio");
  assert.equal(await readFile(aboutFile, "utf8"), originalAbout);
  await page.getByRole("button", { name: "Apply text", exact: true }).click();
  await expect(preview.locator("#about-heading")).toHaveText(
    "About Aurora Studio",
    { timeout: 30000 },
  );
  await expect(
    page.getByText(
      /Saved to src\/app\/about\/page\.tsx and the preview shows the new text/,
    ),
  ).toBeVisible({ timeout: 30000 });
  const aboutAfter = await readFile(aboutFile, "utf8");
  assert.equal(
    aboutAfter,
    originalAbout.replace("About Aurora Atelier", "About Aurora Studio"),
  );
  assert.equal(await readFile(rootFile, "utf8"), originalRoot);
  await writeFile(join(evidence, "about-before.tsx.txt"), originalAbout);
  await writeFile(join(evidence, "about-after.tsx.txt"), aboutAfter);
  await page.screenshot({ path: join(evidence, "routes-about.png") });
  pass(
    "editing #about-heading on /about persists to src/app/about/page.tsx and confirms live preview update",
  );

  const hostileProbes = await page.evaluate(async () => {
    const token =
      document
        .querySelector('meta[name="allstudio-dev-session"]')
        ?.getAttribute("content") ?? "";
    const targets = [
      "//evil.com",
      "http://evil.com",
      "/about/../secret",
      "/journal/[slug]",
      "/missing",
    ];
    const results = [];
    for (const route of targets) {
      const response = await fetch(
        "/__allstudio/workspace/aurora-atelier/select-route",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-allstudio-session": token,
          },
          body: JSON.stringify({ route }),
        },
      );
      const body = await response.json();
      results.push({
        route,
        status: response.status,
        ok: body.ok,
        reason: body.reason,
      });
    }
    return results;
  });
  assert.deepEqual(hostileProbes, [
    { route: "//evil.com", status: 400, ok: false, reason: "invalid-request" },
    {
      route: "http://evil.com",
      status: 400,
      ok: false,
      reason: "invalid-request",
    },
    {
      route: "/about/../secret",
      status: 400,
      ok: false,
      reason: "invalid-request",
    },
    {
      route: "/journal/[slug]",
      status: 422,
      ok: false,
      reason: "route-unsupported",
    },
    { route: "/missing", status: 404, ok: false, reason: "route-not-found" },
  ]);
  await expect(aboutPageBtn).toHaveAttribute("aria-current", "page");
  await expect(preview.locator("#about-heading")).toHaveText(
    "About Aurora Studio",
  );
  pass(
    "hostile, unsupported, and missing select-route requests are rejected with 400/422/404 without altering preview",
  );

  await rootPageBtn.click();
  await expect(rootPageBtn).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByText("Preview bridge: connected", { exact: false }),
  ).toBeVisible({ timeout: 30000 });
  await expect(preview.locator("#hero-heading")).toHaveText("Aurora Atelier", {
    timeout: 30000,
  });
  pass("switching back to / renders #hero-heading on the root route");

  await writeFile(
    join(evidence, "measured.json"),
    JSON.stringify(
      {
        discoveredRoutes: ["/", "/about"],
        unsupportedRoutes: ["/journal/[slug]"],
        hostileProbes,
        checks,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(`${checks} route checks passed.`);
} catch (error) {
  await page
    .screenshot({ path: join(evidence, "failure.png") })
    .catch(() => {});
  throw error;
} finally {
  await writeFile(rootFile, originalRoot).catch(() => {});
  await writeFile(aboutFile, originalAbout).catch(() => {});
  await context.tracing.stop({ path: join(evidence, "trace.zip") });
  await browser.close();
}
