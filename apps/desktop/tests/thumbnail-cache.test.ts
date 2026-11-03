import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { pruneThumbnailCache } from "../src/main/thumbnail-cache.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("pruneThumbnailCache", () => {
  it("keeps retained project images and removes stale images and capture temps", async () => {
    const data = await mkdtemp(join(tmpdir(), "allstudio-thumbnails-"));
    roots.push(data);
    const directory = join(data, "thumbnails");
    const kept = "a".repeat(64);
    const stale = "b".repeat(64);
    await mkdir(directory);
    await writeFile(join(directory, `${kept}.jpg`), "kept");
    await writeFile(join(directory, `${stale}.jpg`), "stale");
    await writeFile(
      join(directory, `${kept}.jpg.123.0123456789abcdef.tmp`),
      "interrupted capture",
    );
    await writeFile(join(directory, "unrecognized.txt"), "leave alone");

    await pruneThumbnailCache(data, new Set([kept]));

    expect((await readdir(directory)).sort()).toEqual(
      [`${kept}.jpg`, "unrecognized.txt"].sort(),
    );
  });

  it("ignores a cache directory that has not been created", async () => {
    const data = await mkdtemp(join(tmpdir(), "allstudio-thumbnails-"));
    roots.push(data);

    await expect(pruneThumbnailCache(data, new Set())).resolves.toBeUndefined();
  });
});
