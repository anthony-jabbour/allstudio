import {
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DevWorkspace,
  isAllowedRelativePath,
  sha256,
} from "../dev/dev-workspace.ts";
import { prepareWorkspace } from "../dev/prepare-workspace.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureDir = join(repoRoot, "examples/nextjs-site-fixture");
const fixturePage = join(fixtureDir, "src/app/page.tsx");

let tmp: string;
let workspaceDir: string;
let pageFile: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "allstudio-ws-"));
  workspaceDir = join(tmp, "workspace");
  pageFile = join(workspaceDir, "src/app/page.tsx");
  await prepareWorkspace({
    fixtureDir,
    workspaceDir,
    bridgeSourceFile: join(
      repoRoot,
      "packages/editor/src/preview-bridge/client.ts",
    ),
    editorOrigin: "http://localhost:5173",
  });
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

async function heading(workspace: DevWorkspace) {
  const content = await readFile(pageFile, "utf8");
  const oid =
    content.match(/id="hero-heading"[\s\S]*?data-oid="([^"]+)"/)?.[1] ?? "";
  const located = await workspace.locate(oid);
  if (!located.ok) {
    throw new Error(located.reason);
  }
  return { oid, element: located.element };
}

describe("prepareWorkspace", () => {
  it("copies and instruments the fixture without touching examples/", async () => {
    const fixtureBefore = await readFile(fixturePage, "utf8");
    const copy = await readFile(pageFile, "utf8");
    expect(copy).toContain('data-oid="');
    expect(copy).toContain('id="hero-heading"');
    expect(await readFile(fixturePage, "utf8")).toBe(fixtureBefore);
    expect(fixtureBefore).not.toContain("data-oid");
    const client = await readFile(
      join(workspaceDir, "src/instrumentation-client.ts"),
      "utf8",
    );
    expect(client).toContain(
      'installPreviewBridge({ editorOrigin: "http://localhost:5173" })',
    );
  });

  it("keeps an existing workspace and its edits unless reset", async () => {
    await writeFile(pageFile, "// edited\n", "utf8");
    const again = await prepareWorkspace({
      fixtureDir,
      workspaceDir,
      bridgeSourceFile: join(
        repoRoot,
        "packages/editor/src/preview-bridge/client.ts",
      ),
      editorOrigin: "http://localhost:5173",
    });
    expect(again.created).toBe(false);
    expect(await readFile(pageFile, "utf8")).toBe("// edited\n");
  });
});

