import { type NodePath, type T, traverse } from "./babel.ts";
import { getAstFromContent } from "./parse.ts";

export interface ResponsiveProjectReader {
  listSources(): Promise<string[]>;
  readSource(path: string): Promise<Uint8Array>;
  readConfig(path: ResponsiveBuildConfig): Promise<Uint8Array | null>;
}
export const RESPONSIVE_BUILD_CONFIGS = [
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "postcss.config.ts",
  "postcss.config.js",
  "postcss.config.cjs",
  "postcss.config.mjs",
] as const;
export type ResponsiveBuildConfig = (typeof RESPONSIVE_BUILD_CONFIGS)[number];

function literal(node: T.Node | null | undefined): unknown {
  if (!node) return undefined;
  if (
    node.type === "StringLiteral" ||
    node.type === "BooleanLiteral" ||
    node.type === "NumericLiteral"
  )
    return node.value;
  if (node.type === "ArrayExpression")
    return node.elements.map((item) => literal(item));
  if (node.type !== "ObjectExpression") return undefined;
  const result: Record<string, unknown> = {};
  for (const property of node.properties) {
    if (
      property.type !== "ObjectProperty" ||
      property.computed ||
      property.shorthand
    )
      return undefined;
    const key =
      property.key.type === "Identifier"
        ? property.key.name
        : property.key.type === "StringLiteral"
          ? property.key.value
          : null;
    if (!key || Object.hasOwn(result, key)) return undefined;
    const value = literal(property.value);
    if (value === undefined) return undefined;
    result[key] = value;
  }
  return result;
}
function knownNextConfig(source: string): boolean {
  const ast = getAstFromContent(source);
  if (!ast) return false;
  const bindings = new Map<string, T.Node>();
  let config: unknown;
  for (const node of ast.program.body) {
    if (
      node.type === "ImportDeclaration" &&
      node.importKind === "type" &&
      node.source.value === "next"
    )
      continue;
    if (node.type === "VariableDeclaration" && node.kind === "const") {
      for (const declaration of node.declarations) {
        if (
          declaration.id.type !== "Identifier" ||
          !declaration.init ||
          declaration.init.type !== "ObjectExpression"
        )
          return false;
        bindings.set(declaration.id.name, declaration.init);
      }
      continue;
    }
    if (node.type !== "ExportDefaultDeclaration" || config !== undefined)
      return false;
    config = literal(
      node.declaration.type === "Identifier"
        ? bindings.get(node.declaration.name)
        : node.declaration,
    );
  }
  if (!config || typeof config !== "object" || Array.isArray(config))
    return false;
  const value = config as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (key) =>
        ![
          "agentRules",
          "cacheComponents",
          "partialPrefetching",
          "turbopack",
        ].includes(key),
    )
  )
    return false;
  for (const key of ["agentRules", "cacheComponents", "partialPrefetching"]) {
    if (key in value && typeof value[key] !== "boolean") return false;
  }
  return (
    !("turbopack" in value) ||
    JSON.stringify(value.turbopack) ===
      JSON.stringify({
        rules: {
          "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
        },
      })
  );
}
function resolveModule(
  from: string,
  target: string,
  files: Set<string>,
  styles: Set<string>,
): boolean {
  if (!target.startsWith("."))
    return [
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom",
      "react-dom/client",
      "react-dom/server",
      "next",
      "next/link",
      "next/image",
      "next/navigation",
      "next/head",
      "next/script",
      "next/font/google",
      "next/font/local",
    ].includes(target);
  if (/[\\:%?#]/.test(target)) return false;
  const parts = from.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === ".") continue;
    if (part === "..") {
      if (parts.length <= 1) return false;
      parts.pop();
    } else if (part) parts.push(part);
    else return false;
  }
  const path = parts.join("/");
  if (/\.(?:css|scss|sass|less|pcss|postcss|styl|stylus)$/i.test(path))
    return styles.has(path);
  return [
    path,
    ...[".tsx", ".jsx", ".ts", ".js", ".mjs", ".cjs"].flatMap((ext) => [
      path + ext,
      `${path}/index${ext}`,
    ]),
  ].some((candidate) => files.has(candidate));
}

/** Conservative static subset: unproven loaders, aliases and module imports disable scoped writes. */
export async function validateResponsiveProject(
  reader: ResponsiveProjectReader,
  stylePaths: readonly string[],
): Promise<boolean> {
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let total = 0;
    const decode = (bytes: Uint8Array) => {
      total += bytes.byteLength;
      if (bytes.byteLength > 1024 * 1024 || total > 4 * 1024 * 1024)
        throw new Error("Audit limit");
      return decoder.decode(bytes);
    };
    let configs = 0;
    for (const path of RESPONSIVE_BUILD_CONFIGS) {
      const bytes = await reader.readConfig(path);
      if (!bytes) continue;
      if (
        path.startsWith("postcss.") ||
        ++configs > 1 ||
        !knownNextConfig(decode(bytes))
      )
        return false;
    }
    const paths = await reader.listSources();
    if (paths.length > 1000 || !paths.length) return false;
    const files = new Set(paths),
      styles = new Set(stylePaths);
    for (const path of paths) {
      if (
        path.length > 1024 ||
        !/^src\/.+\.(?:tsx|jsx|ts|js|mjs|cjs)$/.test(path) ||
        path.split("/").some((part) => !part || part === "." || part === "..")
      )
        return false;
      const ast = getAstFromContent(decode(await reader.readSource(path)));
      if (!ast) return false;
      let valid = true;
      traverse(ast, {
        ImportDeclaration(p: NodePath<T.ImportDeclaration>) {
          if (
            p.node.importKind !== "type" &&
            !resolveModule(path, p.node.source.value, files, styles)
          )
            valid = false;
        },
        ExportNamedDeclaration(p: NodePath<T.ExportNamedDeclaration>) {
          if (
            p.node.source &&
            p.node.exportKind !== "type" &&
            !resolveModule(path, p.node.source.value, files, styles)
          )
            valid = false;
        },
        ExportAllDeclaration(p: NodePath<T.ExportAllDeclaration>) {
          if (!resolveModule(path, p.node.source.value, files, styles))
            valid = false;
        },
        CallExpression(p: NodePath<T.CallExpression>) {
          if (
            p.node.callee.type === "Import" ||
            (p.node.callee.type === "Identifier" &&
              ["require", "eval", "Function"].includes(p.node.callee.name))
          )
            valid = false;
        },
        JSXOpeningElement(p: NodePath<T.JSXOpeningElement>) {
          if (
            p.node.name.type === "JSXIdentifier" &&
            ["style", "link"].includes(p.node.name.name)
          )
            valid = false;
        },
      });
      if (!valid) return false;
    }
    return true;
  } catch {
    return false;
  }
}
