/**
 * Adapted from Onlook (Apache-2.0).
 * Upstream: https://github.com/onlook-dev/onlook
 * Commit: 423e2e924366419e418ee049093872d535eea41a
 * Source: packages/parser/src/code-edit/style.ts
 * Modifications: refuse expression className instead of appending call arguments.
 * Copyright 2024 On Off, Inc.
 */
import { twMerge } from "tailwind-merge";
import { type T, t } from "./babel.ts";

export type ClassEditResult = "ok" | "unsupported-className-expression";

function insertClassName(
  element: T.JSXOpeningElement,
  className: string,
): void {
  element.attributes.push(
    t.jsxAttribute(t.jsxIdentifier("className"), t.stringLiteral(className)),
  );
}

function hasJsxSpread(
  attributes: T.JSXOpeningElement["attributes"],
  fromIndex = 0,
): boolean {
  return attributes
    .slice(fromIndex)
    .some((attr) => t.isJSXSpreadAttribute(attr));
}

export function tryAddClassToNode(
  node: T.JSXElement,
  className: string,
): ClassEditResult {
  const openingElement = node.openingElement;
  const classNameIndex = openingElement.attributes.findIndex(
    (attr): attr is T.JSXAttribute =>
      t.isJSXAttribute(attr) && attr.name.name === "className",
  );
  const classNameAttr =
    classNameIndex >= 0
      ? (openingElement.attributes[classNameIndex] as T.JSXAttribute)
      : undefined;

  if (!classNameAttr) {
    if (hasJsxSpread(openingElement.attributes)) {
      return "unsupported-className-expression";
    }
    insertClassName(openingElement, className);
    return "ok";
  }

  if (classNameAttr.value && t.isStringLiteral(classNameAttr.value)) {
    if (hasJsxSpread(openingElement.attributes, classNameIndex + 1)) {
      return "unsupported-className-expression";
    }
    classNameAttr.value.value = twMerge(classNameAttr.value.value, className);
    return "ok";
  }

  return "unsupported-className-expression";
}
