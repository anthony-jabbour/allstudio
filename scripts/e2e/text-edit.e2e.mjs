// End-to-end check of the Phase 1 text-edit slice in a real browser.
//
// Prerequisites:
//   1. `bun run dev` is running (playground on :5173, workspace preview on :3101).
//   2. Playwright with Chromium can be imported. It is NOT a repository
//      dependency (adding it needs founder approval); use a global install.
//
// Usage: node scripts/e2e/text-edit.e2e.mjs [output-dir]
// Writes trace.zip and screenshots into output-dir (default: ./e2e-output).
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// CommonJS resolution so a global install on NODE_PATH is found.
const { chromium } = createRequire(import.meta.url)("playwright");

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const pageFile = join(
  repoRoot,
  "apps/playground/.workspace/nextjs-site-fixture/src/app/page.tsx",
);
const fixtureFile = join(
  repoRoot,
  "examples/nextjs-site-fixture/src/app/page.tsx",
);
const outDir = resolve(process.argv[2] ?? "e2e-output");
const EDITOR_URL = "http://localhost:5173/";

const sha = (text) => createHash("sha256").update(text).digest("hex");
const results = [];
function record(name, detail = "") {
  results.push({ name, detail });
  console.log(`PASS ${name}${detail ? ` — ${detail}` : ""}`);
}

await mkdir(outDir, { recursive: true });
const fixtureBefore = await readFile(fixtureFile, "utf8");
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1400, height: 1000 },
});
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
const preview = page.frameLocator('iframe[title="Project preview"]');
const textInput = page.getByLabel("Text");

async function selectHeading() {
  await preview.locator("#hero-heading").click();
  await page.getByTestId("source-location").waitFor();
}

