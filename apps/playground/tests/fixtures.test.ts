import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DevWorkspace } from "../dev/dev-workspace.ts";
import { prepareWorkspace } from "../dev/prepare-workspace.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURES = {
  aurora: "nextjs-site-fixture",
  lumen: "nested-components-fixture",
  harbor: "tailwind-variants-fixture",
} as const;
type FixtureKey = keyof typeof FIXTURES;

let tmp: string;
const workspaces = new Map<FixtureKey, { dir: string; ws: DevWorkspace }>();

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "allstudio-fixtures-"));
  for (const [key, fixture] of Object.entries(FIXTURES) as Array<
    [FixtureKey, string]
  >) {
    const dir = join(tmp, key);
    await prepareWorkspace({
      fixtureDir: join(repoRoot, "examples", fixture),
      workspaceDir: dir,
      bridgeSourceFile: join(
        repoRoot,
        "packages/editor/src/preview-bridge/client.ts",
      ),
      editorOrigin: "http://localhost:5173",
    });
    workspaces.set(key, { dir, ws: await DevWorkspace.open(dir) });
  }
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

function get(key: FixtureKey) {
  const entry = workspaces.get(key);
  if (!entry) {
    throw new Error(`workspace ${key} missing`);
  }
  return entry;
}

/** Oid of the element whose opening tag contains `marker` in `file`. */
async function oidIn(key: FixtureKey, file: string, marker: string) {
  const content = await readFile(join(get(key).dir, file), "utf8");
  const index = content.indexOf(marker);
  expect(index, `${marker} in ${file}`).toBeGreaterThan(-1);
  return content.slice(index).match(/data-oid="([^"]+)"/)?.[1] ?? "";
}

async function locate(key: FixtureKey, file: string, marker: string) {
  const oid = await oidIn(key, file, marker);
  const located = await get(key).ws.locate(oid);
  if (!located.ok) {
    throw new Error(`${marker}: ${located.reason}`);
  }
  return { oid, element: located.element };
}

/** Lines before `start` and from `end` on must be byte-identical. */
function expectConfined(
  before: string,
  after: string,
  start: number,
  end: number,
) {
  const a = before.split("\n");
  const b = after.split("\n");
  expect(b.slice(0, start - 1)).toEqual(a.slice(0, start - 1));
  const tail = a.length - end;
  expect(b.slice(b.length - tail)).toEqual(a.slice(a.length - tail));
}

