/**
 * Adapted from Onlook (Apache-2.0).
 * Upstream: https://github.com/onlook-dev/onlook
 * Commit: 423e2e924366419e418ee049093872d535eea41a
 * Source: packages/parser/src/ids.ts
 * Modifications: no branch-oid map; local uniqueness only.
 * Copyright 2024 On Off, Inc.
 */
import { type NodePath, type T, t, traverse } from "./babel.ts";
import { isReactFragment } from "./fragments.ts";
import { createUniqueOid } from "./oid.ts";
import { DATA_OID_ATTRIBUTE } from "./types.ts";

function createOidAttribute(oidValue: string): T.JSXAttribute {
  return t.jsxAttribute(
    t.jsxIdentifier(DATA_OID_ATTRIBUTE),
    t.stringLiteral(oidValue),
  );
}

function collectOids(
  attributes: Array<T.JSXAttribute | T.JSXSpreadAttribute>,
): {
  indices: number[];
  values: string[];
  hasMultiple: boolean;
  hasInvalid: boolean;
} {
  const indices: number[] = [];
  const values: string[] = [];
  let hasInvalid = false;

  attributes.forEach((attr, index) => {
    if (t.isJSXAttribute(attr) && attr.name.name === DATA_OID_ATTRIBUTE) {
      indices.push(index);
      const existingAttrValue = attr.value;
      if (!existingAttrValue || !t.isStringLiteral(existingAttrValue)) {
        hasInvalid = true;
        values.push("");
        return;
      }
      const value = existingAttrValue.value;
      if (!value || value.trim() === "") {
        hasInvalid = true;
        values.push("");
        return;
      }
      values.push(value);
    }
  });

  return {
    indices,
    values,
    hasMultiple: indices.length > 1,
    hasInvalid,
  };
}

export function getOidFromJsxElement(
  element: T.JSXOpeningElement,
): string | null {
  const attribute = element.attributes.find(
    (attr): attr is T.JSXAttribute =>
      t.isJSXAttribute(attr) && attr.name.name === DATA_OID_ATTRIBUTE,
  );
  if (!attribute?.value || !t.isStringLiteral(attribute.value)) {
    return null;
  }
  return attribute.value.value;
}

export function addOidsToAst(ast: T.File): { ast: T.File; modified: boolean } {
  let modified = false;
  const localOids = new Set<string>();

  traverse(ast, {
    JSXOpeningElement(path: NodePath<T.JSXOpeningElement>) {
      if (isReactFragment(path.node)) {
        return;
      }

      const attributes = path.node.attributes;
      const existing = collectOids(attributes);

      if (existing.indices.length === 0) {
        const oid = createUniqueOid(localOids);
        attributes.push(createOidAttribute(oid));
        localOids.add(oid);
        modified = true;
        return;
      }

      if (existing.hasMultiple || existing.hasInvalid) {
        for (const index of [...existing.indices].sort((a, b) => b - a)) {
          attributes.splice(index, 1);
        }
        const oid = createUniqueOid(localOids);
        attributes.push(createOidAttribute(oid));
        localOids.add(oid);
        modified = true;
        return;
      }

      const oidValue = existing.values[0];
      const oidIndex = existing.indices[0];
      if (!oidValue || oidIndex === undefined) {
        return;
      }
      if (localOids.has(oidValue)) {
        const oid = createUniqueOid(localOids);
        const attr = attributes[oidIndex] as T.JSXAttribute;
        attr.value = t.stringLiteral(oid);
        localOids.add(oid);
        modified = true;
        return;
      }
      localOids.add(oidValue);
    },
  });

  return { ast, modified };
}
