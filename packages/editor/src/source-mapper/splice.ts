/**
 * Format-preserving source edits.
 *
 * Instead of regenerating the whole file with Babel, these functions locate
 * the target node with the parser and replace only the bytes it owns. Every
 * byte outside the edited range is copied from the original content.
 * Callers fall back to the regenerating path (`previewPatch`) only when a
 * splice is not possible, and then must check confinement themselves.
 */
import { type NodePath, type T, t, traverse } from "./babel.ts";
import { isReactFragment } from "./fragments.ts";
import { getOidFromJsxElement } from "./ids.ts";
import { createUniqueOid } from "./oid.ts";
import { getAstFromContent } from "./parse.ts";
import { readNodeTextContent } from "./text.ts";
import { DATA_OID_ATTRIBUTE, type SourceMapperError } from "./types.ts";

interface Splice {
  start: number;
  end: number;
  text: string;
}

export type SpliceResult =
  | { ok: true; generated: string; elementStart: number; elementEnd: number }
  | { ok: false; reason: SourceMapperError | "not-spliceable" };

const JSX_TEXT_BREAKERS = /[<>{}&]/;
/**
 * Characters refused in a class value: quotes and line breaks would end or
 * break the JSX string; braces, `<` and backslashes are never valid
 * Tailwind classes here. `&` and `>` are allowed (`[&>*]:p-2`); the caller
 * re-reads the written value, so an HTML entity such as `&amp;` that JSX
 * would decode is refused there.
 */
const UNSAFE_CLASS_CHARS = /["'\n\r{}<\\]/;

function applySplices(content: string, splices: Splice[]): string {
  let out = content;
  for (const splice of [...splices].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, splice.start) + splice.text + out.slice(splice.end);
  }
  return out;
}

function hasRange(
  node: T.Node,
): node is T.Node & { start: number; end: number } {
  return typeof node.start === "number" && typeof node.end === "number";
}

/** Offset right after the tag name (and type arguments), before attributes. */
function nameEnd(opening: T.JSXOpeningElement): number | null {
  const typeArgs = (opening as { typeArguments?: T.Node | null }).typeArguments;
  const anchor = typeArgs ?? opening.typeParameters ?? opening.name;
  return anchor && hasRange(anchor) ? anchor.end : null;
}

/**
 * Adds `data-oid` to every JSX element that has none by inserting
 * ` data-oid="…"` after its last attribute. Returns null when any element
 * already carries a `data-oid` that is missing, invalid, or duplicated, so
 * the caller can fall back to the AST-regenerating instrumentation that
 * repairs those cases.
 */
export function insertOidsPreservingFormat(content: string): string | null {
  const ast = getAstFromContent(content);
  if (!ast) {
    return null;
  }
  const existing = new Set<string>();
  const missing: T.JSXOpeningElement[] = [];
  let repairNeeded = false;

  traverse(ast, {
    JSXOpeningElement(path: NodePath<T.JSXOpeningElement>) {
      if (isReactFragment(path.node)) {
        return;
      }
      const oidAttributes = path.node.attributes.filter(
        (attr) =>
          t.isJSXAttribute(attr) && attr.name.name === DATA_OID_ATTRIBUTE,
      );
      if (oidAttributes.length === 0) {
        missing.push(path.node);
        return;
      }
      const oid = getOidFromJsxElement(path.node);
      if (oidAttributes.length > 1 || !oid || existing.has(oid)) {
        repairNeeded = true;
        return;
      }
      existing.add(oid);
    },
  });
  if (repairNeeded) {
    return null;
  }

  const splices: Splice[] = [];
  for (const opening of missing) {
    const last = opening.attributes.at(-1);
    const at = last ? (hasRange(last) ? last.end : null) : nameEnd(opening);
    if (at === null) {
      return null;
    }
    const oid = createUniqueOid(existing);
    existing.add(oid);
    splices.push({
      start: at,
      end: at,
      text: ` ${DATA_OID_ATTRIBUTE}="${oid}"`,
    });
  }
  return applySplices(content, splices);
}

type Located =
  | { ok: true; node: T.JSXElement & { start: number; end: number } }
  | { ok: false; reason: "parse-failed" | "oid-not-found" | "oid-ambiguous" };

function locateElement(content: string, oid: string): Located {
  const ast = getAstFromContent(content);
  if (!ast) {
    return { ok: false, reason: "parse-failed" };
  }
  const found: T.JSXElement[] = [];
  traverse(ast, {
    JSXElement(path: NodePath<T.JSXElement>) {
      if (getOidFromJsxElement(path.node.openingElement) === oid) {
        found.push(path.node);
      }
    },
  });
  const node = found[0];
  if (!node) {
    return { ok: false, reason: "oid-not-found" };
  }
  if (found.length > 1) {
    return { ok: false, reason: "oid-ambiguous" };
  }
  if (!hasRange(node)) {
    return { ok: false, reason: "parse-failed" };
  }
  return { ok: true, node };
}

function asJsxTextOrExpression(text: string): string {
  // Leading/trailing spaces and JSX-significant characters need a string
  // expression; everything else stays as plain JSX text.
  if (JSX_TEXT_BREAKERS.test(text) || text !== text.trim()) {
    return `{${JSON.stringify(text)}}`;
  }
  return text;
}

/**
 * Replaces the static text of one element. Handles the common shapes
 * (one JSX text child, one string-literal child, or no children) by
 * rewriting only the text bytes; for a multi-line text child the
 * surrounding indentation is kept. Returns `not-spliceable` for other
 * static shapes (comments, several text parts, self-closing elements).
 */
