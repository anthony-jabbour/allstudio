/**
 * Development-only workspace adapter for the browser playground.
 *
 * It edits one approved copy of a fixture project on disk. It is deliberately
 * not the Electron filesystem implementation (Phase 2): there is no project
 * picker, no watcher, no checkpoints, and no general file API. It can only:
 *   - find the source element for a `data-oid`
 *   - preview or apply a static-text or static-className edit to it
 * inside `src/` of the approved root, for `.tsx`/`.jsx` files, after an
 * expected-content hash check.
 */
import { createHash, randomBytes } from "node:crypto";
import {
  lstat,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, sep } from "node:path";
import {
  type ClassEditRequest,
  type LocateElementResult,
  type SourceEditFailureReason,
  sourceEditFailure,
  type TextEditRequest,
  type TextEditResult,
} from "@allstudio/editor/site";
import {
  createLineDiff,
  type DescribeElementResult,
  describeElement,
  type ElementEditResult,
  editElementClassName,
  editElementText,
  formatLineDiff,
  listOids,
} from "@allstudio/editor/source-mapper";

const EDITABLE_EXTENSIONS = [".tsx", ".jsx"];
const SOURCE_DIRECTORY = "src";
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".next", ".git"]);
const MAX_PATH_LENGTH = 512;
const MAX_SOURCE_FILES = 500;
const MAX_FILE_BYTES = 1024 * 1024;

export type EditFunction = (
  content: string,
  edit: ElementEditRequest,
) => ElementEditResult;

export interface DevWorkspaceOptions {
  /** Test seam: replaces the source-mapper edit functions. */
  editElement?: EditFunction;
}

export type ResolvedPath =
  | { ok: true; relative: string; absolute: string }
  | { ok: false; reason: "path-rejected" | "file-not-found" };

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Lexical checks only; `DevWorkspace.resolve` adds filesystem checks. */
export function isAllowedRelativePath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0) {
    return false;
  }
  if (path.length > MAX_PATH_LENGTH || path.includes("\0")) {
    return false;
  }
  if (path.includes("\\") || isAbsolute(path) || /^[a-zA-Z]:/.test(path)) {
    return false;
  }
  const segments = path.split("/");
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    return false;
  }
  if (segments[0] !== SOURCE_DIRECTORY || segments.length < 2) {
    return false;
  }
  return EDITABLE_EXTENSIONS.some((extension) => path.endsWith(extension));
}

export class DevWorkspace {
  private readonly editElement: EditFunction;
  private readonly writeLocks = new Map<string, Promise<void>>();

  private constructor(
    readonly root: string,
    options: DevWorkspaceOptions,
  ) {
    this.editElement = options.editElement ?? defaultEditElement;
  }

  /** `rootDir` is canonicalized once; every later path must stay inside it. */
  static async open(
    rootDir: string,
    options: DevWorkspaceOptions = {},
  ): Promise<DevWorkspace> {
    const root = await realpath(rootDir);
    const stats = await lstat(root);
    if (!stats.isDirectory()) {
      throw new Error(`Workspace root is not a directory: ${rootDir}`);
    }
    return new DevWorkspace(root, options);
  }

  async resolve(path: unknown): Promise<ResolvedPath> {
    if (!isAllowedRelativePath(path)) {
      return { ok: false, reason: "path-rejected" };
    }
    const absolute = join(this.root, ...path.split("/"));
    let real: string;
    try {
      real = await realpath(absolute);
    } catch {
      return { ok: false, reason: "file-not-found" };
    }
    // Any symlink on the way (inside or outside the root) changes the real
    // path, so requiring equality rejects symlink escapes outright.
    if (real !== absolute || !real.startsWith(this.root + sep)) {
      return { ok: false, reason: "path-rejected" };
    }
    const stats = await lstat(real);
    if (!stats.isFile()) {
      return { ok: false, reason: "path-rejected" };
    }
    if (stats.size > MAX_FILE_BYTES) {
      return { ok: false, reason: "path-rejected" };
    }
    return { ok: true, relative: path, absolute: real };
  }

