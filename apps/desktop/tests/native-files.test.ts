import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  chmod,
  type FileHandle,
  link,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("native handle-relative file helper", () => {
  let root: string;
  let binary: string;
  let grant: FileHandle;
  beforeAll(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "allstudio-native-")));
    binary = join(root, "files");
    execFileSync("cc", [
      "-std=c11",
      "-Wall",
      "-Wextra",
      "-Werror",
      resolve("apps/desktop/native/files.c"),
      "-o",
      binary,
    ]);
    await mkdir(join(root, "src"));
    grant = await open(root, "r");
  });
  afterAll(async () => {
    await grant?.close();
    if (root) await rm(root, { recursive: true, force: true });
  });
  function write(path: string, before: string, after: string) {
    return spawnSync(binary, ["write", root, path], {
      stdio: ["pipe", "pipe", "pipe", grant.fd],
      input: Buffer.concat([
        Buffer.from(`${Buffer.byteLength(before)}\n`),
        Buffer.from(before),
        Buffer.from(`${Buffer.byteLength(after)}\n`),
        Buffer.from(after),
        Buffer.from("C"),
      ]),
    });
  }
  it("reads and atomically replaces a file with expected-byte checks and mode preservation", async () => {
    const file = join(root, "src/page.tsx");
    await writeFile(file, "original", { mode: 0o640 });
    expect(
      spawnSync(binary, ["read", root, "src/page.tsx"], {
        stdio: ["pipe", "pipe", "pipe", grant.fd],
      }).stdout.toString(),
    ).toBe("OK 416 8\noriginal");
    expect(write("src/page.tsx", "original", "changed").status).toBe(0);
    expect(await readFile(file, "utf8")).toBe("changed");
    expect((await stat(file)).mode & 0o777).toBe(0o640);
    expect(
      write("src/page.tsx", "original", "overwritten").stdout.toString(),
    ).toContain("stale-file");
    expect(await readFile(file, "utf8")).toBe("changed");
  });
  it("denies traversal, symlinks and hardlinks without changing their targets", async () => {
    const outside = join(root, "outside.tsx");
    await writeFile(outside, "safe");
    await symlink(outside, join(root, "src/symlink.tsx"));
    await link(outside, join(root, "src/hardlink.tsx"));
    for (const path of [
      "../outside.tsx",
      "src/../outside.tsx",
      "src//x.tsx",
      "src/./x.tsx",
      "src/symlink.tsx",
      "src/hardlink.tsx",
      "src\\x.tsx",
      "package.json",
    ]) {
      expect(write(path, "safe", "unsafe").status).not.toBe(0);
    }
    expect(await readFile(outside, "utf8")).toBe("safe");
  });
  it("refuses missing or mismatched directory grants", () => {
    expect(spawnSync(binary, ["read", root, "src/page.tsx"]).status).not.toBe(
      0,
    );
    expect(
      spawnSync(binary, ["read", join(root, "src"), "src/page.tsx"], {
        stdio: ["pipe", "pipe", "pipe", grant.fd],
      }).status,
    ).not.toBe(0);
  });
  it("aborts a prepared write without replacing the source and removes its temp through the held parent", async () => {
    await writeFile(join(root, "src/abort.tsx"), "before");
    const child = spawn(binary, ["write", root, "src/abort.tsx"], {
      stdio: ["pipe", "pipe", "pipe", grant.fd],
    });
    assert(child.stdin && child.stdout);
    const closed = new Promise<number | null>((done) =>
      child.once("close", done),
    );
    const lines = createInterface({ input: child.stdout })[
      Symbol.asyncIterator
    ]();
    expect((await lines.next()).value).toBe("READY");
    child.stdin.write("6\nbefore5\nafter");
    expect((await lines.next()).value).toBe("PREPARED");
    expect(
      (await readdir(join(root, "src"))).some((name) => name.endsWith(".tmp")),
    ).toBe(true);
    child.stdin.end();
    expect(await closed).not.toBe(0);
    expect(await readFile(join(root, "src/abort.tsx"), "utf8")).toBe("before");
    expect(
      (await readdir(join(root, "src"))).some((name) => name.endsWith(".tmp")),
    ).toBe(false);
  });
  it("rejects a prepared temp entry replaced before commit without changing the source", async () => {
    await writeFile(join(root, "src/replaced.tsx"), "before");
    const child = spawn(binary, ["write", root, "src/replaced.tsx"], {
      stdio: ["pipe", "pipe", "pipe", grant.fd],
    });
    assert(child.stdin && child.stdout);
    const closed = new Promise<number | null>((done) =>
      child.once("close", done),
    );
    const lines = createInterface({ input: child.stdout })[
      Symbol.asyncIterator
    ]();
    expect((await lines.next()).value).toBe("READY");
    child.stdin.write("6\nbefore5\nafter");
    expect((await lines.next()).value).toBe("PREPARED");
    const temporary = (await readdir(join(root, "src"))).find((name) =>
      name.endsWith(".tmp"),
    );
    expect(temporary).toBeDefined();
    await rm(join(root, "src", temporary ?? "missing"));
    await writeFile(
      join(root, "src", temporary ?? "missing"),
      "injected-content",
    );
    child.stdin.end("C");
    expect(await closed).not.toBe(0);
    expect(await readFile(join(root, "src/replaced.tsx"), "utf8")).toBe(
      "before",
    );
    expect(
      await readFile(join(root, "src", temporary ?? "missing"), "utf8"),
    ).toBe("injected-content");
    await rm(join(root, "src", temporary ?? "missing"));
  });
  it("refuses a prepared temp whose permissions changed before commit", async () => {
    const source = join(root, "src/mode.tsx");
    await writeFile(source, "before", { mode: 0o640 });
    const child = spawn(binary, ["write", root, "src/mode.tsx"], {
      stdio: ["pipe", "pipe", "pipe", grant.fd],
    });
    assert(child.stdin && child.stdout);
    const closed = new Promise<number | null>((done) =>
      child.once("close", done),
    );
    const lines = createInterface({ input: child.stdout })[
      Symbol.asyncIterator
    ]();
    expect((await lines.next()).value).toBe("READY");
    child.stdin.write("6\nbefore5\nafter");
    expect((await lines.next()).value).toBe("PREPARED");
    const temporary = (await readdir(join(root, "src"))).find((name) =>
      name.endsWith(".tmp"),
    );
    expect(temporary).toBeDefined();
    await chmod(join(root, "src", temporary ?? "missing"), 0o777);
    child.stdin.end("C");
    expect(await closed).not.toBe(0);
    expect(await readFile(source, "utf8")).toBe("before");
    expect((await stat(source)).mode & 0o777).toBe(0o640);
  });
  it("refuses a parent swapped for a symlink after opening and never cleans up through the swapped path", async () => {
    const outside = join(root, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "page.tsx"), "outside");
    const child = spawn(binary, ["write", root, "src/page.tsx"], {
      stdio: ["pipe", "pipe", "pipe", grant.fd],
    });
    assert(child.stdin && child.stdout);
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    const lines = createInterface({ input: child.stdout })[
      Symbol.asyncIterator
    ]();
    assert(child.stdin && child.stdout);
    const closed = new Promise<number | null>((done) =>
      child.once("close", done),
    );
    expect((await lines.next()).value).toBe("READY");
    child.stdin.write("7\nchanged6\nunsafe");
    expect((await lines.next()).value).toBe("PREPARED");
    await rename(join(root, "src"), join(root, "moved"));
    await symlink(outside, join(root, "src"));
    child.stdin.end("C");
    expect(await closed).not.toBe(0);
    expect(output).toContain("path-rejected");
    expect(await readFile(join(outside, "page.tsx"), "utf8")).toBe("outside");
    expect(await readFile(join(root, "moved/page.tsx"), "utf8")).toBe(
      "changed",
    );
    expect(
      (await readdir(join(root, "moved"))).some((name) =>
        name.endsWith(".tmp"),
      ),
    ).toBe(false);
  });
});
