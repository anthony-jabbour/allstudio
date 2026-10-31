import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { durableJson } from "../src/main/durable-json.ts";
import { hash, LocalWorkspace } from "../src/main/local-workspace.ts";
import { preparePreviewSource } from "../src/main/preview-source.ts";

describe("real local workspace", () => {
  let directory: string;
  let workspace: LocalWorkspace;
  const source =
    'export default function Page() { return <main><h1 className="old">Hello</h1></main>; }';
  beforeAll(async () => {
    directory = await realpath(
      await mkdtemp(join(tmpdir(), "allstudio-local-")),
    );
    const binary = join(directory, "files");
    execFileSync("cc", [
      "-std=c11",
      "-Wall",
      "-Wextra",
      "-Werror",
      resolve("apps/desktop/native/files.c"),
      "-o",
      binary,
    ]);
    await mkdir(join(directory, "project/src"), { recursive: true });
    await writeFile(join(directory, "project/src/page.tsx"), source, {
      mode: 0o640,
    });
    workspace = await LocalWorkspace.open(
      join(directory, "project"),
      binary,
      join(directory, "recovery"),
    );
  });
  afterAll(async () => {
    await workspace?.close();
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  it("audits default breakpoints and rechecks them before scoped source edits", async () => {
    const root = join(directory, "responsive-project");
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ devDependencies: { tailwindcss: "^4" } }),
    );
    await writeFile(join(root, "src/globals.css"), '@import "tailwindcss";');
    await writeFile(join(root, "src/page.tsx"), source);
    const current = await LocalWorkspace.open(
      root,
      join(directory, "files"),
      join(directory, "responsive-recovery"),
    );
    try {
      expect(await current.getResponsiveCapabilities()).toEqual({
        status: "supported-defaults",
      });
      const oid = preparePreviewSource(join(root, "src/page.tsx"), source)
        .injectedOids[1]!;
      const located = await current.locate(oid);
      if (!located.ok) throw new Error(located.reason);
      const request = {
        path: "src/page.tsx",
        oid,
        expectedSha256: located.element.sha256,
        className: "old md:text-xl",
        breakpoint: "md" as const,
      };
      expect((await current.previewClassEdit(request)).ok).toBe(true);
      // Repeated audits must not consume the persistent grant's directory offset.
      expect((await current.getResponsiveCapabilities()).status).toBe(
        "supported-defaults",
      );
      for (const [path, content] of [
        ["theme.css", "@theme{--breakpoint-md:900px}"],
        [".postcssrc.json", '{"plugins":{"custom":{}}}'],
      ]) {
        await writeFile(join(root, path), content);
        expect((await current.getResponsiveCapabilities()).status).toBe(
          "unsupported",
        );
        expect(await current.applyClassEdit(request)).toMatchObject({
          ok: false,
          reason: "unsupported-breakpoints",
        });
        await rm(join(root, path));
      }
      await writeFile(
        join(root, "src/page.tsx"),
        'import "../../outside.css";\n' + source,
      );
      expect((await current.getResponsiveCapabilities()).status).toBe(
        "unsupported",
      );
      await writeFile(join(root, "src/page.tsx"), source);
      expect(await readFile(join(root, "src/page.tsx"), "utf8")).toBe(source);
      await writeFile(
        join(root, "src/globals.css"),
        '@import "tailwindcss"; @theme{--breakpoint-md:900px} /*private-marker*/',
      );
      const caps = await current.getResponsiveCapabilities();
      expect(caps.status).toBe("unsupported");
      expect(JSON.stringify(caps)).not.toContain("private-marker");
      expect(await current.applyClassEdit(request)).toMatchObject({
        ok: false,
        reason: "unsupported-breakpoints",
      });
      expect(await readFile(join(root, "src/page.tsx"), "utf8")).toBe(source);
      expect(
        (await current.applyClassEdit({ ...request, breakpoint: "base" })).ok,
      ).toBe(true);
    } finally {
      await current.close();
    }
  });
  it("locates preview IDs and edits original source without persisting attributes", async () => {
    const preview = preparePreviewSource(
      join(workspace.root, "src/page.tsx"),
      source,
    );
    const oid = preview.injectedOids[1];
    const located = await workspace.locate(oid);
    expect(located.ok).toBe(true);
    if (!located.ok) throw new Error(located.reason);
    const request = {
      path: located.element.path,
      oid,
      expectedSha256: located.element.sha256,
      text: "Changed",
    };
    expect((await workspace.previewTextEdit(request)).ok).toBe(true);
    expect(await readFile(join(workspace.root, request.path), "utf8")).toBe(
      source,
    );
    const result = await workspace.applyTextEdit(request);
    expect(result).toMatchObject({
      ok: true,
      written: true,
    });
    if (!result.ok || !result.oid)
      throw new Error("Replacement preview ID missing");
    expect(result.oid).not.toBe(oid);
    expect(await workspace.locate(result.oid)).toMatchObject({
      ok: true,
      element: { text: { text: "Changed" } },
    });
    expect(await readFile(join(workspace.root, request.path), "utf8")).toBe(
      source.replace("Hello", "Changed"),
    );
    expect((await stat(join(workspace.root, request.path))).mode & 0o7777).toBe(
      0o640,
    );
    expect(await workspace.applyTextEdit(request)).toMatchObject({
      ok: false,
      reason: "stale-file",
    });
    expect(await workspace.undo()).toMatchObject({ ok: true });
    expect(await readFile(join(workspace.root, request.path), "utf8")).toBe(
      source,
    );
    expect(await workspace.redo()).toMatchObject({ ok: true });
  });
  it("refuses a stale DOM ID before lookup even when inserted siblings shift its ordinal", async () => {
    const path = "src/stale-dom.tsx";
    const before = '<main><h1 data-oid="heading">Hello</h1></main>';
    const oldOid = preparePreviewSource(join(workspace.root, path), before)
      .injectedOids[1];
    const after = before.replace("<h1", "<p>Inserted</p><h1");
    await writeFile(join(workspace.root, path), after);
    expect(await workspace.locate(oldOid)).toMatchObject({
      ok: false,
      reason: "stale-file",
    });
    expect(
      await workspace.applyTextEdit({
        path,
        oid: oldOid,
        expectedSha256: hash(after),
        text: "Wrong node",
      }),
    ).toMatchObject({ ok: false });
    expect(await readFile(join(workspace.root, path), "utf8")).toBe(after);
    const fresh = preparePreviewSource(join(workspace.root, path), after)
      .injectedOids[2];
    expect(await workspace.locate(fresh)).toMatchObject({
      ok: true,
      element: { text: { text: "Hello" } },
    });
  });
  it("refuses traversal and malformed UTF-8 without changing bytes", async () => {
    const invalid = Buffer.from([0xff, 0xfe]);
    await writeFile(join(workspace.root, "src/bad.tsx"), invalid);
    expect(
      await workspace.applyTextEdit({
        path: "../outside.tsx",
        oid: "a",
        expectedSha256: "0".repeat(64),
        text: "bad",
      }),
    ).toMatchObject({ ok: false, reason: "path-rejected" });
    expect(
      await workspace.applyTextEdit({
        path: "src/bad.tsx",
        oid: "a",
        expectedSha256: "0".repeat(64),
        text: "bad",
      }),
    ).toMatchObject({ ok: false, reason: "unsupported-encoding" });
    expect(await readFile(join(workspace.root, "src/bad.tsx"))).toEqual(
      invalid,
    );
  });
  it("maps original columns across multiline user attributes and returns a fresh ID after class saves", async () => {
    const path = "src/multiline.tsx";
    const before =
      "<main><h1 data-oid =\n 'user-heading' className='old'>Hello</h1></main>";
    await writeFile(join(workspace.root, path), before);
    const oid = preparePreviewSource(join(workspace.root, path), before)
      .injectedOids[1];
    const located = await workspace.locate(oid);
    expect(located).toMatchObject({
      ok: true,
      element: {
        location: {
          start: { line: 1, column: 6 },
          end: { line: 2, column: before.split("\n")[1].indexOf("</h1>") + 5 },
        },
      },
    });
    const result = await workspace.applyClassEdit({
      path,
      oid,
      expectedSha256: hash(before),
      className: "new",
    });
    expect(result).toMatchObject({ ok: true, written: true });
    if (!result.ok || !result.oid) throw new Error("Replacement ID missing");
    expect(await workspace.locate(oid)).toMatchObject({
      ok: false,
      reason: "stale-file",
    });
    expect(await workspace.locate(result.oid)).toMatchObject({
      ok: true,
      element: { className: { value: "new" } },
    });
    expect(await readFile(join(workspace.root, path), "utf8")).toBe(
      before.replace("className='old'", "className='new'"),
    );
  });
  it("keeps BOM bytes and no-op inode/mtime unchanged", async () => {
    const content = `\uFEFF${source}`;
    const path = "src/bom.tsx";
    await writeFile(join(workspace.root, path), content);
    const before = await stat(join(workspace.root, path));
    const oid = preparePreviewSource(join(workspace.root, path), content)
      .injectedOids[1];
    expect(
      await workspace.applyTextEdit({
        path,
        oid,
        expectedSha256: hash(content),
        text: "Hello",
      }),
    ).toMatchObject({ ok: true, noop: true, written: false });
    const after = await stat(join(workspace.root, path));
    expect(after.ino).toBe(before.ino);
    expect(after.mtimeMs).toBe(before.mtimeMs);
    expect(
      await workspace.applyTextEdit({
        path,
        oid,
        expectedSha256: hash(content),
        text: "BOM retained",
      }),
    ).toMatchObject({ ok: true, written: true });
    expect(await readFile(join(workspace.root, path))).toEqual(
      Buffer.from(content.replace("Hello", "BOM retained")),
    );
  });
  it("keeps recovery records owner-readable and private under a restrictive umask", async () => {
    const path = join(directory, "private-record.json");
    const previous = process.umask(0o777);
    try {
      await durableJson(path, { pending: "kept" });
      expect((await stat(path)).mode & 0o777).toBe(0o600);
      expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
        pending: "kept",
      });
    } finally {
      process.umask(previous);
    }
  });
  it("joins the save queue synchronously and refuses the second stale caller", async () => {
    const path = "src/queued.tsx";
    await writeFile(join(workspace.root, path), source);
    const oid = preparePreviewSource(join(workspace.root, path), source)
      .injectedOids[1];
    const request = { path, oid, expectedSha256: hash(source) };
    const [first, second] = await Promise.all([
      workspace.applyTextEdit({ ...request, text: "First" }),
      workspace.applyTextEdit({ ...request, text: "Second" }),
    ]);
    expect(first).toMatchObject({ ok: true, written: true });
    expect(second).toMatchObject({ ok: false, reason: "stale-file" });
    expect(await readFile(join(workspace.root, path), "utf8")).toBe(
      source.replace("Hello", "First"),
    );
  });
  it("restores a durable interrupted-save record after reopening, and preserves external conflicts", async () => {
    const root = workspace.root;
    const path = "src/recovery.tsx";
    await writeFile(join(root, path), source);
    const record = join(
      directory,
      "recovery",
      hash(root),
      `${hash(path)}.json`,
    );
    const after = source.replace("Hello", "Recovered");
    await durableJson(record, {
      schema: 1,
      path,
      before: Buffer.from(source).toString("base64"),
      after: Buffer.from(after).toString("base64"),
    });
    await workspace.close();
    workspace = await LocalWorkspace.open(
      root,
      join(directory, "files"),
      join(directory, "recovery"),
    );
    expect(await workspace.pending()).toHaveLength(1);
    expect(await workspace.recover("restore")).toMatchObject({ ok: true });
    expect(await readFile(join(root, path), "utf8")).toBe(after);
    expect(await workspace.pending()).toHaveLength(0);
    await durableJson(record, {
      schema: 1,
      path,
      before: Buffer.from(source).toString("base64"),
      after: Buffer.from(after).toString("base64"),
    });
    await writeFile(join(root, path), "External change remains");
    expect(await workspace.recover("restore")).toMatchObject({
      ok: false,
      reason: "stale-file",
    });
    expect(await workspace.pending()).toHaveLength(1);
    expect(await workspace.recover("keep")).toMatchObject({ ok: true });
    expect(await readFile(join(root, path), "utf8")).toBe(
      "External change remains",
    );
    expect(await workspace.pending()).toHaveLength(0);
  });
  it("pauses admission synchronously and drains an in-flight save before recovery inspection", async () => {
    const path = "src/drain.tsx";
    await writeFile(join(workspace.root, path), source);
    const oid = preparePreviewSource(join(workspace.root, path), source)
      .injectedOids[1];
    const request = {
      path,
      oid,
      expectedSha256: hash(source),
      text: "Drained",
    };
    const save = workspace.applyTextEdit(request);
    const drained = workspace.pauseWrites();
    try {
      await expect(workspace.applyTextEdit(request)).rejects.toMatchObject({
        reason: "unavailable",
      });
      await drained;
      expect(await save).toMatchObject({ ok: true, written: true });
      expect(await workspace.pending()).toHaveLength(0);
      expect(await readFile(join(workspace.root, path), "utf8")).toBe(
        source.replace("Hello", "Drained"),
      );
    } finally {
      workspace.resumeWrites();
    }
    expect(await workspace.undo()).toMatchObject({ ok: true });
  });
  it("discovers static App Router routes and fails closed on missing, ambiguous, dynamic, or hostile routes", async () => {
    const appDir = join(workspace.root, "src/app");
    try {
      await mkdir(join(appDir, "about"), { recursive: true });
      await mkdir(join(appDir, "(marketing)/pricing"), { recursive: true });
      await mkdir(join(appDir, "journal/[slug]"), { recursive: true });
      await writeFile(join(appDir, "page.tsx"), source);
      await writeFile(join(appDir, "about/page.tsx"), source);
      await writeFile(join(appDir, "(marketing)/pricing/page.tsx"), source);
      await writeFile(join(appDir, "journal/[slug]/page.tsx"), source);

      const snapshot = await workspace.discoverRoutes();
      expect(snapshot.routes).toEqual([
        { route: "/", sourcePath: "src/app/page.tsx" },
        { route: "/about", sourcePath: "src/app/about/page.tsx" },
        {
          route: "/pricing",
          sourcePath: "src/app/(marketing)/pricing/page.tsx",
        },
      ]);
      expect(snapshot.unsupported).toEqual([
        expect.objectContaining({
          route: "/journal/[slug]",
          sourcePath: "src/app/journal/[slug]/page.tsx",
          reason: "dynamic-route",
        }),
      ]);

      const selected = await workspace.selectRoute(
        "http://127.0.0.1:4321/",
        "/about",
      );
      expect(selected).toMatchObject({
        ok: true,
        route: "/about",
        sourcePath: "src/app/about/page.tsx",
        previewUrl: "http://127.0.0.1:4321/about",
        routes: snapshot.routes,
        unsupportedRoutes: snapshot.unsupported,
      });

      await rm(join(appDir, "about/page.tsx"));
      expect(
        await workspace.selectRoute("http://127.0.0.1:4321/", "/about"),
      ).toMatchObject({
        ok: false,
        reason: "route-not-found",
      });

      await writeFile(join(appDir, "about/page.tsx"), source);
      await mkdir(join(appDir, "(group)/about"), { recursive: true });
      await writeFile(join(appDir, "(group)/about/page.tsx"), source);
      const duplicateSnapshot = await workspace.discoverRoutes();
      expect(duplicateSnapshot.unsupported).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            route: "/about",
            reason: "ambiguous-route",
          }),
        ]),
      );
      expect(
        await workspace.selectRoute("http://127.0.0.1:4321/", "/about"),
      ).toMatchObject({
        ok: false,
        reason: "route-unsupported",
      });

      expect(
        await workspace.selectRoute(
          "http://127.0.0.1:4321/",
          "/journal/[slug]",
        ),
      ).toMatchObject({
        ok: false,
        reason: "route-unsupported",
      });

      for (const hostile of [
        "http://evil.com",
        "//evil.com",
        "/about/../secret",
        "/about?x=1",
      ]) {
        expect(
          await workspace.selectRoute("http://127.0.0.1:4321/", hostile),
        ).toMatchObject({
          ok: false,
          reason: "invalid-request",
        });
      }
    } finally {
      await rm(appDir, { recursive: true, force: true });
    }
  });
});