describe("prepared fixture workspaces", () => {
  it.each(
    Object.entries(FIXTURES),
  )("%s copy differs from examples/ only by data-oid attributes", async (key, fixture) => {
    const { dir } = get(key as FixtureKey);
    const files = await get(key as FixtureKey).ws.listSourceFiles();
    expect(files.length).toBeGreaterThan(1);
    for (const file of files) {
      const original = await readFile(
        join(repoRoot, "examples", fixture, file),
        "utf8",
      );
      const copy = await readFile(join(dir, file), "utf8");
      expect(copy.replace(/ data-oid="[^"]+"/g, ""), file).toBe(original);
      expect(original).not.toContain("data-oid");
    }
  });
});

// Heading, button, and layout element in each fixture, with the source file
// and line range the panel must show (lines match the examples/ source).
const SELECTIONS: Array<{
  fixture: FixtureKey;
  role: "heading" | "button" | "layout";
  file: string;
  marker: string;
  lines: [number, number];
  component: string;
}> = [
  {
    fixture: "aurora",
    role: "heading",
    file: "src/app/page.tsx",
    marker: 'id="hero-heading"',
    lines: [7, 12],
    component: "Home",
  },
  {
    fixture: "aurora",
    role: "button",
    file: "src/app/page.tsx",
    marker: 'type="button"',
    lines: [18, 23],
    component: "Home",
  },
  {
    fixture: "aurora",
    role: "layout",
    file: "src/app/page.tsx",
    marker: "<main",
    lines: [3, 24],
    component: "Home",
  },
  {
    fixture: "lumen",
    role: "heading",
    file: "src/app/page.tsx",
    marker: 'id="lumen-heading"',
    lines: [12, 17],
    component: "Home",
  },
  {
    fixture: "lumen",
    role: "button",
    file: "src/components/new-note-button.tsx",
    marker: 'id="new-note-button"',
    lines: [3, 9],
    component: "NewNoteButton",
  },
  {
    fixture: "lumen",
    role: "layout",
    file: "src/app/page.tsx",
    marker: 'id="intro"',
    lines: [11, 36],
    component: "Home",
  },
  {
    fixture: "harbor",
    role: "heading",
    file: "src/app/page.tsx",
    marker: 'id="harbor-heading"',
    lines: [14, 19],
    component: "Home",
  },
  {
    fixture: "harbor",
    role: "button",
    file: "src/app/page.tsx",
    marker: 'id="harbor-secondary"',
    lines: [31, 37],
    component: "Home",
  },
  {
    fixture: "harbor",
    role: "layout",
    file: "src/app/page.tsx",
    marker: 'id="hero"',
    lines: [9, 50],
    component: "Home",
  },
];

describe("selection resolves to the real source file and lines", () => {
  it.each(SELECTIONS)("$fixture $role → $file:$lines", async ({
    fixture,
    file,
    marker,
    lines,
    component,
  }) => {
    const { element } = await locate(fixture, file, marker);
    expect(element.path).toBe(file);
    expect([element.location.start.line, element.location.end.line]).toEqual(
      lines,
    );
    expect(element.location.component).toBe(component);
  });
});

describe("text and class edits change only the selected element", () => {
  it.each([
    ["aurora", "src/app/page.tsx", 'type="button"', "Start a new project"],
    [
      "lumen",
      "src/components/new-note-button.tsx",
      'id="new-note-button"',
      "Write a note",
    ],
    ["lumen", "src/app/page.tsx", 'id="lumen-heading"', "Lumen Notebook"],
    [
      "harbor",
      "src/app/page.tsx",
      'id="harbor-secondary"',
      "View case studies",
    ],
  ] as const)("%s text edit in %s (%s)", async (fixture, file, marker, text) => {
    const { oid, element } = await locate(fixture, file, marker);
    const path = join(get(fixture).dir, file);
    const before = await readFile(path, "utf8");
    const result = await get(fixture).ws.applyTextEdit({
      path: file,
      oid,
      expectedSha256: element.sha256,
      text,
    });
    expect(result).toMatchObject({ ok: true, written: true });
    const after = await readFile(path, "utf8");
    expectConfined(
      before,
      after,
      element.location.start.line,
      element.location.end.line,
    );
    // Exactly one line changed: the element's text line, indentation kept.
    const changed = after
      .split("\n")
      .filter((line, i) => line !== before.split("\n")[i]);
    expect(changed).toHaveLength(1);
    expect(changed[0]?.trim()).toBe(text);
    const relocated = await get(fixture).ws.locate(oid);
    expect(relocated.ok && relocated.element.text).toEqual({ ok: true, text });
  });

  it.each([
    [
      "aurora",
      "src/app/page.tsx",
      "<main",
      "mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center gap-8 px-6 py-24",
    ],
    ["lumen", "src/app/page.tsx", 'id="intro"', "flex flex-col gap-6 md:gap-8"],
    [
      "lumen",
      "src/components/site-header.tsx",
      'aria-label="Main"',
      "mx-auto flex max-w-5xl items-center justify-between px-6 py-4",
    ],
    [
      "harbor",
      "src/app/page.tsx",
      'id="hero"',
      "mx-auto grid max-w-6xl gap-8 px-6 py-20 md:grid-cols-3 md:items-center lg:py-28",
    ],
    [
      "harbor",
      "src/app/page.tsx",
      'id="harbor-cta"',
      "rounded-full bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-sky-700",
    ],
  ] as const)("%s class edit in %s (%s)", async (fixture, file, marker, className) => {
    const { oid, element } = await locate(fixture, file, marker);
    const path = join(get(fixture).dir, file);
    const before = await readFile(path, "utf8");
    const previous = element.className.ok ? element.className.value : null;
    expect(previous).toBeTruthy();
    const result = await get(fixture).ws.applyClassEdit({
      path: file,
      oid,
      expectedSha256: element.sha256,
      className,
    });
    expect(result).toMatchObject({ ok: true, written: true });
    const after = await readFile(path, "utf8");
    expect(after).toBe(before.replace(`"${previous}"`, `"${className}"`));
    const relocated = await get(fixture).ws.locate(oid);
    expect(relocated.ok && relocated.element.className).toEqual({
      ok: true,
      value: className,
    });
  });
});

describe("dynamic and conditional markup", () => {
  it("edits a ternary branch and keeps the condition (lumen sync status)", async () => {
    const file = "src/app/page.tsx";
    const { oid, element } = await locate("lumen", file, 'id="sync-status"');
    const path = join(get("lumen").dir, file);
    const before = await readFile(path, "utf8");
    const result = await get("lumen").ws.applyTextEdit({
      path: file,
      oid,
      expectedSha256: element.sha256,
      text: "Up to date",
    });
    expect(result).toMatchObject({ ok: true, written: true });
    const after = await readFile(path, "utf8");
    expect(after).toBe(
      before.replace(
        "\n              Synced\n",
        "\n              Up to date\n",
      ),
    );
    expect(after).toContain("{isSynced ? (");
    expect(after).toContain("Offline");
  });

  it("edits text inside a && conditional and keeps the condition (lumen banner)", async () => {
    const file = "src/components/sync-banner.tsx";
    const { oid, element } = await locate("lumen", file, 'id="sync-banner"');
    const path = join(get("lumen").dir, file);
    const before = await readFile(path, "utf8");
    const result = await get("lumen").ws.applyTextEdit({
      path: file,
      oid,
      expectedSha256: element.sha256,
      text: "Every note is saved on this device.",
    });
    expect(result).toMatchObject({ ok: true, written: true });
    const after = await readFile(path, "utf8");
    expect(after).toBe(
      before.replace(
        "All notes are backed up locally.",
        "Every note is saved on this device.",
      ),
    );
    expect(after).toContain("{visible && (");
  });

  it.each([
    [
      "lumen",
      "src/app/page.tsx",
      'id="note-count"',
      "text",
      "unsupported-dynamic-children",
    ],
    [
      "lumen",
      "src/components/nav-link.tsx",
      "<a href={href}",
      "text",
      "unsupported-dynamic-children",
    ],
    [
      "lumen",
      "src/components/note-card.tsx",
      '<h2 className="font-medium"',
      "text",
      "unsupported-dynamic-children",
    ],
    [
      "lumen",
      "src/app/page.tsx",
      "<main className=",
      "text",
      "unsupported-dynamic-children",
    ],
    [
      "harbor",
      "src/components/site-footer.tsx",
      'id="footer-copy"',
      "text",
      "unsupported-dynamic-children",
    ],
    [
      "harbor",
      "src/app/page.tsx",
      'id="harbor-secondary"',
      "className",
      "unsupported-className-expression",
    ],
    [
      "harbor",
      "src/components/service-badge.tsx",
      "<span",
      "className",
      "unsupported-className-expression",
    ],
    [
      "harbor",
      "src/components/service-badge.tsx",
      "<span",
      "text",
      "unsupported-dynamic-children",
    ],
  ] as const)("%s %s (%s) refuses a %s edit with %s and writes nothing", async (fixture, file, marker, kind, reason) => {
    const { oid, element } = await locate(fixture, file, marker);
    const path = join(get(fixture).dir, file);
    const before = await readFile(path, "utf8");
    const mtime = (await stat(path)).mtimeMs;
    const request = { path: file, oid, expectedSha256: element.sha256 };
    const result =
      kind === "text"
        ? await get(fixture).ws.applyTextEdit({ ...request, text: "x" })
        : await get(fixture).ws.applyClassEdit({
            ...request,
            className: "px-4",
          });
    expect(result).toMatchObject({ ok: false, reason });
    expect(await readFile(path, "utf8")).toBe(before);
    expect((await stat(path)).mtimeMs).toBe(mtime);
  });

  it("treats an unchanged class string as a no-op", async () => {
    const file = "src/app/page.tsx";
    const { oid, element } = await locate(
      "harbor",
      file,
      'id="harbor-heading"',
    );
    const path = join(get("harbor").dir, file);
    const mtime = (await stat(path)).mtimeMs;
    const current = element.className.ok ? (element.className.value ?? "") : "";
    const result = await get("harbor").ws.applyClassEdit({
      path: file,
      oid,
      expectedSha256: element.sha256,
      className: current,
    });
    expect(result).toMatchObject({ ok: true, written: false, noop: true });
    expect((await stat(path)).mtimeMs).toBe(mtime);
  });

  it("reports a stale class edit after an external change", async () => {
    const file = "src/app/page.tsx";
    const { oid, element } = await locate(
      "harbor",
      file,
      'id="harbor-heading"',
    );
    await get("harbor").ws.applyTextEdit({
      path: file,
      oid,
      expectedSha256: element.sha256,
      text: "Harbor & Co",
    });
    const result = await get("harbor").ws.applyClassEdit({
      path: file,
      oid,
      expectedSha256: element.sha256,
      className: "text-3xl",
    });
    expect(result).toMatchObject({ ok: false, reason: "stale-file" });
  });
});
