/**
 * Adapted from Onlook (Apache-2.0).
 * Upstream: https://github.com/onlook-dev/onlook
 * Commit: 423e2e924366419e418ee049093872d535eea41a
 * Source: packages/parser/src/code-edit/text.ts
 * Modifications: single-line text only for this slice; newline/<br> handling omitted.
 * Copyright 2024 On Off, Inc.
 */
import { type T, t } from "./babel.ts";

const JSX_TEXT_BREAKERS = /[<>{}&]/;

const HTML_VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

export type TextEditResult = "ok" | "unsupported-void-element";

function isHtmlVoidElement(node: T.JSXElement): boolean {
  const name = node.openingElement.name;
  return t.isJSXIdentifier(name) && HTML_VOID_ELEMENTS.has(name.name);
}

function childForText(
  textContent: string,
): T.JSXText | T.JSXExpressionContainer {
  if (JSX_TEXT_BREAKERS.test(textContent)) {
    return t.jsxExpressionContainer(t.stringLiteral(textContent));
  }
  return t.jsxText(textContent);
}

function openSelfClosingElement(node: T.JSXElement): void {
  if (!node.openingElement.selfClosing) {
    return;
  }
  node.openingElement.selfClosing = false;
  node.closingElement = t.jsxClosingElement(
    t.cloneNode(node.openingElement.name, false),
  );
}

function isReplaceableTextChild(
  child: T.JSXElement["children"][number],
): boolean {
  return (
    t.isJSXText(child) ||
    (t.isJSXExpressionContainer(child) && t.isStringLiteral(child.expression))
  );
}

export function updateNodeTextContent(
  node: T.JSXElement,
  textContent: string,
): TextEditResult {
  if (isHtmlVoidElement(node)) {
    return "unsupported-void-element";
  }
  openSelfClosingElement(node);
  const nextChild = childForText(textContent);
  const replaceIndex = node.children.findIndex(isReplaceableTextChild);
  if (replaceIndex >= 0) {
    node.children[replaceIndex] = nextChild;
    return "ok";
  }
  node.children.unshift(nextChild);
  return "ok";
}
