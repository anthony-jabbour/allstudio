import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { hash, LocalWorkspace } from "../src/main/local-workspace.ts";
import { preparePreviewSource } from "../src/main/preview-source.ts";

let base: string, binary: string;
beforeAll(async () => {
  base = await realpath(await mkdtemp(join(tmpdir(), "allstudio-reorder-")));
  binary = join(base, "files");
  execFileSync("cc", [
    "-std=c11",
    "-Wall",
    "-Wextra",
    "-Werror",
    resolve("apps/desktop/native/files.c"),
    "-o",
    binary,
  ]);
});
afterAll(async () => {
  if (base) await rm(base, { recursive: true, force: true });
});
it("previews and persists an exact sibling swap, remaps virtual identity and retains native history", async () => {
  const root = join(base, "project");
  await mkdir(join(root, "src/app"), { recursive: true });
  const a = '<p key="a">First paragraph</p>',
    b = '<h1 key="b">Heading</h1>',
    gap = "\n  ";
  const source = `export default function Page(){return <main>${a}${gap}${b}</main>}`;
  const file = join(root, "src/app/page.tsx");
  await writeFile(file, source);
  const workspace = await LocalWorkspace.open(
    root,
    binary,
    join(base, "recovery"),
  );
  try {
    const preview = preparePreviewSource(file, source);
    const oid = preview.injectedOids[1],
      siblingOid = preview.injectedOids[2];
    if (!oid || !siblingOid) throw new Error("IDs missing");
    const located = await workspace.locate(oid);
    if (!located.ok) throw new Error(located.reason);
    expect(located.element.reorder).toMatchObject({
      ok: true,
      down: { oid: siblingOid },
    });
    const request = {
      path: "src/app/page.tsx",
      oid,
      siblingOid,
      direction: "down" as const,
      expectedSha256: located.element.sha256,
    };
    const patch = await workspace.previewReorder(request);
    expect(patch).toMatchObject({ ok: true, written: false, noop: false });
    expect(await readFile(file, "utf8")).toBe(source);
    const saved = await workspace.applyReorder(request);
    expect(saved.ok).toBe(true);
    if (!saved.ok || !saved.oid || !saved.reorder)
      throw new Error("Missing move receipt");
    const after = source.replace(a + gap + b, b + gap + a);
    expect(await readFile(file, "utf8")).toBe(after);
    expect(saved.sha256).toBe(hash(after));
    const moved = await workspace.locate(saved.oid);
    expect(moved.ok && moved.element.text).toEqual({
      ok: true,
      text: "First paragraph",
    });
    const neighbor = await workspace.locate(saved.reorder.siblingOid);
    expect(neighbor.ok && neighbor.element.text).toEqual({
      ok: true,
      text: "Heading",
    });
    expect(await workspace.applyReorder(request)).toMatchObject({
      ok: false,
      reason: "stale-file",
    });
    expect((await workspace.undo()).ok).toBe(true);
    expect(await readFile(file, "utf8")).toBe(source);
    expect((await workspace.redo()).ok).toBe(true);
    expect(await readFile(file, "utf8")).toBe(after);
  } finally {
    await workspace.close();
  }
});
it("refuses component-definition files and traversal without changing any source", async () => {
  const root = join(base, "unsupported");
  await mkdir(join(root, "src/components"), { recursive: true });
  const source =
    "export default function Card(){return <div><h2>Title</h2><p>Copy</p></div>}";
  const file = join(root, "src/components/card.tsx");
  await writeFile(file, source);
  const workspace = await LocalWorkspace.open(
    root,
    binary,
    join(base, "unsupported-recovery"),
  );
  try {
    const preview = preparePreviewSource(file, source);
    const oid = preview.injectedOids[1],
      siblingOid = preview.injectedOids[2];
    if (!oid || !siblingOid) throw new Error("Missing IDs");
    const request = {
      path: "src/components/card.tsx",
      oid,
      siblingOid,
      direction: "down" as const,
      expectedSha256: hash(source),
    };
    expect(await workspace.applyReorder(request)).toMatchObject({
      ok: false,
      reason: "unsupported-reorder",
    });
    expect(
      await workspace.applyReorder({ ...request, path: "../outside.tsx" }),
    ).toMatchObject({ ok: false, reason: "path-rejected" });
    expect(await readFile(file, "utf8")).toBe(source);
  } finally {
    await workspace.close();
  }
});