describe("DevWorkspace text edits", () => {
  it("locates the heading with file, lines, component, hash and text", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    const { oid, element } = await heading(workspace);
    expect(element).toMatchObject({
      path: "src/app/page.tsx",
      sha256: sha256(await readFile(pageFile, "utf8")),
      location: { oid, component: "Home", start: { line: 7 } },
      text: { ok: true, text: "Aurora Atelier" },
    });
  });

  it("previews without writing, then applies a heading text edit", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    const { oid, element } = await heading(workspace);
    const before = await readFile(pageFile, "utf8");
    const request = {
      path: element.path,
      oid,
      expectedSha256: element.sha256,
      text: "Aurora Atelier — edited",
    };

    const preview = await workspace.previewTextEdit(request);
    expect(preview).toMatchObject({ ok: true, written: false, noop: false });
    expect(preview.ok && preview.diff).toContain("+");
    expect(await readFile(pageFile, "utf8")).toBe(before);

    const applied = await workspace.applyTextEdit(request);
    expect(applied).toMatchObject({ ok: true, written: true, noop: false });
    const after = await readFile(pageFile, "utf8");
    expect(applied.ok && applied.sha256).toBe(sha256(after));
    // Format-preserving splice: exactly the text bytes change; the
    // indentation and every other line are kept.
    expect(after).toBe(
      before.replace(
        "\n        Aurora Atelier\n",
        "\n        Aurora Atelier — edited\n",
      ),
    );
    // Lines before the heading and from </h1> on are untouched.
    expect(after.slice(0, after.indexOf('id="hero-heading"'))).toBe(
      before.slice(0, before.indexOf('id="hero-heading"')),
    );
    expect(after.slice(after.indexOf("</h1>"))).toBe(
      before.slice(before.indexOf("</h1>")),
    );
    const relocated = await workspace.locate(oid);
    expect(relocated.ok && relocated.element.text).toEqual({
      ok: true,
      text: "Aurora Atelier — edited",
    });
  });

  it("treats unchanged text as a no-op without rewriting the file", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    const { oid, element } = await heading(workspace);
    const mtime = (await stat(pageFile)).mtimeMs;
    const result = await workspace.applyTextEdit({
      path: element.path,
      oid,
      expectedSha256: element.sha256,
      text: "Aurora Atelier",
    });
    expect(result).toEqual({
      ok: true,
      written: false,
      noop: true,
      sha256: element.sha256,
      diff: "",
    });
    expect((await stat(pageFile)).mtimeMs).toBe(mtime);
  });

  it("reports a conflict when the file changed since selection", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    const { oid, element } = await heading(workspace);
    const external = `${await readFile(pageFile, "utf8")}// external edit\n`;
    await writeFile(pageFile, external, "utf8");
    const result = await workspace.applyTextEdit({
      path: element.path,
      oid,
      expectedSha256: element.sha256,
      text: "Lost update",
    });
    expect(result).toMatchObject({ ok: false, reason: "stale-file" });
    expect(await readFile(pageFile, "utf8")).toBe(external);
  });

  it("refuses dynamic children such as layout {children}", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    const layout = await readFile(
      join(workspaceDir, "src/app/layout.tsx"),
      "utf8",
    );
    const bodyOid = layout.match(/<body[^>]*data-oid="([^"]+)"/)?.[1] ?? "";
    const located = await workspace.locate(bodyOid);
    expect(located.ok && located.element.text).toEqual({
      ok: false,
      reason: "unsupported-dynamic-children",
    });
    if (!located.ok) {
      return;
    }
    const result = await workspace.applyTextEdit({
      path: "src/app/layout.tsx",
      oid: bodyOid,
      expectedSha256: located.element.sha256,
      text: "flattened",
    });
    expect(result).toMatchObject({
      ok: false,
      reason: "unsupported-dynamic-children",
    });
    expect(
      await readFile(join(workspaceDir, "src/app/layout.tsx"), "utf8"),
    ).toBe(layout);
  });

  it("refuses unknown oids and oids duplicated across files", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    expect(await workspace.locate("zzzzzzz")).toMatchObject({
      ok: false,
      reason: "oid-not-found",
    });
    const { oid } = await heading(workspace);
    await writeFile(
      join(workspaceDir, "src/app/copy.tsx"),
      `export function Copy() {\n  return <h1 data-oid="${oid}">Copy</h1>;\n}\n`,
      "utf8",
    );
    expect(await workspace.locate(oid)).toMatchObject({
      ok: false,
      reason: "oid-ambiguous",
    });
  });

  it("saves text that only looks like a data-oid attribute", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    const { oid, element } = await heading(workspace);
    const text = 'Show data-oid="example"';
    const result = await workspace.applyTextEdit({
      path: element.path,
      oid,
      expectedSha256: element.sha256,
      text,
    });
    expect(result).toMatchObject({ ok: true, written: true });
    const relocated = await workspace.locate(oid);
    expect(relocated.ok && relocated.element.text).toEqual({ ok: true, text });
  });

  it("serializes concurrent applies so one reports a conflict", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    const { oid, element } = await heading(workspace);
    const content = await readFile(pageFile, "utf8");
    const paragraphOid =
      content.match(
        /<p className="max-w-xl text-lg[^>]*data-oid="([^"]+)"/,
      )?.[1] ?? "";
    const results = await Promise.all([
      workspace.applyTextEdit({
        path: element.path,
        oid,
        expectedSha256: element.sha256,
        text: "First edit",
      }),
      workspace.applyTextEdit({
        path: element.path,
        oid: paragraphOid,
        expectedSha256: element.sha256,
        text: "Second edit",
      }),
    ]);
    expect(results[0]).toMatchObject({ ok: true, written: true });
    expect(results[1]).toMatchObject({ ok: false, reason: "stale-file" });
    const after = await readFile(pageFile, "utf8");
    expect(after).toContain("First edit");
    expect(after).not.toContain("Second edit");
    expect(results[0].ok && results[0].sha256).toBe(sha256(after));
  });

  it("applies concurrent edits in call order even when the first resolves slowly", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    const { oid, element } = await heading(workspace);
    const content = await readFile(pageFile, "utf8");
    const paragraphOid =
      content.match(
        /<p className="max-w-xl text-lg[^>]*data-oid="([^"]+)"/,
      )?.[1] ?? "";
    // Slow down the first path resolution: the first apply must still hold
    // its place in the per-file queue.
    const resolve = workspace.resolve.bind(workspace);
    let calls = 0;
    workspace.resolve = async (path: unknown) => {
      if (calls++ === 0) {
        await new Promise((done) => setTimeout(done, 50));
      }
      return resolve(path);
    };
    const results = await Promise.all([
      workspace.applyTextEdit({
        path: element.path,
        oid,
        expectedSha256: element.sha256,
        text: "First edit",
      }),
      workspace.applyTextEdit({
        path: element.path,
        oid: paragraphOid,
        expectedSha256: element.sha256,
        text: "Second edit",
      }),
    ]);
    expect(results[0]).toMatchObject({ ok: true, written: true });
    expect(results[1]).toMatchObject({ ok: false, reason: "stale-file" });
  });

  it("refuses to rewrite a file that is not valid UTF-8", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    const { oid } = await heading(workspace);
    const valid = await readFile(pageFile);
    const invalid = Buffer.concat([
      valid,
      Buffer.from([0x2f, 0x2f, 0xff, 0x0a]),
    ]);
    await writeFile(pageFile, invalid);
    const result = await workspace.applyTextEdit({
      path: "src/app/page.tsx",
      oid,
      expectedSha256: sha256(invalid.toString("utf8")),
      text: "Changed",
    });
    expect(result).toMatchObject({ ok: false, reason: "unsupported-encoding" });
    expect((await readFile(pageFile)).equals(invalid)).toBe(true);
  });

  it("does not persist a patch that fails validation", async () => {
    const before = await readFile(pageFile, "utf8");
    const broken = await DevWorkspace.open(workspaceDir, {
      editElement: (content) => ({
        ok: true,
        original: content,
        generated: content.replace("</h1>", "</h2>"),
        strategy: "splice",
      }),
    });
    const { oid, element } = await heading(broken);
    const result = await broken.applyTextEdit({
      path: element.path,
      oid,
      expectedSha256: element.sha256,
      text: "anything",
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid-patch" });
    expect(await readFile(pageFile, "utf8")).toBe(before);
  });

  it("does not persist a patch that drops another element's oid", async () => {
    const before = await readFile(pageFile, "utf8");
    const lossy = await DevWorkspace.open(workspaceDir, {
      editElement: (content, edit) => ({
        ok: true,
        strategy: "splice",
        original: content,
        generated: content
          .replace(/(<p className="text-sm[^>]*) data-oid="[^"]+"/, "$1")
          .replace(
            /(id="hero-heading"[\s\S]*?>)[\s\S]*?(<\/h1>)/,
            `$1${edit.kind === "text" ? edit.text : ""}$2`,
          ),
      }),
    });
    const { oid, element } = await heading(lossy);
    const result = await lossy.applyTextEdit({
      path: element.path,
      oid,
      expectedSha256: element.sha256,
      text: "Lossy",
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid-patch" });
    expect(await readFile(pageFile, "utf8")).toBe(before);
  });
});

describe("DevWorkspace path confinement", () => {
  it.each([
    "../package.json",
    "src/../package.json",
    "src/app/../../../etc/passwd.tsx",
    "/etc/passwd",
    "C:/Windows/x.tsx",
    "src\\app\\page.tsx",
    "src//app/page.tsx",
    "src/./app/page.tsx",
    "next.config.ts",
    "src/app/globals.css",
    "src/allstudio-preview-bridge.ts",
    "public/next.svg",
    "src/app/page.tsx\0.tsx",
    "",
  ])("rejects %j", async (path) => {
    expect(isAllowedRelativePath(path)).toBe(false);
    const workspace = await DevWorkspace.open(workspaceDir);
    expect(await workspace.resolve(path)).toEqual({
      ok: false,
      reason: "path-rejected",
    });
  });

  it("rejects a symlinked file that points outside the root", async () => {
    const outside = join(tmp, "outside.tsx");
    await writeFile(
      outside,
      'export const x = <p data-oid="out1">secret</p>;\n',
      "utf8",
    );
    await symlink(outside, join(workspaceDir, "src/app/evil.tsx"));
    const workspace = await DevWorkspace.open(workspaceDir);
    expect(await workspace.resolve("src/app/evil.tsx")).toEqual({
      ok: false,
      reason: "path-rejected",
    });
    expect(await workspace.listSourceFiles()).not.toContain("src/app/evil.tsx");
    expect(await workspace.locate("out1")).toMatchObject({
      reason: "oid-not-found",
    });
    const result = await workspace.applyTextEdit({
      path: "src/app/evil.tsx",
      oid: "out1",
      expectedSha256: sha256(await readFile(outside, "utf8")),
      text: "pwned",
    });
    expect(result).toMatchObject({ ok: false, reason: "path-rejected" });
    expect(await readFile(outside, "utf8")).toContain("secret");
  });

  it("rejects a symlinked directory inside src", async () => {
    await symlink(
      join(fixtureDir, "src/app"),
      join(workspaceDir, "src/linked"),
      "dir",
    );
    const workspace = await DevWorkspace.open(workspaceDir);
    expect(await workspace.resolve("src/linked/page.tsx")).toEqual({
      ok: false,
      reason: "path-rejected",
    });
    expect(await workspace.listSourceFiles()).toEqual([
      "src/app/layout.tsx",
      "src/app/page.tsx",
    ]);
  });

  it("reports a missing file as not found", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    expect(await workspace.resolve("src/app/missing.tsx")).toEqual({
      ok: false,
      reason: "file-not-found",
    });
  });
});
