/**
 * Adapted from Onlook (Apache-2.0).
 * Upstream: https://github.com/onlook-dev/onlook
 * Commit: 423e2e924366419e418ee049093872d535eea41a
 * Source: packages/parser/src/code-edit/text.ts
 * Modifications: single-line text only for this slice; newline/<br> handling omitted.
 * Refuses elements whose children are not purely static text (expressions,
 * nested elements) instead of editing the first JSXText child.
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

export type TextEditResult =
  | "ok"
  | "unsupported-void-element"
  | "unsupported-dynamic-children"
  | "unsupported-multiline-text";

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

type JsxChild = T.JSXElement["children"][number];

function isReplaceableTextChild(child: JsxChild): boolean {
  return (
    t.isJSXText(child) ||
    (t.isJSXExpressionContainer(child) && t.isStringLiteral(child.expression))
  );
}

function isJsxComment(child: JsxChild): boolean {
  return (
    t.isJSXExpressionContainer(child) &&
    t.isJSXEmptyExpression(child.expression)
  );
}

export function updateNodeTextContent(
  node: T.JSXElement,
  textContent: string,
): TextEditResult {
  if (isHtmlVoidElement(node)) {
    return "unsupported-void-element";
  }
  if (textContent.includes("\n")) {
    return "unsupported-multiline-text";
  }
  if (
    !node.children.every(
      (child) => isReplaceableTextChild(child) || isJsxComment(child),
    )
  ) {
    return "unsupported-dynamic-children";
  }
  openSelfClosingElement(node);
  const nextChild = childForText(textContent);
  // Every child is static text or a comment: keep comments, collapse text into one child.
  const insertAt = Math.max(0, node.children.findIndex(isReplaceableTextChild));
  node.children = [
    ...node.children.slice(0, insertAt).filter(isJsxComment),
    nextChild,
    ...node.children.slice(insertAt).filter(isJsxComment),
  ];
  return "ok";
}
