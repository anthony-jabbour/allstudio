// End-to-end check of the Phase 1 source-edit slices in a real browser:
// three fixtures; heading/button/layout selection; text and className edits;
// refusals; preview-bridge and workspace-API guards.
//
// Prerequisites:
//   1. `bun run dev` is running (playground on :5173, fixture previews on
//      :3101 Aurora Atelier, :3102 Lumen Notes, :3103 Harbor Studio).
//      Start from fresh copies with ALLSTUDIO_RESET_WORKSPACE=1.
//   2. Playwright with Chromium can be imported. It is NOT a repository
//      dependency (adding it needs founder approval); use a global install.
//
// Usage: node scripts/e2e/text-edit.e2e.mjs [output-dir]
// Writes trace.zip, a .webm screen recording, screenshots and per-edit diffs
// into output-dir (default: ./e2e-output).
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// CommonJS resolution so a global install on NODE_PATH is found.
const { chromium } = createRequire(import.meta.url)("playwright");

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workspaceRoot = join(repoRoot, "apps/playground/.workspace");
const pageFile = join(workspaceRoot, "aurora-atelier/src/app/page.tsx");
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

/** sha256 of every source file under examples/ (no node_modules/.next). */
async function snapshotExamples() {
  const hashes = {};
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (["node_modules", ".next"].includes(entry.name)) {
        continue;
      }
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile() && !entry.name.endsWith(".tsbuildinfo")) {
        hashes[path.slice(repoRoot.length + 1)] = sha(await readFile(path));
      }
    }
  };
  await walk(join(repoRoot, "examples"));
  return hashes;
}

await mkdir(outDir, { recursive: true });
const examplesBefore = await snapshotExamples();
const fixtureBefore = await readFile(fixtureFile, "utf8");
const browser = await chromium.launch();
// A screen recording of the whole run (webm) is saved next to the trace.
const context = await browser.newContext({
  viewport: { width: 1400, height: 1000 },
  recordVideo: { dir: outDir, size: { width: 1400, height: 1000 } },
});
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
const preview = page.frameLocator('iframe[title="Project preview"]');
const textInput = page.getByLabel("Text", { exact: true });
const classInput = page.getByLabel("Classes", { exact: true });
const button = (name) => page.getByRole("button", { name, exact: true });

/**
 * A point inside `locator` whose topmost element is the element itself
 * (not a child), so layout containers can be clicked directly.
 */
async function ownPoint(locator) {
  return locator.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    for (let y = 1; y < rect.height; y += 4) {
      for (let x = 1; x < rect.width; x += 8) {
        if (document.elementFromPoint(rect.left + x, rect.top + y) === el) {
          return { x, y };
        }
      }
    }
    return null;
  });
}

/** Clicks an element in the preview and waits for its source location. */
async function select(locator, expectedLocation) {
  // A matching source label can belong to the previous selection; wait for this lookup.
  for (let attempt = 0; ; attempt += 1) {
    try {
      await locator.waitFor();
      const oid = await locator.getAttribute("data-oid");
      const position = await ownPoint(locator);
      assert.ok(position, "element has a clickable spot of its own");
      const [response] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/__allstudio/workspace/") &&
            response.url().endsWith("/locate") &&
            response.request().postDataJSON()?.oid === oid,
        ),
        locator.click({ position }),
      ]);
      const result = await response.json();
      assert.equal(result.ok, true);
      await page.waitForFunction((element) => {
        const input = (name) =>
          [...document.querySelectorAll("label")]
            .find((label) => label.firstChild?.textContent?.trim() === name)
            ?.querySelector("input");
        const text = input("Text"),
          classes = input("Classes");
        return (
          text &&
          classes &&
          (element.text.ok
            ? !text.disabled && text.value === element.text.text
            : text.disabled) &&
          (element.className.ok
            ? !classes.disabled &&
              classes.value === (element.className.value ?? "")
            : classes.disabled)
        );
      }, result.element);
      break;
    } catch (error) {
      if (
        attempt >= 3 ||
        !/context was destroyed|detached/i.test(String(error))
      )
        throw error;
      await page.waitForTimeout(500);
    }
  }
  const located = page.getByTestId("source-location");
  await located.waitFor();
  if (expectedLocation) await page.getByText(expectedLocation).waitFor();
  return (await located.textContent()) ?? "";
}

/**
 * Applies a text or class edit through the panel and checks that the file
 * changed only inside the selected element's line range and that the
 * preview shows the result.
 */
