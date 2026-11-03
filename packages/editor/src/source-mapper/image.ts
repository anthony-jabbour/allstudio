import { assetPathFromUrl, MAX_ASSET_URL_LENGTH } from "../site/assets.ts";
import { type NodePath, type T, traverse } from "./babel.ts";
import { getOidFromJsxElement } from "./ids.ts";
import { getAstFromContent } from "./parse.ts";
import { isConfinedEdit } from "./splice.ts";
import type { ElementEditResult, SourceMapperError } from "./types.ts";

export type ImageSourceInfo =
  | { ok: true; kind: "img" | "next-image"; src: string; alt: string }
  | { ok: false; reason: SourceMapperError };
function inspect(
  content: string,
  oid: string,
):
  | {
      ok: true;
      info: Extract<ImageSourceInfo, { ok: true }>;
      value: T.StringLiteral;
    }
  | { ok: false; reason: SourceMapperError } {
  const ast = getAstFromContent(content);
  if (!ast) return { ok: false, reason: "parse-failed" };
  const paths: Array<NodePath<T.JSXElement>> = [];
  traverse(ast, {
    JSXElement(path: NodePath<T.JSXElement>) {
      if (getOidFromJsxElement(path.node.openingElement) === oid)
        paths.push(path);
    },
  });
  if (paths.length > 1) return { ok: false, reason: "oid-ambiguous" };
  const path = paths[0];
  if (!path) return { ok: false, reason: "oid-not-found" };
  const opening = path.node.openingElement;
  const unsupported = {
    ok: false as const,
    reason: "unsupported-image-source" as const,
  };
  if (opening.name.type !== "JSXIdentifier") return unsupported;
  let kind: "img" | "next-image" = "img";
  if (opening.name.name !== "img") {
    const binding = path.scope.getBinding(opening.name.name);
    const declaration = binding?.path.parentPath?.node;
    if (
      binding?.path.node.type !== "ImportDefaultSpecifier" ||
      declaration?.type !== "ImportDeclaration" ||
      declaration.importKind === "type" ||
      declaration.source.value !== "next/image"
    )
      return unsupported;
    kind = "next-image";
  }
  const attributes = new Map<string, T.JSXAttribute>();
  const folded = new Set<string>();
  for (const attribute of opening.attributes) {
    if (
      attribute.type !== "JSXAttribute" ||
      attribute.name.type !== "JSXIdentifier"
    )
      return unsupported;
    const name = attribute.name.name;
    const lower = name.toLowerCase();
    const canonical = [
      "src",
      "alt",
      "width",
      "height",
      "fill",
      "srcSet",
      "loader",
      "overrideSrc",
    ].find((value) => value.toLowerCase() === lower);
    if (folded.has(lower) || (canonical && name !== canonical))
      return unsupported;
    folded.add(lower);
    attributes.set(name, attribute);
  }
  const src = attributes.get("src")?.value,
    alt = attributes.get("alt")?.value;
  if (
    src?.type !== "StringLiteral" ||
    alt?.type !== "StringLiteral" ||
    src.value.length > MAX_ASSET_URL_LENGTH ||
    alt.value.length > 500 ||
    attributes.has("srcSet") ||
    attributes.has("srcset")
  )
    return unsupported;
  if (kind === "next-image") {
    if (attributes.has("loader") || attributes.has("overrideSrc"))
      return unsupported;
    const fill = attributes.get("fill");
    const filled =
      fill &&
      (fill.value === null ||
        (fill.value?.type === "JSXExpressionContainer" &&
          fill.value.expression.type === "BooleanLiteral" &&
          fill.value.expression.value));
    const dimension = (name: string) => {
      const value = attributes.get(name)?.value;
      const number =
        value?.type === "StringLiteral" && /^[1-9][0-9]*$/.test(value.value)
          ? Number(value.value)
          : value?.type === "JSXExpressionContainer" &&
              value.expression.type === "NumericLiteral"
            ? value.expression.value
            : NaN;
      return Number.isInteger(number) && number > 0 && number <= 100000;
    };
    if (!filled && !(dimension("width") && dimension("height")))
      return unsupported;
  }
  return {
    ok: true,
    info: { ok: true, kind, src: src.value, alt: alt.value },
    value: src,
  };
}
export function describeImageSource(
  content: string,
  oid: string,
): ImageSourceInfo {
  const found = inspect(content, oid);
  return found.ok ? found.info : found;
}
export function editElementImageSource(
  content: string,
  oid: string,
  url: string,
): ElementEditResult {
  if (!assetPathFromUrl(url))
    return { ok: false, reason: "unsupported-image-source" };
  const found = inspect(content, oid);
  if (!found.ok) return found;
  const { start, end } = found.value;
  if (typeof start !== "number" || typeof end !== "number")
    return { ok: false, reason: "parse-failed" };
  const quote = content[start];
  if ((quote !== '"' && quote !== "'") || content[end - 1] !== quote)
    return { ok: false, reason: "unconfined-patch" };
  const generated =
    content.slice(0, start) + quote + url + quote + content.slice(end);
  const checked = inspect(generated, oid);
  if (
    !isConfinedEdit(content, generated, start, end) ||
    !checked.ok ||
    checked.info.src !== url
  )
    return { ok: false, reason: "unconfined-patch" };
  return { ok: true, original: content, generated, strategy: "splice" };
}