  /** Editable source files, as workspace-relative POSIX paths. */
  async listSourceFiles(): Promise<string[]> {
    const found: string[] = [];
    const walk = async (relativeDir: string): Promise<void> => {
      const entries = await readdir(
        join(this.root, ...relativeDir.split("/")),
        {
          withFileTypes: true,
        },
      ).catch(() => []);
      for (const entry of entries) {
        if (found.length >= MAX_SOURCE_FILES) {
          return;
        }
        // Dirent reports symlinks as symlinks, so they are never followed.
        const relative = `${relativeDir}/${entry.name}`;
        if (entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name)) {
          await walk(relative);
        } else if (entry.isFile() && isAllowedRelativePath(relative)) {
          found.push(relative);
        }
      }
    };
    await walk(SOURCE_DIRECTORY);
    return found.sort();
  }

  async locate(oid: string): Promise<LocateElementResult> {
    const matches: Array<Extract<LocateElementResult, { ok: true }>> = [];
    let ambiguous = false;
    for (const path of await this.listSourceFiles()) {
      const resolved = await this.resolve(path);
      if (!resolved.ok) {
        continue;
      }
      const content = await readFile(resolved.absolute, "utf8");
      if (!content.includes(oid)) {
        continue;
      }
      const described = describeElement(content, oid, { filename: path });
      if (!described.ok) {
        ambiguous ||= described.reason === "oid-ambiguous";
        continue;
      }
      matches.push({
        ok: true,
        element: {
          path,
          sha256: sha256(content),
          location: described.location,
          text: described.text,
          className: described.className,
        },
      });
    }
    // Oids are only unique per file; the same oid in two files is ambiguous.
    if (ambiguous || matches.length > 1) {
      return sourceEditFailure("oid-ambiguous");
    }
    return matches[0] ?? sourceEditFailure("oid-not-found");
  }

  previewTextEdit(request: TextEditRequest): Promise<TextEditResult> {
    return this.edit(request.path, toTextEdit(request), false);
  }

  applyTextEdit(request: TextEditRequest): Promise<TextEditResult> {
    return this.serialized(request.path, () =>
      this.edit(request.path, toTextEdit(request), true),
    );
  }

  previewClassEdit(request: ClassEditRequest): Promise<TextEditResult> {
    return this.edit(request.path, toClassEdit(request), false);
  }

  applyClassEdit(request: ClassEditRequest): Promise<TextEditResult> {
    return this.serialized(request.path, () =>
      this.edit(request.path, toClassEdit(request), true),
    );
  }

  /**
   * Applies run one at a time per file, and the hash check happens inside
   * that section, so two concurrent applies cannot both pass it and the
   * second one reports `stale-file` instead of overwriting the first.
   */
  private async serialized(
    path: string,
    run: () => Promise<TextEditResult>,
  ): Promise<TextEditResult> {
    const resolved = await this.resolve(path);
    if (!resolved.ok) {
      return sourceEditFailure(resolved.reason);
    }
    const key = resolved.absolute;
    const previous = this.writeLocks.get(key) ?? Promise.resolve();
    const result = previous.then(run);
    const settled = result.then(
      () => undefined,
      () => undefined,
    );
    this.writeLocks.set(key, settled);
    try {
      return await result;
    } finally {
      if (this.writeLocks.get(key) === settled) {
        this.writeLocks.delete(key);
      }
    }
  }

  private async edit(
    path: string,
    edit: ElementEditRequest,
    write: boolean,
  ): Promise<TextEditResult> {
    const resolved = await this.resolve(path);
    if (!resolved.ok) {
      return sourceEditFailure(resolved.reason);
    }
    const content = await readFile(resolved.absolute, "utf8");
    const currentSha = sha256(content);
    if (currentSha !== edit.expectedSha256) {
      return sourceEditFailure("stale-file");
    }

    const described = describeElement(content, edit.oid, {
      filename: resolved.relative,
    });
    if (!described.ok) {
      return sourceEditFailure(described.reason);
    }
    const current = edit.kind === "text" ? described.text : described.className;
    if (!current.ok) {
      return sourceEditFailure(current.reason);
    }
    const noop = {
      ok: true as const,
      written: false,
      noop: true,
      sha256: currentSha,
      diff: "",
    };
    if (renderedValue(described, edit.kind) === expectedValue(edit)) {
      return noop;
    }

    const patched = this.editElement(content, edit);
    if (!patched.ok) {
      return sourceEditFailure(patched.reason);
    }
    if (patched.generated === content) {
      return noop;
    }
    const failure = validatePatch(content, patched.generated, edit);
    if (failure) {
      return sourceEditFailure(failure);
    }

    const diff = formatLineDiff(
      createLineDiff(content, patched.generated),
      resolved.relative,
    );
    if (!write) {
      return {
        ok: true,
        written: false,
        noop: false,
        sha256: currentSha,
        diff,
      };
    }

    // Re-check right before the write to narrow the race with edits made
    // outside this adapter (applies through it are already serialized).
    const latest = await readFile(resolved.absolute, "utf8");
    if (sha256(latest) !== currentSha) {
      return sourceEditFailure("stale-file");
    }
    const written = await writeAtomically(resolved.absolute, patched.generated);
    if (!written) {
      return sourceEditFailure("write-failed");
    }
    return {
      ok: true,
      written: true,
      noop: false,
      sha256: sha256(patched.generated),
      diff,
    };
  }
}

