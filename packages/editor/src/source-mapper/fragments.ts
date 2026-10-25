/**
 * Adapted from Onlook (Apache-2.0).
 * Upstream: https://github.com/onlook-dev/onlook
 * Commit: 423e2e924366419e418ee049093872d535eea41a
 * Source: packages/parser/src/helpers.ts
 * Modifications: fragment helper only; color/config helpers omitted.
 * Copyright 2024 On Off, Inc.
 */
import { type T, t } from "./babel.ts";

export function isReactFragment(openingElement: T.JSXOpeningElement): boolean {
  const name = openingElement.name;

  if (t.isJSXIdentifier(name)) {
    return name.name === "Fragment";
  }

  if (t.isJSXMemberExpression(name)) {
    return (
      t.isJSXIdentifier(name.object) &&
      name.object.name === "React" &&
      t.isJSXIdentifier(name.property) &&
      name.property.name === "Fragment"
    );
  }

  return false;
}
