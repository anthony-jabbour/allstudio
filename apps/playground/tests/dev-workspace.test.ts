import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
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

  it("refreshes a stale generated bridge without resetting edited source", async () => {
    await writeFile(pageFile, "// edited\n", "utf8");
    const bridgePath = join(workspaceDir, "src/allstudio-preview-bridge.ts");
    const instrumentationPath = join(
      workspaceDir,
      "src/instrumentation-client.ts",
    );
    await writeFile(bridgePath, "const VERSION = 1;\nexport {}\n", "utf8");
    await writeFile(instrumentationPath, "stale-instrumentation\n", "utf8");
    const source = join(
      repoRoot,
      "packages/editor/src/preview-bridge/client.ts",
    );
    const again = await prepareWorkspace({
      fixtureDir,
      workspaceDir,
      bridgeSourceFile: source,
      editorOrigin: "http://localhost:5174",
    });
    expect(again.created).toBe(false);
    expect(await readFile(pageFile, "utf8")).toBe("// edited\n");
    expect(await readFile(bridgePath, "utf8")).toBe(
      await readFile(source, "utf8"),
    );
    expect(await readFile(instrumentationPath, "utf8")).toContain(
      'installPreviewBridge({ editorOrigin: "http://localhost:5174" })',
    );
  });

  it("copies and instruments missing fixture JSX files in a reused workspace without overwriting edited files", async () => {
    await writeFile(pageFile, "// edited\n", "utf8");
    const aboutFile = join(workspaceDir, "src/app/about/page.tsx");
    await rm(join(workspaceDir, "src/app/about"), {
      recursive: true,
      force: true,
    });
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
    const restoredAbout = await readFile(aboutFile, "utf8");
    expect(restoredAbout).toContain('id="about-heading"');
    expect(restoredAbout).toContain('data-oid="');
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

describe("DevWorkspace atomic write", () => {
  it("keeps the file's permission bits under a restrictive umask", async () => {
    // With umask 077 a newly created temp file would be 0600; only the chmod
    // restores the group/other read bits. Tests in a file run sequentially in
    // their own process, so the mask does not leak into other tests.
    await chmod(pageFile, 0o644);
    const previous = process.umask(0o077);
    try {
      const workspace = await DevWorkspace.open(workspaceDir);
      const { oid, element } = await heading(workspace);
      const result = await workspace.applyTextEdit({
        path: element.path,
        oid,
        expectedSha256: element.sha256,
        text: "Mode kept",
      });
      expect(result).toMatchObject({ ok: true, written: true });
    } finally {
      process.umask(previous);
    }
    expect((await stat(pageFile)).mode & 0o777).toBe(0o644);
  });

  it("refuses to edit a hard-linked file", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    const { oid, element } = await heading(workspace);
    const second = join(tmp, "second-link.tsx");
    await link(pageFile, second);
    const before = await readFile(pageFile, "utf8");
    const result = await workspace.applyTextEdit({
      path: element.path,
      oid,
      expectedSha256: element.sha256,
      text: "Breaks the link",
    });
    expect(result).toMatchObject({ ok: false, reason: "path-rejected" });
    expect(await readFile(pageFile, "utf8")).toBe(before);
    expect(await readFile(second, "utf8")).toBe(before);
  });

  it("rejects the write when a directory becomes a symlink before the rename", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    const { oid, element } = await heading(workspace);
    const before = await readFile(pageFile, "utf8");
    // The second resolve is the re-check right before the rename; swap the
    // directory for a symlink just before it runs.
    const resolve = workspace.resolve.bind(workspace);
    let calls = 0;
    workspace.resolve = async (path: unknown) => {
      if (++calls === 2) {
        const app = join(workspaceDir, "src/app");
        await rename(app, join(workspaceDir, "src/app-real"));
        await symlink(join(workspaceDir, "src/app-real"), app, "dir");
      }
      return resolve(path);
    };
    const result = await workspace.applyTextEdit({
      path: element.path,
      oid,
      expectedSha256: element.sha256,
      text: "Redirected",
    });
    expect(result).toMatchObject({ ok: false, reason: "path-rejected" });
    const real = join(workspaceDir, "src/app-real");
    expect(await readFile(join(real, "page.tsx"), "utf8")).toBe(before);
    const leftovers = (await readdir(real)).filter((n) => n.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
  });
  it("rejects the write when a directory is swapped for a symlink elsewhere", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    const { oid, element } = await heading(workspace);
    const before = await readFile(pageFile, "utf8");
    const app = join(workspaceDir, "src/app");
    const moved = join(tmp, "moved-app");
    const decoy = join(tmp, "decoy-app");
    const resolve = workspace.resolve.bind(workspace);
    let calls = 0;
    workspace.resolve = async (path: unknown) => {
      if (++calls === 2) {
        await rename(app, moved);
        await mkdir(decoy);
        await writeFile(join(decoy, "page.tsx"), "decoy\n", "utf8");
        await symlink(decoy, app, "dir");
      }
      return resolve(path);
    };
    const result = await workspace.applyTextEdit({
      path: element.path,
      oid,
      expectedSha256: element.sha256,
      text: "Redirected",
    });
    expect(result).toMatchObject({ ok: false, reason: "path-rejected" });
    // Neither the original file nor the symlink target is written.
    expect(await readFile(join(moved, "page.tsx"), "utf8")).toBe(before);
    expect(await readFile(join(decoy, "page.tsx"), "utf8")).toBe("decoy\n");
    expect(await readdir(decoy)).toEqual(["page.tsx"]);
    // Documented limit: the temp file moved with the directory and cannot be
    // found again by path, so at most one dot-prefixed temp file remains.
    const leftovers = (await readdir(moved)).filter((n) => n.endsWith(".tmp"));
    expect(leftovers.length).toBeLessThanOrEqual(1);
    expect(leftovers.every((n) => n.startsWith(".allstudio-"))).toBe(true);
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
      "src/app/about/page.tsx",
      "src/app/journal/[slug]/page.tsx",
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

describe("DevWorkspace route discovery and selection", () => {
  it("discovers static and unsupported routes and resolves preview URLs", async () => {
    const workspace = await DevWorkspace.open(workspaceDir, {
      previewUrl: "http://localhost:3101",
    });
    const snapshot = await workspace.discoverRoutes();
    expect(snapshot.routes).toEqual([
      { route: "/", sourcePath: "src/app/page.tsx" },
      { route: "/about", sourcePath: "src/app/about/page.tsx" },
    ]);
    expect(snapshot.unsupported).toEqual([
      expect.objectContaining({
        route: "/journal/[slug]",
        sourcePath: "src/app/journal/[slug]/page.tsx",
        reason: "dynamic-route",
      }),
    ]);

    expect(await workspace.selectRoute("/")).toMatchObject({
      ok: true,
      route: "/",
      sourcePath: "src/app/page.tsx",
      previewUrl: "http://localhost:3101/",
      routes: snapshot.routes,
      unsupportedRoutes: snapshot.unsupported,
    });

    expect(await workspace.selectRoute("/about")).toMatchObject({
      ok: true,
      route: "/about",
      sourcePath: "src/app/about/page.tsx",
      previewUrl: "http://localhost:3101/about",
      routes: snapshot.routes,
      unsupportedRoutes: snapshot.unsupported,
    });

    expect(await workspace.selectRoute("/journal/[slug]")).toMatchObject({
      ok: false,
      reason: "route-unsupported",
    });

    await rm(join(workspaceDir, "src/app/about/page.tsx"));
    expect(await workspace.selectRoute("/about")).toMatchObject({
      ok: false,
      reason: "route-not-found",
    });

    for (const hostile of [
      "http://evil.com",
      "//evil.com",
      "/about/../secret",
      "/about?x=1",
    ]) {
      expect(await workspace.selectRoute(hostile)).toMatchObject({
        ok: false,
        reason: "invalid-request",
      });
    }
  });
});

describe("responsive breakpoint audit", () => {
  it("refuses unbound external stylesheet imports and project-root CSS/build configuration", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    for (const path of ["theme.css", ".postcssrc.json"]) {
      await writeFile(
        join(workspaceDir, path),
        path.endsWith("css") ? "@theme{--breakpoint-md:900px}" : "{}",
      );
      expect((await workspace.getResponsiveCapabilities()).status).toBe(
        "unsupported",
      );
      await rm(join(workspaceDir, path));
    }
    const layout = join(workspaceDir, "src/app/layout.tsx");
    const before = await readFile(layout, "utf8");
    await writeFile(
      layout,
      before.replace("./globals.css", "../../outside.css"),
    );
    expect((await workspace.getResponsiveCapabilities()).status).toBe(
      "unsupported",
    );
    await writeFile(layout, before);
    await writeFile(
      join(workspaceDir, "next.config.ts"),
      "export default getCustomConfig();",
    );
    expect((await workspace.getResponsiveCapabilities()).status).toBe(
      "unsupported",
    );
  });
  it("returns eligibility only and refuses scoped edits after external theme changes", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    expect(await workspace.getResponsiveCapabilities()).toEqual({
      status: "supported-defaults",
    });
    const { oid, element } = await heading(workspace);
    const request = {
      path: element.path,
      oid,
      expectedSha256: element.sha256,
      className: "text-lg md:text-xl",
      breakpoint: "md" as const,
    };
    const before = await readFile(pageFile, "utf8");
    expect((await workspace.previewClassEdit(request)).ok).toBe(true);
    await writeFile(
      join(workspaceDir, "src/app/globals.css"),
      '@import "tailwindcss"; @theme{--breakpoint-md:900px}/*private-marker*/',
    );
    const caps = await workspace.getResponsiveCapabilities();
    expect(caps.status).toBe("unsupported");
    expect(JSON.stringify(caps)).not.toContain("private-marker");
    expect(await workspace.applyClassEdit(request)).toMatchObject({
      ok: false,
      reason: "unsupported-breakpoints",
    });
    expect(await readFile(pageFile, "utf8")).toBe(before);
    expect(
      (await workspace.applyClassEdit({ ...request, breakpoint: "base" })).ok,
    ).toBe(true);
  });
  it("fails closed for CSS symlink/hardlink and invalid byte sources", async () => {
    const workspace = await DevWorkspace.open(workspaceDir);
    const outside = join(tmp, "outside.css");
    await writeFile(outside, "@theme{--breakpoint-md:900px}");
    const css = join(workspaceDir, "src/unsafe.css");
    await symlink(outside, css);
    expect((await workspace.getResponsiveCapabilities()).status).toBe(
      "unavailable",
    );
    await rm(css);
    await link(outside, css);
    expect((await workspace.getResponsiveCapabilities()).status).toBe(
      "unavailable",
    );
    await rm(css);
    await writeFile(css, Buffer.from([255]));
    expect((await workspace.getResponsiveCapabilities()).status).toBe(
      "unavailable",
    );
    expect(await readFile(outside, "utf8")).toBe(
      "@theme{--breakpoint-md:900px}",
    );
  });
});
