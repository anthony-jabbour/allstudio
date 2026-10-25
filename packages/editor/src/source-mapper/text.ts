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
): void {
  openSelfClosingElement(node);
  const nextChild = childForText(textContent);
  const replaceIndex = node.children.findIndex(isReplaceableTextChild);
  if (replaceIndex >= 0) {
    node.children[replaceIndex] = nextChild;
    return;
  }
  node.children.unshift(nextChild);
}