async function applyEdit({ file, kind, value, label }) {
  const location =
    (await page.getByTestId("source-location").textContent()) ?? "";
  const [, startLine, endLine] = location.match(/:(\d+)–(\d+)$/) ?? [];
  const before = await readFile(file, "utf8");
  await (kind === "text" ? textInput : classInput).fill(value);
  const appliedAt = Date.now();
  await button(kind === "text" ? "Apply text" : "Apply classes").click();
  await page
    .getByText(
      `the preview shows the new ${kind === "text" ? "text" : "classes"}`,
    )
    .waitFor({ timeout: 30_000 });
  const refreshMs = Date.now() - appliedAt;
  const after = await readFile(file, "utf8");
  assert.notEqual(after, before, `${label}: file changed`);
  const a = before.split("\n");
  const b = after.split("\n");
  assert.equal(b.length, a.length, `${label}: line count kept`);
  const changed = a.flatMap((line, i) => (line === b[i] ? [] : [i + 1]));
  for (const line of changed) {
    assert.ok(
      line >= Number(startLine) && line <= Number(endLine),
      `${label}: line ${line} outside ${location}`,
    );
  }
  const diff = (await page.locator(".diff").textContent()) ?? "";
  await writeFile(join(outDir, `${label}.diff`), diff);
  record(
    label,
    `${location}; lines changed ${changed.join(",")}; preview ${refreshMs} ms`,
  );
  return diff;
}

async function expectRefusal(locator, message, label) {
  await locator.click();
  await page.getByText(message).first().waitFor();
  record(label, message);
}

async function switchFixture(id, previewPort, readySelector) {
  await page.getByRole("combobox", { name: /^Fixture/ }).selectOption(id);
  await page
    .getByText("Preview bridge: connected")
    .waitFor({ timeout: 60_000 });
  const frameLocator = page.frameLocator('iframe[title="Project preview"]');
  await frameLocator.locator(readySelector).waitFor({ timeout: 60_000 });
  assert.ok(
    page
      .frames()
      .some((f) => f.url().startsWith(`http://localhost:${previewPort}`)),
  );
  return frameLocator;
}

