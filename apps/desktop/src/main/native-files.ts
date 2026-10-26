import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { type FileHandle, open, realpath } from "node:fs/promises";

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
    const result = await this.run("read", path);
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
    const output = await this.run("list", "src");
    if (output.subarray(0, 3).toString() !== "OK\n")
      throw new FileFailure("read-failed");
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
