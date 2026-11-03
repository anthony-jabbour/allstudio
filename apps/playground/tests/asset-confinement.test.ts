import {
  mkdir,
  mkdtemp,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  swap: null as null | (() => Promise<void>),
  lstatSwap: null as null | {
    pathSuffix: string;
    during: () => Promise<void>;
    restore: () => Promise<void>;
  },
}));
vi.mock("node:fs/promises", async (load) => {
  const fs = await load<typeof import("node:fs/promises")>();
  return {
    ...fs,
    readdir: async (...args: Parameters<typeof fs.readdir>) => {
      const swap = state.swap;
      state.swap = null;
      if (swap) await swap();
      return fs.readdir(...args);
    },
    lstat: async (...args: Parameters<typeof fs.lstat>) => {
      const swap = state.lstatSwap;
      if (!swap || !String(args[0]).endsWith(swap.pathSuffix))
        return fs.lstat(...args);
      state.lstatSwap = null;
      try {
        await swap.during();
        return await fs.lstat(...args);
      } finally {
        await swap.restore();
      }
    },
  };
});

import { DevWorkspace } from "../dev/dev-workspace.ts";

it("returns no metadata when a checked public directory is swapped to an outside symlink", async () => {
  const root = await mkdtemp(join(tmpdir(), "allstudio-asset-swap-"));
  try {
    await mkdir(join(root, "public"));
    await mkdir(join(root, "outside"));
    await writeFile(join(root, "outside/private.svg"), "private");
    const workspace = await DevWorkspace.open(root);
    state.swap = async () => {
      await rename(join(root, "public"), join(root, "old-public"));
      await symlink(join(root, "outside"), join(root, "public"), "dir");
    };
    await expect(workspace.listAssets()).rejects.toThrow();
  } finally {
    state.swap = null;
    await rm(root, { recursive: true, force: true });
  }
});

it("never returns outside asset metadata after a restored directory-swap race", async () => {
  const root = await mkdtemp(join(tmpdir(), "allstudio-asset-restore-race-"));
  const publicPath = join(root, "public");
  const outsidePath = join(root, "outside");
  const safeContent = "safe";
  const outsideContent = "outside-private-metadata";
  try {
    await mkdir(publicPath);
    await mkdir(outsidePath);
    await writeFile(join(publicPath, "private.svg"), safeContent);
    await writeFile(join(outsidePath, "private.svg"), outsideContent);
    const workspace = await DevWorkspace.open(root);
    state.lstatSwap = {
      pathSuffix: "private.svg",
      during: async () => {
        await rename(publicPath, join(root, "old-public"));
        await symlink(outsidePath, publicPath, "dir");
      },
      restore: async () => {
        await rm(publicPath, { recursive: true, force: true });
        await rename(join(root, "old-public"), publicPath);
      },
    };
    const assets = await workspace.listAssets().catch(() => []);
    expect(
      assets.some(
        (asset) =>
          asset.path === "public/private.svg" &&
          asset.size === Buffer.byteLength(outsideContent),
      ),
    ).toBe(false);
  } finally {
    state.lstatSwap = null;
    await rm(root, { recursive: true, force: true });
  }
});
