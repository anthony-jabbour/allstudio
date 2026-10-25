/**
 * Adapted from Onlook (Apache-2.0).
 * Upstream: https://github.com/onlook-dev/onlook
 * Commit: 423e2e924366419e418ee049093872d535eea41a
 * Source: packages/parser/src/template-node/map.ts and helpers.ts
 * Modifications: public SourceLocation only; dynamic/core element types omitted.
 * Copyright 2024 On Off, Inc.
 */
import { type NodePath, type T, t, traverse } from "./babel.ts";
import { isReactFragment } from "./fragments.ts";
import { getOidFromJsxElement } from "./ids.ts";
import type { SourceLocation } from "./types.ts";

function pushComponentName(stack: string[], name: string | undefined): void {
  if (name) {
    stack.push(name);
  }
}

export function createSourceLocations(
  ast: T.File,
  filename: string,
): SourceLocation[] {
  const locations: SourceLocation[] = [];
  const componentStack: string[] = [];

  traverse(ast, {
    FunctionDeclaration: {
      enter(path: NodePath<T.FunctionDeclaration>) {
        pushComponentName(componentStack, path.node.id?.name);
      },
      exit() {
        componentStack.pop();
      },
    },
    ClassDeclaration: {
      enter(path: NodePath<T.ClassDeclaration>) {
        pushComponentName(componentStack, path.node.id?.name);
      },
      exit() {
        componentStack.pop();
      },
    },
    VariableDeclaration: {
      enter(path: NodePath<T.VariableDeclaration>) {
        const id = path.node.declarations[0]?.id;
        if (id && t.isIdentifier(id)) {
          componentStack.push(id.name);
        }
      },
      exit() {
        componentStack.pop();
      },
    },
    JSXElement(path: NodePath<T.JSXElement>) {
      if (isReactFragment(path.node.openingElement)) {
        return;
      }
      const oid = getOidFromJsxElement(path.node.openingElement);
      if (!oid) {
        return;
      }
      const opening = path.node.openingElement.loc;
      const closing = path.node.closingElement?.loc ?? opening;
      locations.push({
        oid,
        path: filename,
        component: componentStack.at(-1) ?? null,
        start: {
          line: opening?.start.line ?? 0,
          column: opening?.start.column ?? 0,
        },
        end: {
          line: closing?.end.line ?? 0,
          column: closing?.end.column ?? 0,
        },
      });
    },
  });

  return locations;
}
