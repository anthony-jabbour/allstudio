import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

export async function pruneThumbnailCache(
  data: string,
  retainedIds: ReadonlySet<string>,
): Promise<void> {
  const directory = join(data, "thumbnails");
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    },
  );

  for (const entry of entries) {
    const image = /^([a-f0-9]{64})\.jpg$/.exec(entry.name);
    const temporary = /^[a-f0-9]{64}\.jpg\.\d+\.[a-f0-9]{16}\.tmp$/.test(
      entry.name,
    );
    if (
      (!temporary && (!image || retainedIds.has(image[1]))) ||
      (!entry.isFile() && !entry.isSymbolicLink())
    )
      continue;
    await unlink(join(directory, entry.name)).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
  }
}
