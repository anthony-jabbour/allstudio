import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";

export async function durableJson(path: string, value: unknown) {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await open(temp, "wx", 0o600);
    try {
      await file.chmod(0o600);
      await file.writeFile(`${JSON.stringify(value)}\n`);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temp, path);
    await syncDirectory(directory);
  } finally {
    await rm(temp, { force: true });
  }
}

export async function syncDirectory(path: string) {
  const directory = await open(path, "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
