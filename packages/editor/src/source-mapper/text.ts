/**
 * Adapted from Onlook (Apache-2.0).
 * Upstream: https://github.com/onlook-dev/onlook
 * Commit: 423e2e924366419e418ee049093872d535eea41a
 * Source: packages/parser/src/code-edit/text.ts
 * Modifications: single-line text only for this slice; newline/<br> handling omitted.
 * Copyright 2024 On Off, Inc.
 */
import { type T, t } from "./babel.ts";

export function updateNodeTextContent(
  node: T.JSXElement,
  textContent: string,
): void {
  const textNode = node.children.find((child) => t.isJSXText(child));
  if (textNode && t.isJSXText(textNode)) {
    textNode.value = textContent;
    return;
  }
  node.children.unshift(t.jsxText(textContent));
}
