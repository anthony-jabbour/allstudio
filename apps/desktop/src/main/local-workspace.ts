import { createHash } from "node:crypto";
import { type FSWatcher, watch } from "node:fs";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  type ClassEditRequest,
  discoverAppRouterRoutes,
  isEditBreakpoint,
  type LocateElementResult,
  type ProjectRoutesSnapshot,
  type ResponsiveCapabilities,
  readResponsiveMetadata,
  resolvePreviewRouteUrl,
  type SelectRouteResult,
  type SourceEditFailure,
  type SourceEditFailureReason,
  type SourceEditWorkspace,
  sourceEditFailure,
  type TextEditRequest,
  type TextEditResult,
} from "@allstudio/editor/site";
import {
  createLineDiff,
  describeElement,
  editElementClassName,
  editElementText,
  formatLineDiff,
  listOids,
  type SourceLocation,
} from "@allstudio/editor/source-mapper";
import { durableJson, syncDirectory } from "./durable-json.ts";
import { FileFailure, NativeFiles } from "./native-files.ts";
import {
  type PreviewSource,
  preparePreviewSource,
  stripPreviewOids,
} from "./preview-source.ts";

export function hash(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
export function isSourcePath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.length <= 1024 &&
    path.startsWith("src/") &&
    /\.(tsx|jsx)$/.test(path) &&
    !/[\\:\0]/.test(path) &&
    path.split("/").every((part) => part && part !== "." && part !== "..")
  );
}
export function textOf(bytes: Buffer): string {
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes))
    throw new FileFailure("unsupported-encoding");
  return text;
}

function failure(error: unknown): SourceEditFailure {
  if (error instanceof FileFailure) {
    if (error.reason === "commit-uncertain")
      return {
        ok: false,
        reason: "write-failed",
        message:
          "The save could not be confirmed. Recovery data was kept. Reopen this project to review it.",
      };
    if (
      [
        "path-rejected",
        "file-not-found",
        "stale-file",
        "write-failed",
        "unsupported-encoding",
        "unavailable",
      ].includes(error.reason)
    )
      return sourceEditFailure(error.reason as SourceEditFailureReason);
  }
  return {
    ok: false,
    reason: "internal-error",
    message:
      "The local operation failed. Nothing else was overwritten; recovery data was retained if a save had started.",
  };
}
interface SaveRecord {
  schema: 1;
  path: string;
  before: string;
  after: string;
}
interface History {
  path: string;
  before: Buffer;
  after: Buffer;
}

export class LocalWorkspace implements SourceEditWorkspace {
  readonly root: string;
  private tail: Promise<unknown> = Promise.resolve();
  private closing = false;
  private watcher?: FSWatcher;
  private known = new Map<string, string>();
  private undoStack: History[] = [];
  private redoStack: History[] = [];
  private constructor(
    readonly files: NativeFiles,
    private journal: string,
  ) {
    this.root = files.root;
  }