async function selectHeading() {
  await select(preview.locator("#hero-heading"), "src/app/page.tsx:7–");
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
  await button("Preview text patch").click();
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
  await button("Apply text").click();
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
  await button("Apply text").click();
  await page.getByText("No change: the text already matches").waitFor();
  assert.equal((await stat(pageFile)).mtimeMs, mtimeBefore);
  record("no-op edit does not rewrite the file");

  // --- Selection change while the lookup is in flight -------------------
  await selectHeading();
  await textInput.fill("Draft meant for the heading");
  // Delay only the next lookup.
  await page.route(
    "**/__allstudio/workspace/*/locate",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue().catch(() => {});
    },
    { times: 1 },
  );
  await preview.locator("main p").nth(1).click();
  // The select message arrives asynchronously; well inside the 1.5 s delay
  // the field must be cleared and disabled while the lookup is pending.
  await page.waitForFunction(
    () => {
      const input = [...document.querySelectorAll("label")]
        .find((label) => label.firstChild?.textContent?.trim() === "Text")
        ?.querySelector("input");
      return input?.disabled === true && input.value === "";
    },
    undefined,
    { timeout: 1000 },
  );
  assert.equal(
    await page.getByTestId("source-location").count(),
    0,
    "no source shown until the new lookup returns",
  );
  await page.getByText("src/app/page.tsx:13–").waitFor();
  assert.notEqual(await textInput.inputValue(), "Draft meant for the heading");
  record("old draft is cleared while a new selection is looked up");

  // --- Stale write ------------------------------------------------------
  await selectHeading();
  const beforeExternal = await readFile(pageFile, "utf8");
  const external = `${beforeExternal}\n`;
  await writeFile(pageFile, external, "utf8");
  await textInput.fill("Should not be written");
  await button("Apply text").click();
  await page
    .getByText("The file changed since this element was selected")
    .waitFor();
  assert.equal(await readFile(pageFile, "utf8"), external);
  // Undo the simulated external edit so the script can be re-run.
  await writeFile(pageFile, beforeExternal, "utf8");
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
        version: 7,
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
        version: 7,
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
      const res = await fetch(
        "/__allstudio/workspace/aurora-atelier/apply-text",
        {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify(body),
        },
      );
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
        "http://localhost:5173/__allstudio/workspace/aurora-atelier/locate",
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

  // --- Aurora: button text, heading classes, layout classes ----------------
  await select(preview.locator("main button"), "src/app/page.tsx:18–23");
  const unsavedClasses = `${await classInput.inputValue()} unsaved-draft`;
  await classInput.fill(unsavedClasses);
  await applyEdit({
    file: pageFile,
    kind: "text",
    value: "Start a new project",
    label: "aurora-button-text",
  });
  assert.equal(
    await classInput.inputValue(),
    unsavedClasses,
    "applying text keeps the unsaved classes draft",
  );
  assert.ok(!(await readFile(pageFile, "utf8")).includes("unsaved-draft"));
  record("applying one field keeps the other field's unsaved draft");
  await selectHeading();
  const colorBefore = await preview
    .locator("#hero-heading")
    .evaluate((el) => getComputedStyle(el).color);
  const headingClasses = await classInput.inputValue();
  assert.ok(headingClasses.includes("text-zinc-950"));
  await applyEdit({
    file: pageFile,
    kind: "className",
    value: headingClasses.replace("text-zinc-950", "text-emerald-700"),
    label: "aurora-heading-classes",
  });
  const colorAfter = await preview
    .locator("#hero-heading")
    .evaluate((el) => getComputedStyle(el).color);
  assert.notEqual(colorAfter, colorBefore, "Tailwind applied the new color");
  record(
    "new Tailwind class is compiled and rendered",
    `${colorBefore} → ${colorAfter}`,
  );
  // --- Editing stays locked until a save is confirmed ----------------------
  await selectHeading();
  await page.route(
    "**/__allstudio/workspace/*/locate",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue().catch(() => {});
    },
    { times: 1 },
  );
  await textInput.fill("Aurora Atelier — locked while saving");
  await button("Apply text").click();
  // The preview updates first; the delayed post-save lookup then holds the
  // confirmation. During that window nothing can start a second edit.
  await preview
    .locator("#hero-heading", { hasText: "locked while saving" })
    .waitFor({ timeout: 30_000 });
  assert.ok(await classInput.isDisabled(), "classes locked until confirmed");
  assert.ok(await button("Apply classes").isDisabled());
  assert.equal(
    await page.getByText("the preview shows the new text").count(),
    0,
    "no success message before the refresh",
  );
  await page
    .getByText("the preview shows the new text")
    .waitFor({ timeout: 30_000 });
  assert.ok(!(await classInput.isDisabled()), "editing available again");
  record("editing is locked from Apply until the save is confirmed");

  // --- A stalled post-save lookup cannot keep editing locked ---------------
  await selectHeading();
  await page.route(
    "**/__allstudio/workspace/*/locate",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 15_000));
      await route.continue().catch(() => {});
    },
    { times: 1 },
  );
  await textInput.fill("Aurora Atelier — stalled refresh");
  await button("Apply text").click();
  await page
    .getByText("refreshing the source details timed out")
    .waitFor({ timeout: 30_000 });
  assert.ok(
    !(await classInput.isDisabled()),
    "editing unlocked after deadline",
  );
  assert.ok(
    (await readFile(pageFile, "utf8")).includes(
      "Aurora Atelier — stalled refresh",
    ),
  );
  // The late lookup result is ignored: the timeout message stays.
  await page.waitForTimeout(6_000);
  assert.equal(
    await page.getByText("refreshing the source details timed out").count(),
    1,
  );
  record("a stalled post-save lookup times out and unlocks editing");

  await select(preview.locator("main"), "src/app/page.tsx:3–24");
  await page.getByText("renders expressions or nested elements").waitFor();
  assert.ok(await textInput.isDisabled(), "layout text is not editable");
  await applyEdit({
    file: pageFile,
    kind: "className",
    value: (await classInput.inputValue()).replace("gap-6", "gap-10"),
    label: "aurora-layout-classes",
  });
  await page.screenshot({ path: join(outDir, "03-aurora-edited.png") });

  assert.equal(await readFile(fixtureFile, "utf8"), fixtureBefore);
  record("examples/ fixture file is unchanged");

  // --- Lumen Notes: nested components ------------------------------------
  const lumen = await switchFixture("lumen-notes", 3102, "#lumen-heading");
  const lumenDir = join(workspaceRoot, "lumen-notes/src");
  await select(lumen.locator("#lumen-heading"), "src/app/page.tsx:12–17");
  await applyEdit({
    file: join(lumenDir, "app/page.tsx"),
    kind: "text",
    value: "Lumen Notebook",
    label: "lumen-heading-text",
  });
  await select(
    lumen.locator("#new-note-button"),
    "src/components/new-note-button.tsx:3–9",
  );
  await page.getByText("in NewNoteButton").waitFor();
  await applyEdit({
    file: join(lumenDir, "components/new-note-button.tsx"),
    kind: "text",
    value: "Write a note",
    label: "lumen-nested-button-text",
  });
  await select(lumen.locator("#intro"), "src/app/page.tsx:11–36");
  await applyEdit({
    file: join(lumenDir, "app/page.tsx"),
    kind: "className",
    value: "flex flex-col gap-6",
    label: "lumen-layout-classes",
  });
  await select(lumen.locator("#sync-status"), "src/app/page.tsx:");
  await applyEdit({
    file: join(lumenDir, "app/page.tsx"),
    kind: "text",
    value: "Up to date",
    label: "lumen-ternary-branch-text",
  });
  const lumenPage = await readFile(join(lumenDir, "app/page.tsx"), "utf8");
  assert.ok(
    lumenPage.includes("{isSynced ? (") && lumenPage.includes("Offline"),
  );
  record("ternary condition and other branch are preserved");
  await expectRefusal(
    lumen.locator("nav a").first(),
    "renders 2 times",
    "reused component (NavLink) is refused",
  );
  await expectRefusal(
    lumen.locator("article h2").first(),
    "renders 3 times",
    ".map() list item is refused",
  );
  await select(lumen.locator("#note-count"), "src/app/page.tsx:");
  await page.getByText("renders expressions or nested elements").waitFor();
  assert.ok(await textInput.isDisabled());
  record(
    "expression text is refused",
    "{notes.length} notes in this workspace",
  );
  await page.screenshot({ path: join(outDir, "04-lumen-edited.png") });

  // --- Harbor Studio: Tailwind variants ----------------------------------
  const harbor = await switchFixture("harbor-studio", 3103, "#harbor-heading");
  const harborPage = join(workspaceRoot, "harbor-studio/src/app/page.tsx");
  await select(harbor.locator("#harbor-heading"), "src/app/page.tsx:14–19");
  await applyEdit({
    file: harborPage,
    kind: "text",
    value: "Harbor & Co",
    label: "harbor-heading-text",
  });
  await select(harbor.locator("#harbor-cta"), "src/app/page.tsx:");
  await applyEdit({
    file: harborPage,
    kind: "className",
    value: (await classInput.inputValue())
      .replace("bg-sky-600", "bg-indigo-600")
      .replace("hover:bg-sky-500", "hover:bg-indigo-500"),
    label: "harbor-variant-classes",
  });
  await select(harbor.locator("#hero"), "src/app/page.tsx:9–50");
  const columns = () =>
    harbor
      .locator("#hero")
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      );
  assert.equal(await columns(), 2);
  await applyEdit({
    file: harborPage,
    kind: "className",
    value: (await classInput.inputValue()).replace(
      "md:grid-cols-2",
      "md:grid-cols-3",
    ),
    label: "harbor-layout-responsive-classes",
  });
  assert.equal(await columns(), 3, "md:grid-cols-3 applied in the preview");
  record("responsive variant edit changes the rendered grid", "2 → 3 columns");
  await select(harbor.locator("#harbor-secondary"), "src/app/page.tsx:31–37");
  await page.getByText("className is an expression").waitFor();
  assert.ok(await classInput.isDisabled());
  assert.ok(!(await textInput.isDisabled()));
  record(
    "template-literal className is refused, its static text stays editable",
  );
  await select(
    harbor.locator("#footer-copy"),
    "src/components/site-footer.tsx:",
  );
  await page.getByText("renders expressions or nested elements").waitFor();
  record("footer text with {year} is refused");
  await page.screenshot({ path: join(outDir, "05-harbor-edited.png") });

  assert.deepEqual(await snapshotExamples(), examplesBefore);
  record("no file under examples/ changed");
} finally {
  await context.tracing.stop({ path: join(outDir, "trace.zip") });
  // Closing the context is what finalizes the .webm recording.
  await context.close();
  await browser.close();
}
console.log(
  `\n${results.length} checks passed. Trace: ${join(outDir, "trace.zip")}`,
);
console.log(`final workspace sha256 ${sha(await readFile(pageFile, "utf8"))}`);
