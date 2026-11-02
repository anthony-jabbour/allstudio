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
import { constants } from "node:fs";
import {
  chmod,
  lstat,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, sep } from "node:path";
import {
  type AssetEditRequest,
  assetFromMetadata,
  assetUrl,
  type ClassEditRequest,
  discoverAppRouterRoutes,
  isEditBreakpoint,
  isUsableAsset,
  type LocateElementResult,
  MAX_ASSET_FILES,
  type ProjectRoutesSnapshot,
  type ReorderEditRequest,
  type ReorderReceipt,
  type ResponsiveCapabilities,
  readResponsiveMetadata,
  resolvePreviewRouteUrl,
  type SelectRouteResult,
  type SourceEditFailureReason,
  type SourceEditWorkspace,
  sourceEditFailure,
  type TextEditRequest,
  type TextEditResult,
} from "@allstudio/editor/site";
import {
  createLineDiff,
  type DescribeElementResult,
  describeElement,
  describeImageSource,
  type ElementEditResult,
  editElementClassName,
  editElementImageSource,
  editElementText,
  formatLineDiff,
  inspectSiblingReorder,
  listOids,
  reorderSibling,
  validateResponsiveProject,
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
  /** Base preview URL for resolving discovered static routes. */
  previewUrl?: string;
}