export type ElementEditRequest =
  | { kind: "text"; oid: string; expectedSha256: string; text: string }
  | {
      kind: "className";
      oid: string;
      expectedSha256: string;
      className: string;
    };

function toTextEdit(request: TextEditRequest): ElementEditRequest {
  return {
    kind: "text",
    oid: request.oid,
    expectedSha256: request.expectedSha256,
    text: request.text,
  };
}

function toClassEdit(request: ClassEditRequest): ElementEditRequest {
  return {
    kind: "className",
    oid: request.oid,
    expectedSha256: request.expectedSha256,
    className: request.className,
  };
}

export function defaultEditElement(
  content: string,
  edit: ElementEditRequest,
): ElementEditResult {
  return edit.kind === "text"
    ? editElementText(content, edit.oid, edit.text)
    : editElementClassName(content, edit.oid, edit.className);
}

/** The static value the element has now, as the edit would express it. */
function renderedValue(
  described: Extract<DescribeElementResult, { ok: true }>,
  kind: ElementEditRequest["kind"],
): string | null | undefined {
  if (kind === "text") {
    return described.text.ok ? described.text.text : undefined;
  }
  return described.className.ok ? described.className.value : undefined;
}

function expectedValue(edit: ElementEditRequest): string | null {
  if (edit.kind === "text") {
    return edit.text;
  }
  return edit.className === "" ? null : edit.className;
}

/**
 * The patch must parse, keep the edited element addressable by the same oid,
 * hold the requested value, and keep every other oid in the file.
 */
function validatePatch(
  original: string,
  generated: string,
  edit: ElementEditRequest,
): SourceEditFailureReason | null {
  const described = describeElement(generated, edit.oid);
  if (!described.ok) {
    return "invalid-patch";
  }
  if (renderedValue(described, edit.kind) !== expectedValue(edit)) {
    return "invalid-patch";
  }
  // Compare JSX attributes from the AST, not a text scan, so edited text
  // that happens to contain `data-oid="…"` is not mistaken for an attribute.
  const before = listOids(original);
  const after = listOids(generated);
  if (
    !before ||
    !after ||
    [...before].sort().join("\n") !== [...after].sort().join("\n")
  ) {
    return "invalid-patch";
  }
  return null;
}

/** Temp file in the same directory, then rename, so readers never see a partial file. */
async function writeAtomically(
  target: string,
  content: string,
): Promise<boolean> {
  const temp = join(
    dirname(target),
    `.allstudio-${randomBytes(6).toString("hex")}.tmp`,
  );
  try {
    await writeFile(temp, content, { encoding: "utf8", flag: "wx" });
    await rename(temp, target);
    return true;
  } catch {
    await rm(temp, { force: true });
    return false;
  }
}
