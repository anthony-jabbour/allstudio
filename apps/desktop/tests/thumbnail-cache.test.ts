import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { NativeFiles } from "../src/main/native-files.ts";

const retained = "a".repeat(64);
const stale = "b".repeat(64);
const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
let binaryDirectory: string;
let binary: string;
let root: string | undefined;
let files: NativeFiles | undefined;

beforeAll(async () => {
  binaryDirectory = await mkdtemp(join(tmpdir(), "allstudio-thumb-bin-"));
  binary = join(binaryDirectory, "files");
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

afterEach(async () => {
  await files?.close();
  files = undefined;
  if (root) await rm(root, { recursive: true, force: true });
  root = undefined;
});

afterAll(async () => {
  await rm(binaryDirectory, { recursive: true, force: true });
});

async function fixture() {
  root = await mkdtemp(join(tmpdir(), "allstudio-thumb-root-"));
  files = await NativeFiles.open(root, binary);
  return { root, files };
}

describe("handle-relative thumbnail cache", () => {
  it("bounds retained thumbnails and reads/writes/removes cache files through the held root", async () => {
    const f = await fixture();
    const directory = join(f.root, "thumbnails");
    await f.files.writeThumbnail(retained, null, image);
    await writeFile(join(directory, `${stale}.jpg`), image);
    await writeFile(
      join(directory, `${retained}.jpg.123.0123456789abcdef.tmp`),
      "interrupted capture",
    );

    await f.files.pruneThumbnails(new Set([retained]));

    expect(await readdir(directory)).toEqual([`${retained}.jpg`]);
    expect(await f.files.readThumbnail(retained)).toEqual(image);
    const replacement = Buffer.from([0xff, 0xd8, 0xfe, 0xd9]);
    await f.files.writeThumbnail(retained, image, replacement);
    expect(await f.files.readThumbnail(retained)).toEqual(replacement);
    await f.files.removeThumbnail(`${retained}.jpg`);
    expect(await readdir(directory)).toEqual([]);
  });

  it("fails closed on a symlinked thumbnail directory without reading, writing or deleting its target", async () => {
    const f = await fixture();
    const outside = join(f.root, "outside");
    await mkdir(outside);
    await writeFile(join(outside, `${retained}.jpg`), image);
    await symlink(outside, join(f.root, "thumbnails"));

    await expect(
      f.files.pruneThumbnails(new Set([retained])),
    ).rejects.toMatchObject({ reason: "path-rejected" });
    await expect(f.files.readThumbnail(retained)).rejects.toMatchObject({
      reason: "path-rejected",
    });
    await expect(
      f.files.writeThumbnail(retained, null, image),
    ).rejects.toMatchObject({
      reason: "path-rejected",
    });
    await expect(
      f.files.removeThumbnail(`${retained}.jpg`),
    ).rejects.toMatchObject({
      reason: "path-rejected",
    });
    expect(await readFile(join(outside, `${retained}.jpg`))).toEqual(image);
  });
});
