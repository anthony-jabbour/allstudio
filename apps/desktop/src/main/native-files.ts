import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { type FileHandle, open, realpath } from "node:fs/promises";
import {
  assetFromMetadata,
  MAX_ASSET_FILES,
  type ProjectAsset,
} from "@allstudio/editor/site";

export class FileFailure extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

export class NativeFiles {
  private active = new Set<Promise<Buffer>>();
  private closed = false;
  private constructor(
    readonly root: string,
    private binary: string,
    private grant: FileHandle,
  ) {}

  static async open(root: string, binary: string) {
    const canonical = await realpath(root);
    const grant = await open(
      canonical,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    if (!(await grant.stat()).isDirectory()) {
      await grant.close();
      throw new FileFailure("path-rejected");
    }
    return new NativeFiles(canonical, binary, grant);
  }

  async identity() {
    const value = await this.grant.stat({ bigint: true });
    return { dev: String(value.dev), ino: String(value.ino) };
  }

  async read(path: string): Promise<{ bytes: Buffer; mode: number }> {
    return this.readChecked("read", path);
  }

  async readCss(path: string): Promise<{ bytes: Buffer; mode: number }> {
    return this.readChecked("read-css", path);
  }
  async readAuditSource(
    path: string,
  ): Promise<{ bytes: Buffer; mode: number }> {
    return this.readChecked("read-audit-source", path);
  }
  async listAuditSources(): Promise<string[]> {
    return this.listChecked("list-audit-sources");
  }

  private async readChecked(
    operation: "read" | "read-css" | "read-audit-source" | "read-thumbnail",
    path: string,
  ): Promise<{ bytes: Buffer; mode: number }> {
    const result = await this.run(operation, path);
    const end = result.indexOf(10);
    const header = /^OK (\d{1,4}) (\d{1,7})$/.exec(
      result.subarray(0, end).toString(),
    );
    if (!header || result.length - end - 1 !== Number(header[2]))
      throw new FileFailure("read-failed");
    return { bytes: result.subarray(end + 1), mode: Number(header[1]) };
  }

  async write(
    path: string,
    before: Buffer,
    after: Buffer,
    prepared: () => Promise<void> = async () => {},
  ) {
    await this.run("write", path, before, after, prepared);
  }

  async backupConfig(path: string, original: Buffer) {
    await this.run("backup", path, original, original, async () => {});
  }

  async createConfig(path: string, content: Buffer) {
    await this.run("create", path, Buffer.alloc(0), content, async () => {});
  }

  async list(): Promise<string[]> {
    return this.listChecked("list");
  }

  async readThumbnail(id: string): Promise<Buffer> {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new FileFailure("path-rejected");
    const { bytes } = await this.readChecked(
      "read-thumbnail",
      `thumbnails/${id}.jpg`,
    );
    if (
      bytes.length < 4 ||
      bytes.length > 96 * 1024 ||
      bytes[0] !== 0xff ||
      bytes[1] !== 0xd8
    )
      throw new FileFailure("path-rejected");
    return bytes;
  }

  async writeThumbnail(id: string, before: Buffer | null, after: Buffer) {
    if (
      !/^[a-f0-9]{64}$/.test(id) ||
      after.length < 4 ||
      after.length > 96 * 1024 ||
      after[0] !== 0xff ||
      after[1] !== 0xd8 ||
      (before && before.length > 96 * 1024)
    )
      throw new FileFailure("path-rejected");
    await this.run(
      before ? "write-thumbnail" : "create-thumbnail",
      `thumbnails/${id}.jpg`,
      before ?? Buffer.alloc(0),
      after,
    );
  }

  async removeThumbnail(name: string) {
    if (
      !/^(?:[a-f0-9]{64}\.jpg|[a-f0-9]{64}\.jpg\.\d+\.[a-f0-9]{16}\.tmp|\.allstudio-[a-f0-9]{16}\.tmp)$/.test(
        name,
      )
    )
      throw new FileFailure("path-rejected");
    await this.run("remove-thumbnail", `thumbnails/${name}`);
  }

  async pruneThumbnails(retainedIds: ReadonlySet<string>) {
    const ids = [...retainedIds];
    if (ids.length > 100 || !ids.every((id) => /^[a-f0-9]{64}$/.test(id)))
      throw new FileFailure("path-rejected");
    await this.run(
      "prune-thumbnails",
      "thumbnails",
      Buffer.alloc(0),
      Buffer.from(ids.join("\n")),
    );
  }

  async listStyles(): Promise<string[]> {
    return this.listChecked("list-styles");
  }
  async listAssets(): Promise<ProjectAsset[]> {
    const output = await this.run("list-assets", "public");
    if (output.subarray(0, 3).toString() !== "OK\n")
      throw new FileFailure("read-failed");
    const assets: ProjectAsset[] = [];
    let offset = 3;
    while (offset < output.length) {
      const end = output.indexOf(10, offset);
      const header = /^([1-9][0-9]{0,3}) (0|[1-9][0-9]{0,15})$/.exec(
        output.subarray(offset, end).toString(),
      );
      if (end < offset || !header) throw new FileFailure("read-failed");
      const length = Number(header[1]),
        size = Number(header[2]);
      if (
        length > 1024 ||
        end + 1 + length > output.length ||
        assets.length >= MAX_ASSET_FILES
      )
        throw new FileFailure("scan-limit");
      const path = new TextDecoder("utf-8", { fatal: true }).decode(
        output.subarray(end + 1, end + 1 + length),
      );
      const asset = assetFromMetadata(path, size);
      if (!asset || assets.some((item) => item.path === path))
        throw new FileFailure("path-rejected");
      assets.push(asset);
      offset = end + 1 + length;
    }
    return assets.sort((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
    );
  }

  private async listChecked(
    operation: "list" | "list-styles" | "list-audit-sources",
  ): Promise<string[]> {
    const output = await this.run(operation, "src");
    if (output.subarray(0, 3).toString() !== "OK\n") {
      const reason = /^ERR ([a-z-]+)\n/.exec(output.toString())?.[1];
      throw new FileFailure(reason ?? "read-failed");
    }
    const result: string[] = [];
    let offset = 3;
    while (offset < output.length) {
      const end = output.indexOf(10, offset);
      const size = Number(output.subarray(offset, end).toString());
      if (
        end < offset ||
        !Number.isInteger(size) ||
        size < 1 ||
        size > 1024 ||
        end + 1 + size > output.length
      )
        throw new FileFailure("read-failed");
      result.push(
        new TextDecoder("utf-8", { fatal: true }).decode(
          output.subarray(end + 1, end + 1 + size),
        ),
      );
      offset = end + 1 + size;
    }
    return result.sort();
  }

  async close() {
    this.closed = true;
    await Promise.allSettled([...this.active]);
    await this.grant.close();
  }

  private run(
    operation: string,
    path: string,
    before?: Buffer,
    after?: Buffer,
    prepared?: () => Promise<void>,
  ): Promise<Buffer> {
    if (this.closed) return Promise.reject(new FileFailure("unavailable"));
    const job = new Promise<Buffer>((resolve, reject) => {
      const child = spawn(this.binary, [operation, this.root, path], {
        stdio: ["pipe", "pipe", "pipe", this.grant.fd],
        env: {},
      });
      if (!child.stdin || !child.stdout || !child.stderr) {
        child.kill("SIGKILL");
        reject(new FileFailure("unavailable"));
        return;
      }
      const input = child.stdin;
      const chunks: Buffer[] = [];
      let size = 0;
      let sent = false;
      let committing = false;
      let callbackFailure: unknown;
      const timer = setTimeout(() => child.kill("SIGKILL"), 10_000);
      input.on("error", () => {});
      child.stderr.resume();
      child.once("error", () => {
        clearTimeout(timer);
        reject(new FileFailure("unavailable"));
      });
      child.stdout.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1024 * 1024 + 256) {
          child.kill("SIGKILL");
          return;
        }
        chunks.push(chunk);
        if (!before || !after) return;
        const output = Buffer.concat(chunks).toString();
        if (!sent && output.startsWith("READY\n")) {
          sent = true;
          input.write(
            Buffer.concat([
              Buffer.from(`${before.length}\n`),
              before,
              Buffer.from(`${after.length}\n`),
              after,
            ]),
          );
        }
        if (!committing && output.includes("\nPREPARED\n")) {
          committing = true;
          Promise.resolve()
            .then(prepared)
            .then(
              () => input.end("C"),
              (error: unknown) => {
                callbackFailure = error;
                input.end();
              },
            );
        }
      });
      child.once("close", (code) => {
        clearTimeout(timer);
        const output = Buffer.concat(chunks);
        if (callbackFailure) {
          reject(callbackFailure);
          return;
        }
        if (code !== 0) {
          const reason = /(?:^|\n)ERR ([a-z-]+)\n/.exec(output.toString())?.[1];
          reject(new FileFailure(reason ?? "commit-uncertain"));
        } else if (
          operation === "read" ||
          operation === "list" ||
          operation === "list-assets" ||
          operation === "read-css" ||
          operation === "read-audit-source" ||
          operation === "list-audit-sources" ||
          operation === "list-styles" ||
          operation === "prune-thumbnails" ||
          operation === "remove-thumbnail" ||
          operation === "read-thumbnail" ||
          output.toString() === "READY\nPREPARED\nOK\n"
        )
          resolve(output);
        else reject(new FileFailure("commit-uncertain"));
      });
    });
    this.active.add(job);
    job.then(
      () => this.active.delete(job),
      () => this.active.delete(job),
    );
    return job;
  }
}