  static async open(root: string, binary: string, recoveryDirectory: string) {
    const files = await NativeFiles.open(root, binary);
    const journal = join(recoveryDirectory, hash(files.root));
    try {
      await mkdir(journal, { recursive: true, mode: 0o700 });
      return new LocalWorkspace(files, journal);
    } catch (error) {
      await files.close();
      throw error;
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    if (this.closing || this.paused)
      return Promise.reject(new FileFailure("unavailable"));
    // Join before any await: workspace-wide serialization also preserves per-file call order and history.
    const result = this.tail.then(task);
    this.tail = result.catch(() => {});
    return result;
  }
  private paused = false;
  pauseWrites() {
    this.paused = true;
    return this.tail;
  }
  resumeWrites() {
    this.paused = false;
  }
  private journalPath(path: string) {
    return join(this.journal, `${hash(path)}.json`);
  }
  private async clearRecord(path: string) {
    await rm(this.journalPath(path), { force: true });
    await syncDirectory(this.journal);
  }
  private async save(path: string, before: Buffer, after: Buffer) {
    await durableJson(this.journalPath(path), {
      schema: 1,
      path,
      before: before.toString("base64"),
      after: after.toString("base64"),
    } satisfies SaveRecord);
    this.known.set(path, hash(after));
    await this.files.write(path, before, after);
    await this.clearRecord(path);
  }

  async pending(): Promise<SaveRecord[]> {
    const records: SaveRecord[] = [];
    const names = await readdir(this.journal);
    if (names.length > 1000) throw new Error("Recovery limit exceeded");
    for (const name of names) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
      const content = await readFile(join(this.journal, name));
      if (content.length > 3 * 1024 * 1024)
        throw new Error("Recovery record too large");
      const record = JSON.parse(textOf(content)) as SaveRecord;
      if (
        record.schema !== 1 ||
        !isSourcePath(record.path) ||
        name !== `${hash(record.path)}.json` ||
        typeof record.before !== "string" ||
        typeof record.after !== "string"
      )
        throw new Error("Invalid recovery record");
      for (const encoded of [record.before, record.after]) {
        const bytes = Buffer.from(encoded, "base64");
        if (bytes.length > 1024 * 1024 || bytes.toString("base64") !== encoded)
          throw new Error("Invalid recovery bytes");
        textOf(bytes);
      }
      records.push(record);
    }
    return records;
  }

  recover(choice: "restore" | "keep"): Promise<TextEditResult> {
    return this.enqueue(async () => {
      try {
        for (const record of await this.pending()) {
          if (choice === "keep") {
            await this.clearRecord(record.path);
            continue;
          }
          const before = Buffer.from(record.before, "base64");
          const after = Buffer.from(record.after, "base64");
          const current = (await this.files.read(record.path)).bytes;
          if (current.equals(after)) {
            await this.clearRecord(record.path);
            continue;
          }
          if (!current.equals(before)) return sourceEditFailure("stale-file");
          if (!listOids(textOf(after)))
            return sourceEditFailure("invalid-patch");
          await this.files.write(record.path, before, after);
          await this.clearRecord(record.path);
        }
        return { ok: true, written: true, noop: false, sha256: "", diff: "" };
      } catch (error) {
        return failure(error);
      }
    });
  }

  watch(onChange: (message: string) => void) {
    this.watcher?.close();
    this.watcher = watch(
      join(this.root, "src"),
      { recursive: true },
      (_event, filename) => {
        const path = filename ? `src/${filename.toString()}` : null;
        if (path && !isSourcePath(path)) return;
        void (async () => {
          try {
            if (path) {
              const current = hash((await this.files.read(path)).bytes);
              if (this.known.get(path) === current) return;
              this.known.set(path, current);
            }
            onChange(
              "Project files changed. Reselect an affected element before saving.",
            );
          } catch {
            if (!this.closing)
              onChange(
                "A source file changed or became unavailable. Reselect before saving.",
              );
          }
        })();
      },
    );
    this.watcher.on("error", () =>
      onChange("File watching stopped. Reopen the project before editing."),
    );
  }

  async discoverRoutes(): Promise<ProjectRoutesSnapshot> {
    const paths = (await this.files.list()).filter(isSourcePath);
    return discoverAppRouterRoutes(paths);
  }

  async getResponsiveCapabilities(): Promise<ResponsiveCapabilities> {
    return readResponsiveMetadata({
      listStyles: () => this.files.listStyles(),
      readCss: async (path) => (await this.files.readCss(path)).bytes,
      readRootMetadata: async (path) => {
        try {
          return (await this.files.read(path)).bytes;
        } catch (error) {
          if (error instanceof FileFailure && error.reason === "file-not-found")
            return null;
          throw error;
        }
      },
    });
  }

