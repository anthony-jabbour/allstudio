import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyIntegration,
  planIntegration,
} from "../src/main/config-integration.ts";
import { NativeFiles } from "../src/main/native-files.ts";

describe("consented Next config integration", () => {
  it("preserves asynchronous CommonJS config outside the app, including a BOM package manifest", async () => {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), "allstudio-config-")),
    );
    const binary = join(root, "files");
    execFileSync("cc", [
      "-std=c11",
      "-Wall",
      "-Wextra",
      "-Werror",
      resolve("apps/desktop/native/files.c"),
      "-o",
      binary,
    ]);
    await writeFile(join(root, "package.json"), '\uFEFF{"type":"commonjs"}');
    await writeFile(
      join(root, "next.config.js"),
      "module.exports = async () => ({ trailingSlash: true });\n",
    );
    const files = await NativeFiles.open(root, binary);
    try {
      await applyIntegration(files, await planIntegration(files));
      const output = execFileSync(
        process.execPath,
        [
          "-e",
          'require(process.argv[1])("test", {}).then((config) => process.stdout.write(JSON.stringify(config)))',
          join(root, "next.config.js"),
        ],
        { encoding: "utf8", env: {} },
      );
      expect(JSON.parse(output)).toEqual({ trailingSlash: true });
      expect((await planIntegration(files)).installed).toBe(true);
    } finally {
      await files.close();
      await rm(root, { recursive: true, force: true });
    }
  });
  it("keeps an exact adjacent backup, is idempotent, and refuses backup collisions", async () => {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), "allstudio-config-")),
    );
    const binary = join(root, "files");
    execFileSync("cc", [
      "-std=c11",
      "-Wall",
      "-Wextra",
      "-Werror",
      resolve("apps/desktop/native/files.c"),
      "-o",
      binary,
    ]);
    const files = await NativeFiles.open(root, binary);
    try {
      const original = "export default { cacheComponents: true };\n";
      await writeFile(join(root, "next.config.ts"), original);
      const plan = await planIntegration(files);
      await applyIntegration(files, plan);
      expect(
        await readFile(join(root, "next.config.allstudio-original.ts"), "utf8"),
      ).toBe(original);
      expect((await planIntegration(files)).installed).toBe(true);
      await writeFile(
        join(root, "next.config.ts"),
        original.replace("true", "false"),
      );
      await expect(
        applyIntegration(files, await planIntegration(files)),
      ).rejects.toThrow("different config backup");
      expect(await readFile(join(root, "next.config.ts"), "utf8")).toContain(
        "false",
      );
    } finally {
      await files.close();
      await rm(root, { recursive: true, force: true });
    }
  });
  it("creates an absent config without clobbering and recognizes its own empty-config wrapper", async () => {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), "allstudio-config-")),
    );
    const binary = join(root, "files");
    execFileSync("cc", [
      "-std=c11",
      "-Wall",
      "-Wextra",
      "-Werror",
      resolve("apps/desktop/native/files.c"),
      "-o",
      binary,
    ]);
    const files = await NativeFiles.open(root, binary);
    try {
      const plan = await planIntegration(files);
      await applyIntegration(files, plan);
      expect((await planIntegration(files)).installed).toBe(true);
      await expect(
        files.createConfig("next.config.mjs", Buffer.from("bad")),
      ).rejects.toThrow();
      expect(await readFile(join(root, "next.config.mjs"), "utf8")).toContain(
        "allstudio preview integration",
      );
    } finally {
      await files.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
