import { type NodePath, type T, traverse } from "./babel.ts";
import { getOidFromJsxElement } from "./ids.ts";
import { getAstFromContent } from "./parse.ts";
import { isConfinedEdit } from "./splice.ts";
import type { SourceMapperError } from "./types.ts";

export type ReorderDirection = "up" | "down";
export interface ReorderNeighbor {
  oid: string;
  tagName: string;
}
export type ReorderInspection =
  | { ok: true; up: ReorderNeighbor | null; down: ReorderNeighbor | null }
  | { ok: false; reason: SourceMapperError };
interface Entry {
  node: T.JSXElement;
  oid: string | null;
  start: number;
  end: number;
}
const validOid = (oid: string | null): oid is string =>
  oid !== null && /^[a-z0-9\-._:]{1,64}$/.test(oid);
const isFunction = (node: T.Node) =>
  [
    "FunctionDeclaration",
    "FunctionExpression",
    "ArrowFunctionExpression",
  ].includes(node.type);
function staticSubtree(node: T.JSXElement): boolean {
  if (
    node.openingElement.name.type !== "JSXIdentifier" ||
    node.openingElement.attributes.some(
      (attribute) =>
        attribute.type !== "JSXAttribute" ||
        (attribute.value !== null && attribute.value?.type !== "StringLiteral"),
    )
  )
    return false;
  return node.children.every(
    (child) =>
      child.type === "JSXText" ||
      (child.type === "JSXElement" && staticSubtree(child)) ||
      (child.type === "JSXExpressionContainer" &&
        child.expression.type === "JSXEmptyExpression"),
  );
}
function defaultComponent(ast: T.File): T.Node | null {
  const exported = ast.program.body.find(
    (node): node is T.ExportDefaultDeclaration =>
      node.type === "ExportDefaultDeclaration",
  );
  if (!exported) return null;
  if (isFunction(exported.declaration)) return exported.declaration;
  if (exported.declaration.type !== "Identifier") return null;
  const name = exported.declaration.name;
  for (const node of ast.program.body) {
    if (node.type === "FunctionDeclaration" && node.id?.name === name)
      return node;
    if (node.type === "VariableDeclaration")
      for (const declaration of node.declarations) {
        if (
          declaration.id.type === "Identifier" &&
          declaration.id.name === name &&
          declaration.init &&
          isFunction(declaration.init)
        )
          return declaration.init;
      }
  }
  return null;
}
function returnedMarkup(root: T.Node): T.JSXElement | null {
  if (
    root.type !== "FunctionDeclaration" &&
    root.type !== "FunctionExpression" &&
    root.type !== "ArrowFunctionExpression"
  )
    return null;
  if (root.body.type === "JSXElement") return root.body;
  if (root.body.type !== "BlockStatement") return null;
  const statements = root.body.body.filter(
    (statement) => statement.type !== "EmptyStatement",
  );
  const last = statements.at(-1);
  if (last?.type !== "ReturnStatement" || last.argument?.type !== "JSXElement")
    return null;
  if (
    statements
      .slice(0, -1)
      .some(
        (statement) =>
          ![
            "VariableDeclaration",
            "FunctionDeclaration",
            "TSTypeAliasDeclaration",
            "TSInterfaceDeclaration",
          ].includes(statement.type),
      )
  )
    return null;
  return last.argument;
}
function locate(
  content: string,
  oid: string,
):
  | {
      ok: true;
      entries: Entry[];
      target: Entry;
      up: Entry | null;
      down: Entry | null;
    }
  | { ok: false; reason: SourceMapperError } {
  const ast = getAstFromContent(content);
  if (!ast) return { ok: false, reason: "parse-failed" };
  const entries: Entry[] = [];
  const targets: Array<NodePath<T.JSXElement>> = [];
  traverse(ast, {
    JSXElement(path: NodePath<T.JSXElement>) {
      const node = path.node;
      if (typeof node.start !== "number" || typeof node.end !== "number")
        return;
      const entry = {
        node,
        oid: getOidFromJsxElement(node.openingElement),
        start: node.start,
        end: node.end,
      };
      entries.push(entry);
      if (entry.oid === oid) targets.push(path);
    },
  });
  if (targets.length > 1) return { ok: false, reason: "oid-ambiguous" };
  const path = targets[0];
  const target = entries.find((entry) => entry.node === path?.node);
  if (!path || !target) return { ok: false, reason: "oid-not-found" };
  if (!staticSubtree(target.node))
    return { ok: false, reason: "unsupported-reorder" };
  const root = defaultComponent(ast),
    parent = path.parentPath;
  const markup = root ? returnedMarkup(root) : null;
  if (
    !root ||
    !markup ||
    typeof markup.start !== "number" ||
    typeof markup.end !== "number" ||
    target.start < markup.start ||
    target.end > markup.end ||
    path.getFunctionParent()?.node !== root ||
    parent?.node.type !== "JSXElement"
  )
    return { ok: false, reason: "unsupported-reorder" };
  for (
    let ancestor: NodePath<T.Node> | null = parent;
    ancestor && ancestor.node !== root;
    ancestor = ancestor.parentPath
  ) {
    if (
      [
        "JSXExpressionContainer",
        "ConditionalExpression",
        "LogicalExpression",
        "CallExpression",
      ].includes(ancestor.node.type)
    )
      return { ok: false, reason: "unsupported-reorder" };
  }
  const children = parent.node.children,
    index = children.indexOf(path.node);
  const neighbor = (step: number): Entry | null => {
    for (let i = index + step; i >= 0 && i < children.length; i += step) {
      const child = children[i];
      if (child?.type === "JSXText" && /^\s*$/.test(child.value)) continue;
      if (child?.type !== "JSXElement") return null;
      const entry = entries.find((item) => item.node === child);
      return entry &&
        validOid(entry.oid) &&
        entry.node.openingElement.name.type === "JSXIdentifier" &&
        staticSubtree(entry.node) &&
        entries.filter((item) => item.oid === entry.oid).length === 1
        ? entry
        : null;
    }
    return null;
  };
  return { ok: true, entries, target, up: neighbor(-1), down: neighbor(1) };
}
export function inspectSiblingReorder(
  content: string,
  oid: string,
): ReorderInspection {
  const found = locate(content, oid);
  if (!found.ok) return found;
  const info = (entry: Entry | null): ReorderNeighbor | null =>
    entry &&
    validOid(entry.oid) &&
    entry.node.openingElement.name.type === "JSXIdentifier"
      ? { oid: entry.oid, tagName: entry.node.openingElement.name.name }
      : null;
  return { ok: true, up: info(found.up), down: info(found.down) };
}
export function reorderSibling(
  content: string,
  oid: string,
  siblingOid: string,
  direction: ReorderDirection,
):
  | {
      ok: true;
      generated: string;
      oidOrder: string[];
      movedOrdinal: number;
      siblingOrdinal: number;
    }
  | { ok: false; reason: SourceMapperError } {
  const found = locate(content, oid);
  if (!found.ok) return found;
  const sibling =
    direction === "up" ? found.up : direction === "down" ? found.down : null;
  if (!sibling || sibling.oid !== siblingOid || oid === siblingOid)
    return { ok: false, reason: "unsupported-reorder" };
  const first = direction === "up" ? sibling : found.target,
    second = direction === "up" ? found.target : sibling;
  const generated =
    content.slice(0, first.start) +
    content.slice(second.start, second.end) +
    content.slice(first.end, second.start) +
    content.slice(first.start, first.end) +
    content.slice(second.end);
  if (
    generated.length !== content.length ||
    !isConfinedEdit(content, generated, first.start, second.end)
  )
    return { ok: false, reason: "unconfined-patch" };
  const oids = (entries: Entry[]) =>
    entries.flatMap((entry) => (entry.oid === null ? [] : [entry.oid]));
  const old = oids(found.entries);
  const subtree = (entry: Entry) =>
    oids(
      found.entries.filter(
        (item) => item.start >= entry.start && item.end <= entry.end,
      ),
    );
  const a = subtree(first),
    b = subtree(second),
    start = old.indexOf(a[0] ?? "");
  if (
    start < 0 ||
    JSON.stringify(old.slice(start, start + a.length + b.length)) !==
      JSON.stringify([...a, ...b])
  )
    return { ok: false, reason: "unsupported-reorder" };
  const oidOrder = [
    ...old.slice(0, start),
    ...b,
    ...a,
    ...old.slice(start + a.length + b.length),
  ];
  const checked = locate(generated, oid);
  if (
    !checked.ok ||
    checked.entries.length !== found.entries.length ||
    JSON.stringify(oids(checked.entries)) !== JSON.stringify(oidOrder)
  )
    return { ok: false, reason: "unconfined-patch" };
  const inverse = direction === "up" ? checked.down : checked.up;
  if (inverse?.oid !== siblingOid)
    return { ok: false, reason: "unconfined-patch" };
  return {
    ok: true,
    generated,
    oidOrder,
    movedOrdinal: oidOrder.indexOf(oid),
    siblingOrdinal: oidOrder.indexOf(siblingOid),
  };
}