  async selectRoute(
    basePreviewUrl: string,
    routeInput?: unknown,
  ): Promise<SelectRouteResult> {
    try {
      const snapshot = await this.discoverRoutes();
      const resolved = resolvePreviewRouteUrl(
        basePreviewUrl,
        routeInput,
        snapshot,
      );
      if (!resolved.ok) return resolved;
      return {
        ...resolved,
        routes: snapshot.routes,
        unsupportedRoutes: snapshot.unsupported,
      };
    } catch (error) {
      return failure(error);
    }
  }

  async locate(oid: string): Promise<LocateElementResult> {
    try {
      const matches: Array<Extract<LocateElementResult, { ok: true }>> = [];
      let ambiguous = false;
      for (const path of await this.files.list()) {
        if (!isSourcePath(path)) continue;
        try {
          const bytes = (await this.files.read(path)).bytes;
          const source = textOf(bytes);
          const original = listOids(source);
          if (
            original &&
            original.filter((value) => value === oid).length > 1
          ) {
            ambiguous = true;
            continue;
          }
          const preview = preparePreviewSource(join(this.root, path), source);
          const described = describeElement(preview.content, oid, {
            filename: path,
          });
          if (!described.ok) {
            ambiguous ||= described.reason === "oid-ambiguous";
            continue;
          }
          this.known.set(path, hash(bytes));
          matches.push({
            ok: true,
            element: {
              path,
              sha256: hash(bytes),
              location: originalLocation(described.location, preview),
              text: described.text,
              className: described.className,
            },
          });
        } catch {
          /* Unsupported or concurrently changed source is not guessed. */
        }
      }
      return ambiguous || matches.length > 1
        ? sourceEditFailure("oid-ambiguous")
        : (matches[0] ??
            sourceEditFailure(
              /^p:[a-f0-9]{32}$/.test(oid) ? "stale-file" : "oid-not-found",
            ));
    } catch (error) {
      return failure(error);
    }
  }

  previewTextEdit(request: TextEditRequest) {
    return this.edit(request, "text", false);
  }
  previewClassEdit(request: ClassEditRequest) {
    return this.edit(request, "className", false);
  }
  applyTextEdit(request: TextEditRequest) {
    return this.enqueue(() => this.edit(request, "text", true));
  }
  applyClassEdit(request: ClassEditRequest) {
    return this.enqueue(() => this.edit(request, "className", true));
  }

