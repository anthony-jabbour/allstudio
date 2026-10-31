import { execFileSync, spawnSync } from "node:child_process";
import {
  link,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NativeFiles } from "../src/main/native-files.ts";

describe("readonly responsive metadata native boundary", () => {
  let base: string, binary: string;
  beforeAll(async () => {
    base = await realpath(
      await mkdtemp(join(tmpdir(), "allstudio-responsive-files-")),
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
    await mkdir(join(root, "src"));
    const fd = await open(root, "r");
    return {
      root,
      fd,
      run: (operation: string, path: string) =>
        spawnSync(binary, [operation, root, path], {
          stdio: ["pipe", "pipe", "pipe", fd.fd],
          input: Buffer.from("0\n0\nC"),
        }),
    };
  }
  it("lists style metadata and reads only bounded CSS without changing bytes", async () => {
    const f = await fixture();
    try {
      await writeFile(join(f.root, "src/theme.css"), '@import "tailwindcss";');
      await writeFile(join(f.root, "src/other.scss"), "$x:1;");
      await writeFile(join(f.root, "src/page.tsx"), "<h1 />");
      const list = f.run("list-styles", "src");
      expect(list.status).toBe(0);
      expect(list.stdout.toString()).toContain("src/theme.css");
      expect(list.stdout.toString()).toContain("src/other.scss");
      expect(list.stdout.toString()).not.toContain("page.tsx");
      const read = f.run("read-css", "src/theme.css");
      expect(read.status).toBe(0);
      expect(read.stdout.toString()).toContain('@import "tailwindcss";');
      expect(await readFile(join(f.root, "src/theme.css"), "utf8")).toBe(
        '@import "tailwindcss";',
      );
    } finally {
      await f.fd.close();
    }
  });
  it("uses the existing Node file wrapper for readonly styles without enabling writes", async () => {
    const f = await fixture();
    const files = await NativeFiles.open(f.root, binary);
    try {
      await writeFile(join(f.root, "src/theme.css"), '@import "tailwindcss";');
      expect(await files.listStyles()).toEqual(["src/theme.css"]);
      expect((await files.readCss("src/theme.css")).bytes.toString()).toBe(
        '@import "tailwindcss";',
      );
      await expect(
        files.write(
          "src/theme.css",
          Buffer.from('@import "tailwindcss";'),
          Buffer.from("changed"),
        ),
      ).rejects.toThrow();
      expect(await readFile(join(f.root, "src/theme.css"), "utf8")).toBe(
        '@import "tailwindcss";',
      );
    } finally {
      await files.close();
      await f.fd.close();
    }
  });
  it("denies CSS writes, non-CSS reads, alternate roots and traversal", async () => {
    const f = await fixture();
    try {
      await writeFile(join(f.root, "src/theme.css"), "safe");
      await writeFile(join(f.root, "outside.css"), "outside");
      await writeFile(join(f.root, "src/page.tsx"), "<h1 />");
      for (const [operation, path] of [
        ["write", "src/theme.css"],
        ["create", "src/theme.css"],
        ["backup", "src/theme.css"],
        ["read-css", "src/page.tsx"],
        ["read-css", "../outside.css"],
        ["read-css", "src/../outside.css"],
        ["list-styles", "public"],
        ["list-styles", "src/page.tsx"],
      ]) {
        const result = f.run(operation!, path!);
        expect(result.status).not.toBe(0);
        expect(result.stdout.toString()).toContain("ERR path-rejected");
      }
      expect(await readFile(join(f.root, "src/theme.css"), "utf8")).toBe(
        "safe",
      );
      expect(await readFile(join(f.root, "outside.css"), "utf8")).toBe(
        "outside",
      );
    } finally {
      await f.fd.close();
    }
  });
  it.each([
    "symlink",
    "hardlink",
    "oversize",
  ])("does not silently omit unsafe %s CSS from eligibility scans", async (kind) => {
    const f = await fixture();
    try {
      const target = join(f.root, "outside.css");
      await writeFile(target, "outside");
      const css = join(f.root, "src/theme.css");
      if (kind === "symlink") await symlink(target, css);
      else if (kind === "hardlink") await link(target, css);
      else await writeFile(css, Buffer.alloc(1024 * 1024 + 1));
      expect(f.run("list-styles", "src").status).not.toBe(0);
      expect(f.run("read-css", "src/theme.css").status).not.toBe(0);
      expect(await readFile(target, "utf8")).toBe("outside");
    } finally {
      await f.fd.close();
    }
  });
  it("rejects directory symlinks and CSS file writes through aliases", async () => {
    const f = await fixture();
    try {
      const outside = join(f.root, "outside");
      await mkdir(outside);
      await writeFile(join(outside, "theme.css"), "outside");
      await symlink(outside, join(f.root, "src/alias"));
      expect(f.run("list-styles", "src").status).not.toBe(0);
      expect(f.run("read-css", "src/alias/theme.css").status).not.toBe(0);
    } finally {
      await f.fd.close();
    }
  });
});
