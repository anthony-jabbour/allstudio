export type ResponsiveCapabilities =
  | { status: "supported-defaults" }
  | {
      status: "unsupported";
      reason: "version" | "config" | "styles" | "limits";
    }
  | { status: "unavailable"; reason: "read-failed" };

export const MAX_STYLE_FILES = 1000;
export const MAX_STYLE_FILE_BYTES = 1024 * 1024;
export const MAX_STYLE_TOTAL_BYTES = 4 * 1024 * 1024;
export interface BreakpointAuditInput {
  packageJson: string;
  configs: readonly string[];
  styles: ReadonlyArray<{ path: string; text: string }>;
}
export type ResponsiveRootMetadata =
  | "package.json"
  | "tailwind.config.ts"
  | "tailwind.config.js"
  | "tailwind.config.cjs";
export interface ResponsiveMetadataReader {
  listStyles(): Promise<string[]>;
  readCss(path: string): Promise<Uint8Array>;
  readRootMetadata(path: ResponsiveRootMetadata): Promise<Uint8Array | null>;
}

export async function readResponsiveMetadata(
  reader: ResponsiveMetadataReader,
): Promise<ResponsiveCapabilities> {
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const pkg = await reader.readRootMetadata("package.json");
    if (!pkg) return { status: "unsupported", reason: "version" };
    if (pkg.byteLength > MAX_STYLE_FILE_BYTES)
      return { status: "unsupported", reason: "limits" };
    const configs: string[] = [];
    for (const name of [
      "tailwind.config.ts",
      "tailwind.config.js",
      "tailwind.config.cjs",
    ] as const) {
      if (await reader.readRootMetadata(name)) configs.push(name);
    }
    if (configs.length) return { status: "unsupported", reason: "config" };
    const paths = await reader.listStyles();
    if (paths.length > MAX_STYLE_FILES)
      return { status: "unsupported", reason: "limits" };
    const styles: Array<{ path: string; text: string }> = [];
    let total = 0;
    for (const path of paths) {
      if (!stylePath(path)) return { status: "unsupported", reason: "styles" };
      const bytes = await reader.readCss(path);
      total += bytes.byteLength;
      if (
        bytes.byteLength > MAX_STYLE_FILE_BYTES ||
        total > MAX_STYLE_TOTAL_BYTES
      )
        return { status: "unsupported", reason: "limits" };
      styles.push({ path, text: decoder.decode(bytes) });
    }
    return auditDefaultBreakpoints({
      packageJson: decoder.decode(pkg),
      configs,
      styles,
    });
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}
const encoder = new TextEncoder();
function stylePath(path: string): boolean {
  return (
    path.length <= 1024 &&
    path.startsWith("src/") &&
    /\.css$/i.test(path) &&
    !/[\\:%?#]/.test(path) &&
    !Array.from(path).some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    ) &&
    path
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}

/** Ignore comments/strings, but refuse syntax that could redefine an unproven variant. */
function inspectCss(
  css: string,
): { imports: string[]; visible: string } | null {
  const chunks: string[] = [],
    imports: string[] = [];
  let i = 0,
    start = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === "\\" || ch === "\0") return null;
    if (css.startsWith("/*", i)) {
      chunks.push(css.slice(start, i), " ");
      const end = css.indexOf("*/", i + 2);
      if (end < 0) return null;
      i = end + 2;
      start = i;
      continue;
    }
    if (css.startsWith("@import", i)) {
      const match = /^@import\s+(["'])([^"'\r\n\\]+)\1\s*;/.exec(css.slice(i));
      if (!match?.[2] || imports.length >= 1000) return null;
      chunks.push(css.slice(start, i), " ");
      imports.push(match[2]);
      i += match[0].length;
      start = i;
      continue;
    }
    if (ch === '"' || ch === "'") {
      chunks.push(css.slice(start, i), " ");
      const quote = ch;
      i++;
      while (i < css.length && css[i] !== quote) {
        if (css[i] === "\n" || css[i] === "\r") return null;
        if (css[i] === "\\") i++;
        i++;
      }
      if (i >= css.length) return null;
      i++;
      start = i;
      continue;
    }
    i++;
  }
  chunks.push(css.slice(start));
  return { imports, visible: chunks.join("") };
}
function localImport(from: string, target: string): string | null {
  if (!/^\.\.?\//.test(target)) return null;
  const parts = from.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === ".") continue;
    if (part === "..") {
      if (parts.length <= 1) return null;
      parts.pop();
    } else parts.push(part);
  }
  const result = parts.join("/");
  return stylePath(result) ? result : null;
}

export function auditDefaultBreakpoints(
  input: BreakpointAuditInput,
): ResponsiveCapabilities {
  const unsupported = (
    reason: "version" | "config" | "styles" | "limits",
  ): ResponsiveCapabilities => ({ status: "unsupported", reason });
  if (
    input.styles.length > MAX_STYLE_FILES ||
    encoder.encode(input.packageJson).length > MAX_STYLE_FILE_BYTES
  )
    return unsupported("limits");
  if (input.configs.length) return unsupported("config");
  try {
    const pkg = JSON.parse(input.packageJson);
    const version =
      pkg?.dependencies?.tailwindcss ?? pkg?.devDependencies?.tailwindcss;
    if (
      typeof version !== "string" ||
      !/^[~^]?4(?:\.\d+){0,2}(?:-[a-z\d.-]+)?$/i.test(version)
    )
      return unsupported("version");
  } catch {
    return unsupported("version");
  }
  const files = new Set<string>(),
    graph = new Map<string, string[]>();
  let total = 0,
    importCount = 0,
    hasTailwind = false;
  for (const item of input.styles) {
    if (!stylePath(item.path) || files.has(item.path))
      return unsupported("styles");
    files.add(item.path);
    const size = encoder.encode(item.text).length;
    total += size;
    if (size > MAX_STYLE_FILE_BYTES || total > MAX_STYLE_TOTAL_BYTES)
      return unsupported("limits");
    const parsed = inspectCss(item.text);
    if (
      !parsed ||
      /--breakpoint|--\s*\*\s*:|@(?:import|config|plugin|reference|custom-variant|source)\b/i.test(
        parsed.visible,
      )
    )
      return unsupported("styles");
    const targets: string[] = [];
    for (const target of parsed.imports) {
      if (++importCount > 4096) return unsupported("limits");
      if (target === "tailwindcss") {
        hasTailwind = true;
        continue;
      }
      const path = localImport(item.path, target);
      if (!path) return unsupported("styles");
      targets.push(path);
    }
    graph.set(item.path, targets);
  }
  if (!hasTailwind) return unsupported("styles");
  const done = new Set<string>(),
    active = new Set<string>();
  const visit = (path: string, depth: number): boolean => {
    if (depth > 32 || !files.has(path) || active.has(path)) return false;
    if (done.has(path)) return true;
    active.add(path);
    for (const target of graph.get(path) ?? [])
      if (!visit(target, depth + 1)) return false;
    active.delete(path);
    done.add(path);
    return true;
  };
  for (const path of files) if (!visit(path, 0)) return unsupported("styles");
  return { status: "supported-defaults" };
}