  private async edit(
    request: TextEditRequest | ClassEditRequest,
    field: "text" | "className",
    write: boolean,
  ): Promise<TextEditResult> {
    if (!isSourcePath(request.path)) return sourceEditFailure("path-rejected");
    try {
      if (
        field === "className" &&
        (request as ClassEditRequest).breakpoint !== undefined
      ) {
        const breakpoint = (request as ClassEditRequest).breakpoint;
        if (!isEditBreakpoint(breakpoint))
          return sourceEditFailure("invalid-request");
        if (
          breakpoint !== "base" &&
          (await this.getResponsiveCapabilities()).status !==
            "supported-defaults"
        )
          return sourceEditFailure("unsupported-breakpoints");
      }
      const before = (await this.files.read(request.path)).bytes;
      const source = textOf(before);
      if (hash(before) !== request.expectedSha256)
        return sourceEditFailure("stale-file");
      const preview = preparePreviewSource(
        join(this.root, request.path),
        source,
      );
      const value =
        field === "text"
          ? (request as TextEditRequest).text
          : (request as ClassEditRequest).className;
      const described = describeElement(preview.content, request.oid);
      if (!described.ok) return sourceEditFailure(described.reason);
      const current = field === "text" ? described.text : described.className;
      if (!current.ok) return sourceEditFailure(current.reason);
      const currentValue =
        field === "text" && described.text.ok
          ? described.text.text
          : described.className.ok
            ? (described.className.value ?? "")
            : null;
      const noop = {
        ok: true as const,
        written: false,
        noop: true,
        sha256: hash(before),
        diff: "",
      };
      if (currentValue === value) return noop;
      const patched =
        field === "text"
          ? editElementText(preview.content, request.oid, value)
          : editElementClassName(preview.content, request.oid, value);
      if (!patched.ok) return sourceEditFailure(patched.reason);
      const check = describeElement(patched.generated, request.oid);
      const readBack = check.ok
        ? field === "text" && check.text.ok
          ? check.text.text
          : check.className.ok
            ? (check.className.value ?? "")
            : null
        : null;
      if (
        readBack !== value ||
        JSON.stringify(listOids(preview.content)?.sort()) !==
          JSON.stringify(listOids(patched.generated)?.sort())
      )
        return sourceEditFailure("invalid-patch");
      const generated = stripPreviewOids(patched.generated, preview);
      if (!listOids(generated)) return sourceEditFailure("invalid-patch");
      if (generated === source) return noop;
      const after = Buffer.from(generated);
      if (after.length > 1024 * 1024) return sourceEditFailure("invalid-patch");
      const next = preparePreviewSource(
        join(this.root, request.path),
        generated,
      );
      const ordinal = preview.injectedOids.indexOf(request.oid);
      const nextOid = next.injectedOids[ordinal];
      if (!nextOid || next.injectedOids.length !== preview.injectedOids.length)
        return sourceEditFailure("invalid-patch");
      const diff = formatLineDiff(
        createLineDiff(source, generated),
        request.path,
      );
      if (write) {
        if ((await this.pending()).length)
          return {
            ok: false,
            reason: "write-failed",
            message:
              "An interrupted save needs review. Reopen this project before editing.",
          };
        await this.save(request.path, before, after);
        this.undoStack.push({ path: request.path, before, after });
        if (this.undoStack.length > 100) this.undoStack.shift();
        this.redoStack = [];
      }
      return {
        ok: true,
        written: write,
        noop: false,
        sha256: write ? hash(after) : hash(before),
        oid: write ? nextOid : request.oid,
        diff,
      };
    } catch (error) {
      return failure(error);
    }
  }

  undo() {
    return this.history(false);
  }
  redo() {
    return this.history(true);
  }
  private history(redo: boolean): Promise<TextEditResult> {
    return this.enqueue(async () => {
      const from = redo ? this.redoStack : this.undoStack;
      const to = redo ? this.undoStack : this.redoStack;
      const item = from.at(-1);
      if (!item)
        return { ok: true, written: false, noop: true, sha256: "", diff: "" };
      try {
        if ((await this.pending()).length)
          return sourceEditFailure("stale-file");
        const before = redo ? item.before : item.after;
        const after = redo ? item.after : item.before;
        if (!(await this.files.read(item.path)).bytes.equals(before))
          return sourceEditFailure("stale-file");
        await this.save(item.path, before, after);
        from.pop();
        to.push(item);
        return {
          ok: true,
          written: true,
          noop: false,
          sha256: hash(after),
          diff: formatLineDiff(
            createLineDiff(textOf(before), textOf(after)),
            item.path,
          ),
        };
      } catch (error) {
        return failure(error);
      }
    });
  }

  async close() {
    this.closing = true;
    this.watcher?.close();
    await this.tail;
    await this.files.close();
  }
}

function originalLocation(
  location: SourceLocation,
  preview: PreviewSource,
): SourceLocation {
  const lines = preview.content.split("\n");
  function point(position: { line: number; column: number }) {
    let prefix = [
      ...lines.slice(0, position.line - 1),
      lines[position.line - 1]?.slice(0, position.column) ?? "",
    ].join("\n");
    for (const attribute of preview.attributes)
      prefix = prefix.replace(attribute.virtual, () => attribute.original);
    const originalLines = prefix.split("\n");
    return {
      line: originalLines.length,
      column: originalLines.at(-1)?.length ?? 0,
    };
  }
  return {
    ...location,
    start: point(location.start),
    end: point(location.end),
  };
}
