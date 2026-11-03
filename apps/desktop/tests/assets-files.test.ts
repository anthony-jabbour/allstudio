import { execFileSync, spawnSync } from "node:child_process";
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rm,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { LocalWorkspace } from "../src/main/local-workspace.ts";
import { NativeFiles } from "../src/main/native-files.ts";
import { preparePreviewSource } from "../src/main/preview-source.ts";

let base: string, binary: string;
beforeAll(async () => {
  base = await realpath(
    await mkdtemp(join(tmpdir(), "allstudio-assets-files-")),
  );
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
async function fixture() {
  const root = await realpath(await mkdtemp(join(base, "case-")));
  const fd = await open(root, "r");
  return {
    root,
    fd,
    run: (op: string, path = "public") =>
      spawnSync(binary, [op, root, path], {
        stdio: ["pipe", "pipe", "pipe", fd.fd],
        input: Buffer.from("0\n0\nC"),
      }),
  };
}
it("lists bounded public image metadata without opening bytes, including empty/large status facts", async () => {
  const f = await fixture();
  try {
    expect(f.run("list-assets").stdout.toString()).toBe("OK\n");
    await mkdir(join(f.root, "public/icons"), { recursive: true });
    await writeFile(join(f.root, "public/icons/a.svg"), "private-image-bytes");
    await chmod(join(f.root, "public/icons/a.svg"), 0);
    await writeFile(join(f.root, "public/empty.png"), "");
    await writeFile(join(f.root, "public/large.JPG"), "");
    await truncate(join(f.root, "public/large.JPG"), 10 * 1024 * 1024 + 1);
    await writeFile(join(f.root, "public/code.js"), "not an asset");
    await writeFile(join(f.root, "public/notes#draft.txt"), "not an asset");
    const list = f.run("list-assets");
    expect(list.status).toBe(0);
    expect(list.stdout.toString()).toContain("public/icons/a.svg");
    expect(list.stdout.toString()).not.toContain("private-image-bytes");
    expect(list.stdout.toString()).not.toContain("code.js");
    expect(list.stdout.toString()).not.toContain("notes#draft.txt");
    const files = await NativeFiles.open(f.root, binary);
    try {
      const assets = await files.listAssets();
      expect(assets).toEqual(
        expect.arrayContaining([
          {
            path: "public/icons/a.svg",
            url: "/icons/a.svg",
            type: "image/svg+xml",
            size: 19,
          },
          {
            path: "public/empty.png",
            url: "/empty.png",
            type: "image/png",
            size: 0,
          },
          {
            path: "public/large.JPG",
            url: "/large.JPG",
            type: "image/jpeg",
            size: 10 * 1024 * 1024 + 1,
          },
        ]),
      );
    } finally {
      await files.close();
    }
  } finally {
    await chmod(join(f.root, "public/icons/a.svg"), 0o600).catch(() => {});
    await f.fd.close();
  }
});
it("never reads/writes asset bytes or accepts another listing root", async () => {
  const f = await fixture();
  try {
    await mkdir(join(f.root, "public"));
    await writeFile(join(f.root, "public/a.svg"), "retained");
    for (const [operation, path] of [
      ["read", "public/a.svg"],
      ["write", "public/a.svg"],
      ["read-css", "public/a.svg"],
      ["read-audit-source", "public/a.svg"],
      ["list-assets", "src"],
      ["list-assets", "public/../"],
      ["list-assets", "/public"],
    ] as const)
      expect(f.run(operation, path).status).not.toBe(0);
    expect(await readFile(join(f.root, "public/a.svg"), "utf8")).toBe(
      "retained",
    );
  } finally {
    await f.fd.close();
  }
});
it("rejects symlink/hardlink/invalid-name targets and inspection overflow", async () => {
  const f = await fixture();
  try {
    await mkdir(join(f.root, "public"));
    const outside = join(base, "outside.svg");
    await writeFile(outside, "outside");
    const target = join(f.root, "public/a.svg");
    await symlink(outside, target);
    expect(f.run("list-assets").status).not.toBe(0);
    await rm(target);
    await link(outside, target);
    expect(f.run("list-assets").status).not.toBe(0);
    await rm(target);
    await symlink(base, join(f.root, "public/linked"), "dir");
    expect(f.run("list-assets").status).not.toBe(0);
    await rm(join(f.root, "public/linked"));
    for (let i = 0; i < 501; i++)
      await writeFile(join(f.root, `public/${i}.png`), "x");
    expect(f.run("list-assets").status).not.toBe(0);
  } finally {
    await f.fd.close();
  }
});
it("previews and saves an image src diff with hash, undo, redo and reopen", async () => {
  const f = await fixture();
  const source =
    'export default function Page(){return <main><img src="/studio-orbit.svg" alt="Orbit" /></main>}';
  await mkdir(join(f.root, "src/app"), { recursive: true });
  await mkdir(join(f.root, "public"));
  await writeFile(join(f.root, "src/app/page.tsx"), source);
  await writeFile(join(f.root, "public/studio-orbit.svg"), "<svg/>");
  await writeFile(join(f.root, "public/studio-arc.svg"), "<svg/>");
  const recovery = join(base, "asset-recovery");
  let workspace = await LocalWorkspace.open(f.root, binary, recovery);
  try {
    const oid = preparePreviewSource(join(f.root, "src/app/page.tsx"), source)
      .injectedOids[1];
    if (!oid) throw new Error("Fixture image OID missing");
    const located = await workspace.locate(oid);
    if (!located.ok) throw new Error(located.reason);
    expect(located.element.image).toMatchObject({
      ok: true,
      src: "/studio-orbit.svg",
    });
    const request = {
      path: "src/app/page.tsx",
      oid,
      expectedSha256: located.element.sha256,
      assetPath: "public/studio-arc.svg",
    };
    const preview = await workspace.previewAssetEdit(request);
    expect(preview).toMatchObject({ ok: true, written: false });
    expect(preview.ok && preview.diff).toContain(
      '+export default function Page(){return <main><img src="/studio-arc.svg"',
    );
    expect(await readFile(join(f.root, request.path), "utf8")).toBe(source);
    const saved = await workspace.applyAssetEdit(request);
    expect(saved).toMatchObject({ ok: true, written: true });
    expect(await workspace.applyAssetEdit(request)).toMatchObject({
      ok: false,
      reason: "stale-file",
    });
    expect(await readFile(join(f.root, request.path), "utf8")).toContain(
      'src="/studio-arc.svg"',
    );
    expect(await workspace.undo()).toMatchObject({ ok: true, written: true });
    expect(await readFile(join(f.root, request.path), "utf8")).toBe(source);
    expect(await workspace.redo()).toMatchObject({ ok: true, written: true });
    await workspace.close();
    workspace = await LocalWorkspace.open(f.root, binary, recovery);
    expect(await readFile(join(f.root, request.path), "utf8")).toContain(
      'src="/studio-arc.svg"',
    );
  } finally {
    await workspace.close();
    await f.fd.close();
  }
});