try {
  await page.goto(EDITOR_URL);
  await page
    .getByText("Preview bridge: connected")
    .waitFor({ timeout: 60_000 });
  await preview.locator("#hero-heading").waitFor();
  await page.screenshot({ path: join(outDir, "01-loaded.png") });

  // --- Happy path -------------------------------------------------------
  await selectHeading();
  const location = await page.getByTestId("source-location").textContent();
  assert.match(location ?? "", /^src\/app\/page\.tsx:7–/);
  await page.locator(".selection-box").waitFor();
  record("select heading resolves JSX source", location ?? "");

  const before = await readFile(pageFile, "utf8");
  const original = (await textInput.inputValue()).trim();
  const nextText = `Aurora Atelier — edited ${Date.now()}`;
  await textInput.fill(nextText);
  await page.getByRole("button", { name: "Preview patch" }).click();
  await page.locator(".diff").waitFor();
  const previewDiff = await page.locator(".diff").textContent();
  assert.ok(previewDiff?.includes(`+`) && previewDiff.includes(nextText));
  assert.equal(
    await readFile(pageFile, "utf8"),
    before,
    "preview must not write",
  );
  record("patch preview shows diff without writing");

  const appliedAt = Date.now();
  await page.getByRole("button", { name: "Apply" }).click();
  await page
    .getByText("the preview shows the new text")
    .waitFor({ timeout: 30_000 });
  const refreshMs = Date.now() - appliedAt;
  const after = await readFile(pageFile, "utf8");
  assert.ok(after.includes(nextText), "workspace file contains new text");
  // Only the heading's children changed: everything before the heading's
  // opening tag and from `</h1>` on is byte-identical.
  const head = (text) => text.slice(0, text.indexOf('id="hero-heading"'));
  const tail = (text) => text.slice(text.indexOf("</h1>"));
  assert.equal(head(after), head(before));
  assert.equal(tail(after), tail(before));
  assert.notEqual(original, nextText);
  assert.equal(
    (await preview.locator("#hero-heading").textContent())?.trim(),
    nextText,
  );
  await writeFile(
    join(outDir, "page.tsx.diff"),
    (await page.locator(".diff").textContent()) ?? "",
  );
  await page.screenshot({ path: join(outDir, "02-applied.png") });
  // Under 10 s means hot reload delivered it, not the editor's reload fallback.
  record(
    "apply writes JSX file and preview updates",
    `${nextText} (preview refreshed ${refreshMs} ms after Apply)`,
  );

  // --- No-op ------------------------------------------------------------
  const mtimeBefore = (await stat(pageFile)).mtimeMs;
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByText("No change: the text already matches").waitFor();
  assert.equal((await stat(pageFile)).mtimeMs, mtimeBefore);
  record("no-op edit does not rewrite the file");

  // --- Stale write ------------------------------------------------------
  await selectHeading();
  const external = `${await readFile(pageFile, "utf8")}\n`;
  await writeFile(pageFile, external, "utf8");
  await textInput.fill("Should not be written");
  await page.getByRole("button", { name: "Apply" }).click();
  await page
    .getByText("The file changed since this element was selected")
    .waitFor();
  assert.equal(await readFile(pageFile, "utf8"), external);
  record("external change since selection reports a conflict");

  // --- Dynamic children (layout <body>{children}</body>) ------------------
  await preview.locator("body").click({ position: { x: 4, y: 4 } });
  await page.getByText("renders expressions or nested elements").waitFor();
  assert.ok(await textInput.isDisabled());
  record("dynamic {children} element is refused");

  // --- Rendered oid that is not in source --------------------------------
  const frame = page
    .frames()
    .find((f) => f.url().startsWith("http://localhost:3101"));
  assert.ok(frame, "preview frame present");
  await frame.evaluate(() => {
    document.querySelector("main p")?.setAttribute("data-oid", "zzzzzzz");
  });
  await preview.locator("main p").first().click();
  await page.getByText("has no matching data-oid").waitFor();
  record("DOM oid missing from source is refused");

  // --- Duplicate rendered instances --------------------------------------
  await frame.evaluate(() => {
    const heading = document.getElementById("hero-heading");
    heading?.after(heading.cloneNode(true));
  });
  await preview.locator("#hero-heading").first().click();
  await page.getByText("renders 2 times").waitFor();
  assert.ok(await textInput.isDisabled());
  record("ambiguous rendered oid is refused");
  await frame.evaluate(() => location.reload());
  await page
    .getByText("Preview bridge: connected")
    .waitFor({ timeout: 30_000 });

  // --- Forged preview messages ------------------------------------------
  await frame.evaluate(() => {
    window.parent.postMessage(
      {
        source: "allstudio-preview",
        version: 1,
        type: "select",
        nonce: "forged",
        clickedTag: "h1",
        element: null,
      },
      "*",
    );
  });
  await page.getByText("rejected a preview message (stale-nonce)").waitFor();
  const shownBefore = await page.locator(".inspector").textContent();
  await page.evaluate(() => {
    window.postMessage(
      {
        source: "allstudio-preview",
        version: 1,
        type: "select",
        nonce: "x",
        clickedTag: "h1",
        element: null,
      },
      "*",
    );
  });
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".inspector").textContent(), shownBefore);
  record("forged preview messages are rejected");

  // --- Workspace API guards ---------------------------------------------
  const api = await page.evaluate(async () => {
    const token = document
      .querySelector('meta[name="allstudio-dev-session"]')
      ?.getAttribute("content");
    const call = async (headers, body) => {
      const res = await fetch("/__allstudio/workspace/apply-text", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    };
    const edit = { oid: "abcdefg", expectedSha256: "0".repeat(64), text: "x" };
    return {
      noToken: await call({}, { ...edit, path: "src/app/page.tsx" }),
      traversal: await call(
        { "x-allstudio-session": token },
        { ...edit, path: "src/../package.json" },
      ),
      outside: await call(
        { "x-allstudio-session": token },
        { ...edit, path: "../../../package.json" },
      ),
      absolute: await call(
        { "x-allstudio-session": token },
        { ...edit, path: "/etc/passwd" },
      ),
      nodeModules: await call(
        { "x-allstudio-session": token },
        { ...edit, path: "src/../node_modules/next/package.json" },
      ),
    };
  });
  assert.equal(api.noToken.status, 403);
  for (const key of ["traversal", "outside", "absolute", "nodeModules"]) {
    assert.equal(api[key].status, 403, key);
    assert.equal(api[key].body.reason, "path-rejected", key);
  }
  const crossOrigin = await frame.evaluate(async () => {
    try {
      const res = await fetch(
        "http://localhost:5173/__allstudio/workspace/locate",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-allstudio-session": "guess",
          },
          body: JSON.stringify({ oid: "abcdefg" }),
        },
      );
      return `status ${res.status}`;
    } catch (error) {
      return `blocked: ${error.message}`;
    }
  });
  assert.match(crossOrigin, /^blocked/);
  const tokenRead = await frame.evaluate(async () => {
    try {
      const html = await (await fetch("http://localhost:5173/")).text();
      return html.includes("allstudio-dev-session") ? "leaked" : "no token";
    } catch {
      return "blocked";
    }
  });
  assert.equal(tokenRead, "blocked");
  record(
    "workspace API rejects unauthorized paths, tokens and the preview origin",
  );

  assert.equal(await readFile(fixtureFile, "utf8"), fixtureBefore);
  record("examples/ fixture file is unchanged");
} finally {
  await context.tracing.stop({ path: join(outDir, "trace.zip") });
  await browser.close();
}
console.log(
  `\n${results.length} checks passed. Trace: ${join(outDir, "trace.zip")}`,
);
console.log(`final workspace sha256 ${sha(await readFile(pageFile, "utf8"))}`);