export type ResolvedPath =
  | { ok: true; relative: string; absolute: string }
  | { ok: false; reason: "path-rejected" | "file-not-found" };

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Lexical checks only; `DevWorkspace.resolve` adds filesystem checks. */
export function isAllowedRelativePath(
  path: unknown,
  style = false,
): path is string {
  if (typeof path !== "string" || path.length === 0) {
    return false;
  }
  if (path.length > (style ? 1024 : MAX_PATH_LENGTH) || path.includes("\0")) {
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
  return style
    ? /\.css$/i.test(path)
    : EDITABLE_EXTENSIONS.some((extension) => path.endsWith(extension));
}

export class DevWorkspace implements SourceEditWorkspace {
  private readonly editElement: EditFunction;
  private readonly previewUrl: string;
  private readonly writeLocks = new Map<string, Promise<void>>();

  private constructor(
    readonly root: string,
    options: DevWorkspaceOptions,
  ) {
    this.editElement = options.editElement ?? defaultEditElement;
    this.previewUrl = options.previewUrl ?? "http://localhost:3101";
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

  async resolve(path: unknown, style = false): Promise<ResolvedPath> {
    if (!isAllowedRelativePath(path, style)) {
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
    if (!stats.isFile() || (style && stats.nlink !== 1)) {
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

  async discoverRoutes(): Promise<ProjectRoutesSnapshot> {
    return discoverAppRouterRoutes(await this.listSourceFiles());
  }

  async selectRoute(routeInput: unknown): Promise<SelectRouteResult> {
    const snapshot = await this.discoverRoutes();
    const resolved = resolvePreviewRouteUrl(
      this.previewUrl,
      routeInput,
      snapshot,
    );
    if (!resolved.ok) {
      return resolved;
    }
    return {
      ...resolved,
      routes: snapshot.routes,
      unsupportedRoutes: snapshot.unsupported,
    };
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
          image: describeImageSource(content, oid),
          reorder: (await this.discoverRoutes()).routes.some(
            (route) => route.sourcePath === path,
          )
            ? inspectSiblingReorder(content, oid)
            : { ok: false, reason: "unsupported-reorder" },
        },
      });
    }
    // Oids are only unique per file; the same oid in two files is ambiguous.
    if (ambiguous || matches.length > 1) {
      return sourceEditFailure("oid-ambiguous");
    }
    return matches[0] ?? sourceEditFailure("oid-not-found");
  }

  previewReorder(request: ReorderEditRequest): Promise<TextEditResult> {
    return this.edit(request.path, { ...request, kind: "reorder" }, false);
  }
  async listAssets() {
    const found: NonNullable<ReturnType<typeof assetFromMetadata>>[] = [];
    const root = join(this.root, "public");
    const rootStat = await lstat(root).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!rootStat) return found;
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink())
      throw new Error("Asset root is not a project directory");
    let visited = 0;
    const directories: Array<{
      path: string;
      dev: bigint;
      ino: bigint;
      ctimeNs: bigint;
    }> = [];
    const scan = async (
      directory: string,
      prefix: string,
      depth: number,
    ): Promise<void> => {
      if (depth > 32) throw new Error("Asset scan depth exceeded");
      const before = await lstat(directory, { bigint: true });
      if (!before.isDirectory() || before.isSymbolicLink())
        throw new Error("Asset directory changed during scan");
      // ctime catches a directory swapped out and restored during an awaited lookup.
      directories.push({
        path: directory,
        dev: before.dev,
        ino: before.ino,
        ctimeNs: before.ctimeNs,
      });
      const names = await readdir(directory);
      const after = await lstat(directory, { bigint: true });
      if (
        !after.isDirectory() ||
        after.isSymbolicLink() ||
        after.dev !== before.dev ||
        after.ino !== before.ino ||
        after.ctimeNs !== before.ctimeNs
      )
        throw new Error("Asset directory changed during scan");
      for (const name of names) {
        if (++visited > 10000) throw new Error("Asset scan limit exceeded");
        const relative = prefix ? `${prefix}/${name}` : name;
        if (Buffer.byteLength(`public/${relative}`) > 1024)
          throw new Error("Asset path too long");
        const absolute = join(directory, name);
        const stat = await lstat(absolute);
        if (stat.isSymbolicLink()) throw new Error("Asset path is a link");
        if (stat.isDirectory()) await scan(absolute, relative, depth + 1);
        else if (/\.(svg|png|jpe?g|webp|gif|avif)$/i.test(name)) {
          if (!stat.isFile() || stat.nlink !== 1)
            throw new Error("Asset path is unsafe");
          const asset = assetFromMetadata(`public/${relative}`, stat.size);
          if (!asset || found.length >= MAX_ASSET_FILES)
            throw new Error("Asset metadata is unsafe");
          found.push(asset);
        }
      }
    };
    await scan(root, "", 0);
    for (const expected of directories) {
      const current = await lstat(expected.path, { bigint: true });
      if (
        !current.isDirectory() ||
        current.isSymbolicLink() ||
        current.dev !== expected.dev ||
        current.ino !== expected.ino ||
        current.ctimeNs !== expected.ctimeNs
      )
        throw new Error("Asset directory changed during scan");
    }
    return found.sort((a, b) => a.path.localeCompare(b.path));
  }
  previewAssetEdit(request: AssetEditRequest): Promise<TextEditResult> {
    return this.edit(request.path, { ...request, kind: "asset" }, false);
  }
  applyAssetEdit(request: AssetEditRequest): Promise<TextEditResult> {
    return this.serialized(request.path, () =>
      this.edit(request.path, { ...request, kind: "asset" }, true),
    );
  }
  applyReorder(request: ReorderEditRequest): Promise<TextEditResult> {
    return this.serialized(request.path, () =>
      this.edit(request.path, { ...request, kind: "reorder" }, true),
    );
  }
  previewTextEdit(request: TextEditRequest): Promise<TextEditResult> {
    return this.edit(request.path, toTextEdit(request), false);
  }

  applyTextEdit(request: TextEditRequest): Promise<TextEditResult> {
    return this.serialized(request.path, () =>
      this.edit(request.path, toTextEdit(request), true),
    );
  }

  async getResponsiveCapabilities(): Promise<ResponsiveCapabilities> {
    const readBounded = async (
      relative: string,
      metadata = false,
    ): Promise<Uint8Array | null> => {
      const absolute = join(this.root, relative);
      try {
        if (metadata) {
          if ((await realpath(absolute)) !== absolute)
            throw new Error("Symlink metadata");
        } else {
          const resolved = await this.resolve(relative, true);
          if (!resolved.ok) throw new Error("Unsafe CSS");
        }
        const file = await open(
          absolute,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        try {
          const before = await file.stat();
          if (
            !before.isFile() ||
            before.nlink !== 1 ||
            before.size > MAX_FILE_BYTES
          )
            throw new Error("Unsafe metadata");
          const bytes = Buffer.alloc(before.size + 1);
          let count = 0;
          while (count < bytes.length) {
            const { bytesRead } = await file.read(
              bytes,
              count,
              bytes.length - count,
              count,
            );
            if (!bytesRead) break;
            count += bytesRead;
          }
          const after = await file.stat();
          if (
            count !== before.size ||
            after.size !== before.size ||
            after.nlink !== 1 ||
            after.mtimeMs !== before.mtimeMs
          )
            throw new Error("Metadata changed");
          return bytes.subarray(0, count);
        } finally {
          await file.close();
        }
      } catch (error) {
        if (metadata && (error as NodeJS.ErrnoException).code === "ENOENT")
          return null;
        throw error;
      }
    };
    const listMetadata = async (sources = false) => {
      const paths: string[] = [];
      let entries = 0;
      const walk = async (relative: string, depth: number): Promise<void> => {
        const absolute = join(this.root, relative);
        if (depth > 32 || (await realpath(absolute)) !== absolute)
          throw new Error("Unsafe directory");
        for (const entry of await readdir(absolute, {
          withFileTypes: true,
        })) {
          if (++entries > 10000) throw new Error("Style entry limit");
          const path = relative ? `${relative}/${entry.name}` : entry.name;
          if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
          if (entry.isSymbolicLink()) throw new Error("Symlink in styles");
          if (entry.isDirectory()) {
            if (!SKIPPED_DIRECTORIES.has(entry.name))
              await walk(path, depth + 1);
          } else if (
            sources
              ? /\.(tsx|jsx|ts|js|mjs|cjs)$/.test(entry.name)
              : /\.(css|scss|sass|less|pcss|postcss|styl|stylus)$/i.test(
                  entry.name,
                ) ||
                /^(?:postcss\.config\.|\.postcssrc|tailwind\.config\.|babel\.config\.|\.babelrc|\.swcrc$)/.test(
                  entry.name,
                )
          ) {
            const info = await lstat(join(this.root, path));
            if (
              !info.isFile() ||
              info.nlink !== 1 ||
              info.size > MAX_FILE_BYTES ||
              path.length > 1024 ||
              paths.length >= 1000
            )
              throw new Error("Unsafe style");
            paths.push(path);
          }
        }
      };
      await walk(sources ? "src" : "", 0);
      return paths.sort();
    };
    return readResponsiveMetadata({
      listStyles: () => listMetadata(),
      validateProject: (styles) =>
        validateResponsiveProject(
          {
            listSources: () => listMetadata(true),
            readSource: async (path) => {
              const value = await readBounded(path, true);
              if (!value) throw new Error("Missing module");
              return value;
            },
            readConfig: (path) => readBounded(path, true),
          },
          styles,
        ),
      readRootMetadata: (path) => readBounded(path, true),
      readCss: async (path) => {
        const bytes = await readBounded(path);
        if (!bytes) throw new Error("Missing CSS");
        return bytes;
      },
    });
  }

  private async editScopedClass(
    request: ClassEditRequest,
    apply: boolean,
  ): Promise<TextEditResult> {
    if (!isAllowedRelativePath(request.path))
      return sourceEditFailure("path-rejected");
    if (request.breakpoint !== undefined) {
      if (!isEditBreakpoint(request.breakpoint))
        return sourceEditFailure("invalid-request");
      if (
        request.breakpoint !== "base" &&
        (await this.getResponsiveCapabilities()).status !== "supported-defaults"
      )
        return sourceEditFailure("unsupported-breakpoints");
    }
    return this.edit(request.path, toClassEdit(request), apply);
  }

  previewClassEdit(request: ClassEditRequest): Promise<TextEditResult> {
    return this.editScopedClass(request, false);
  }

  applyClassEdit(request: ClassEditRequest): Promise<TextEditResult> {
    return this.serialized(request.path, () =>
      this.editScopedClass(request, true),
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
    // Join the per-file queue synchronously, before any await, so applies
    // run in call order. A lexically allowed path has no `.`/`..`/empty
    // segments, so it names one file and can key the queue directly; `run`
    // still resolves and checks it on the filesystem.
    if (!isAllowedRelativePath(path)) {
      return sourceEditFailure("path-rejected");
    }
    const previous = this.writeLocks.get(path) ?? Promise.resolve();
    const result = previous.then(run);
    const settled = result.then(
      () => undefined,
      () => undefined,
    );
    this.writeLocks.set(path, settled);
    try {
      return await result;
    } finally {
      if (this.writeLocks.get(path) === settled) {
        this.writeLocks.delete(path);
      }
    }
  }

  private async edit(
    path: string,
    edit:
      | ElementEditRequest
      | (ReorderEditRequest & { kind: "reorder" })
      | (AssetEditRequest & { kind: "asset" }),
    write: boolean,
  ): Promise<TextEditResult> {
    const resolved = await this.resolve(path);
    if (!resolved.ok) {
      return sourceEditFailure(resolved.reason);
    }
    const bytes = await readFile(resolved.absolute);
    const content = bytes.toString("utf8");
    // Invalid UTF-8 would be replaced by U+FFFD everywhere on write, outside
    // the edited element too; refuse instead.
    if (!Buffer.from(content, "utf8").equals(bytes)) {
      return sourceEditFailure("unsupported-encoding");
    }
    const currentSha = sha256(content);
    if (currentSha !== edit.expectedSha256) {
      return sourceEditFailure("stale-file");
    }

    const noop = {
      ok: true as const,
      written: false,
      noop: true,
      sha256: currentSha,
      diff: "",
    };
    let generated: string;
    let reorder: ReorderReceipt | undefined;
    if (edit.kind === "asset") {
      const url = assetUrl(edit.assetPath);
      if (
        !url ||
        !(await this.listAssets()).some(
          (asset) => asset.path === edit.assetPath && isUsableAsset(asset),
        )
      )
        return sourceEditFailure("path-rejected");
      const current = describeImageSource(content, edit.oid);
      if (!current.ok) return sourceEditFailure(current.reason);
      if (current.src === url) return noop;
      const patched = editElementImageSource(content, edit.oid, url);
      if (!patched.ok) return sourceEditFailure(patched.reason);
      const check = describeImageSource(patched.generated, edit.oid);
      if (
        !check.ok ||
        check.src !== url ||
        JSON.stringify(listOids(content)?.sort()) !==
          JSON.stringify(listOids(patched.generated)?.sort())
      )
        return sourceEditFailure("invalid-patch");
      generated = patched.generated;
    } else if (edit.kind === "reorder") {
      if (
        !(await this.discoverRoutes()).routes.some(
          (route) => route.sourcePath === path,
        )
      )
        return sourceEditFailure("unsupported-reorder");
      const result = reorderSibling(
        content,
        edit.oid,
        edit.siblingOid,
        edit.direction,
      );
      if (!result.ok) return sourceEditFailure(result.reason);
      generated = result.generated;
      reorder = {
        oid: edit.oid,
        siblingOid: edit.siblingOid,
        direction: edit.direction,
      };
    } else {
      const described = describeElement(content, edit.oid, {
        filename: resolved.relative,
      });
      if (!described.ok) {
        return sourceEditFailure(described.reason);
      }
      const current =
        edit.kind === "text" ? described.text : described.className;
      if (!current.ok) {
        return sourceEditFailure(current.reason);
      }
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

      generated = patched.generated;
    }
    const diff = formatLineDiff(
      createLineDiff(content, generated),
      resolved.relative,
    );
    if (!write) {
      return {
        ok: true,
        written: false,
        noop: false,
        sha256: currentSha,
        diff,
        ...(edit.kind === "asset" ? { oid: edit.oid } : {}),
        ...(reorder ? { oid: edit.oid, reorder } : {}),
      };
    }

    // Re-check right before the write to narrow the race with edits made
    // outside this adapter (applies through it are already serialized).
    const latest = await readFile(resolved.absolute, "utf8");
    if (sha256(latest) !== currentSha) {
      return sourceEditFailure("stale-file");
    }
    // Rename replaces the inode, which would silently break a hard link.
    const before = await lstat(resolved.absolute);
    if (before.nlink > 1) {
      return sourceEditFailure("path-rejected");
    }
    const written = await writeAtomically(
      resolved.absolute,
      generated,
      before.mode & 0o7777,
      // A directory swapped for a symlink since `resolve` must not redirect
      // the rename.
      async () => {
        const again = await this.resolve(path);
        return again.ok && again.absolute === resolved.absolute;
      },
    );
    if (written !== "written") {
      return sourceEditFailure(
        written === "moved" ? "path-rejected" : "write-failed",
      );
    }
    return {
      ok: true,
      written: true,
      noop: false,
      sha256: sha256(generated),
      diff,
      ...(edit.kind === "asset" ? { oid: edit.oid } : {}),
      ...(reorder ? { oid: edit.oid, reorder } : {}),
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

/**
 * Temp file in the same directory, then rename, so readers never see a partial
 * file. The temp file gets the original permission bits; `unchanged` runs right
 * before the rename and aborts the write when the path no longer resolves.
 *
 * Cleanup removes the temp file by path. If a directory on that path was moved
 * away mid-write, the temp file moves with it and cannot be found again by
 * path; it is left there as a dot-prefixed `.tmp` file, and the target is never
 * written. Directory-handle-relative cleanup belongs to the Phase 2 native file
 * adapter.
 */
async function writeAtomically(
  target: string,
  content: string,
  mode: number,
  unchanged: () => Promise<boolean>,
): Promise<"written" | "moved" | "failed"> {
  const temp = join(
    dirname(target),
    `.allstudio-${randomBytes(6).toString("hex")}.tmp`,
  );
  try {
    await writeFile(temp, content, { encoding: "utf8", flag: "wx", mode });
    // `mode` above is subject to the umask; chmod is not.
    await chmod(temp, mode);
    if (!(await unchanged())) {
      await rm(temp, { force: true });
      return "moved";
    }
    await rename(temp, target);
    return "written";
  } catch {
    await rm(temp, { force: true });
    return "failed";
  }
}