export function spliceElementText(
  content: string,
  oid: string,
  text: string,
): SpliceResult {
  if (text.includes("\n") || text.includes("\r")) {
    return { ok: false, reason: "unsupported-multiline-text" };
  }
  const located = locateElement(content, oid);
  if (!located.ok) {
    return located;
  }
  const { node } = located;
  const readable = readNodeTextContent(node);
  if (!readable.ok) {
    return readable;
  }
  const range = { elementStart: node.start, elementEnd: node.end };
  const children = node.children;

  if (children.length === 0) {
    const opening = node.openingElement;
    if (!hasRange(opening)) {
      return { ok: false, reason: "not-spliceable" };
    }
    if (opening.selfClosing) {
      // `<div … />` → `<div …>text</div>`: replace only the `/>` tail.
      const last = opening.attributes.at(-1);
      const tailStart = last
        ? hasRange(last)
          ? last.end
          : null
        : nameEnd(opening);
      if (tailStart === null || !hasRange(opening.name)) {
        return { ok: false, reason: "not-spliceable" };
      }
      const tagName = content.slice(opening.name.start, opening.name.end);
      const generated = applySplices(content, [
        {
          start: tailStart,
          end: opening.end,
          text: `>${asJsxTextOrExpression(text)}</${tagName}>`,
        },
      ]);
      return { ok: true, generated, ...range };
    }
    const at = opening.end;
    const generated = applySplices(content, [
      { start: at, end: at, text: asJsxTextOrExpression(text) },
    ]);
    return { ok: true, generated, ...range };
  }

  const child = children[0];
  if (children.length !== 1 || !child || !hasRange(child)) {
    return { ok: false, reason: "not-spliceable" };
  }

  if (
    t.isJSXExpressionContainer(child) &&
    t.isStringLiteral(child.expression)
  ) {
    const generated = applySplices(content, [
      { start: child.start, end: child.end, text: `{${JSON.stringify(text)}}` },
    ]);
    return { ok: true, generated, ...range };
  }

  if (!t.isJSXText(child)) {
    return { ok: false, reason: "not-spliceable" };
  }
  // Use the raw source slice: JSXText.value has entities decoded.
  const raw = content.slice(child.start, child.end);
  const match = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const lead = match?.[1] ?? "";
  const trail = match?.[3] ?? "";
  if (lead.includes("\n") && trail.includes("\n")) {
    // Multi-line layout: JSX drops the whitespace lines around the text, so
    // only the text between them is replaced and the indentation survives.
    const generated = applySplices(content, [
      {
        start: child.start + lead.length,
        end: child.end - trail.length,
        text: asJsxTextOrExpression(text),
      },
    ]);
    return { ok: true, generated, ...range };
  }
  const generated = applySplices(content, [
    { start: child.start, end: child.end, text: asJsxTextOrExpression(text) },
  ]);
  return { ok: true, generated, ...range };
}

/**
 * Replaces the whole static `className` string of one element, keeping the
 * original quote style. An empty value removes the attribute. Refuses
 * expression class names and spreads that could override the attribute.
 */
export function spliceElementClassName(
  content: string,
  oid: string,
  className: string,
): SpliceResult {
  if (UNSAFE_CLASS_CHARS.test(className)) {
    return { ok: false, reason: "unsupported-className-value" };
  }
  const located = locateElement(content, oid);
  if (!located.ok) {
    return located;
  }
  const { node } = located;
  const range = { elementStart: node.start, elementEnd: node.end };
  const attributes = node.openingElement.attributes;
  const index = attributes.findIndex(
    (attr) => t.isJSXAttribute(attr) && attr.name.name === "className",
  );
  const classNameCount = attributes.filter(
    (attr) => t.isJSXAttribute(attr) && attr.name.name === "className",
  ).length;
  if (classNameCount > 1) {
    // React uses the last one; editing the first would have no effect.
    return { ok: false, reason: "unsupported-className-expression" };
  }
  const spreadAfter = (from: number) =>
    attributes.slice(from).some((attr) => t.isJSXSpreadAttribute(attr));

  if (index < 0) {
    if (spreadAfter(0)) {
      return { ok: false, reason: "unsupported-className-expression" };
    }
    if (className === "") {
      return { ok: true, generated: content, ...range };
    }
    const at = nameEnd(node.openingElement);
    if (at === null) {
      return { ok: false, reason: "not-spliceable" };
    }
    const generated = applySplices(content, [
      { start: at, end: at, text: ` className="${className}"` },
    ]);
    return { ok: true, generated, ...range };
  }

  const attr = attributes[index] as T.JSXAttribute;
  if (
    !attr.value ||
    !t.isStringLiteral(attr.value) ||
    !hasRange(attr.value) ||
    !hasRange(attr) ||
    spreadAfter(index + 1)
  ) {
    return { ok: false, reason: "unsupported-className-expression" };
  }
  if (className === "" && spreadAfter(0)) {
    // Removing the attribute would let a spread's className apply instead.
    return { ok: false, reason: "unsupported-className-expression" };
  }
  if (className === "") {
    // Remove the attribute together with the whitespace before it.
    let start = attr.start;
    while (start > 0 && /\s/.test(content[start - 1] ?? "")) {
      start -= 1;
    }
    const generated = applySplices(content, [
      { start, end: attr.end, text: "" },
    ]);
    return { ok: true, generated, ...range };
  }
  const generated = applySplices(content, [
    { start: attr.value.start + 1, end: attr.value.end - 1, text: className },
  ]);
  return { ok: true, generated, ...range };
}

/**
 * True when `generated` equals `original` outside `[start, end)`: only the
 * bytes of the edited element changed.
 */
export function isConfinedEdit(
  original: string,
  generated: string,
  start: number,
  end: number,
): boolean {
  const suffix = original.slice(end);
  return (
    generated.length >= start + suffix.length &&
    generated.startsWith(original.slice(0, start)) &&
    generated.endsWith(suffix)
  );
}
