import { type NodePath, type T, traverse } from "./babel.ts";
import { addOidsToAst, getOidFromJsxElement } from "./ids.ts";
import { createSourceLocations } from "./locations.ts";
import { getAstFromContent, getContentFromAst } from "./parse.ts";
import { tryAddClassToNode } from "./style.ts";
import { updateNodeTextContent } from "./text.ts";
import type {
  ElementEdit,
  InstrumentResult,
  LocateSourceOptions,
  PreviewPatchResult,
  SourceLocation,
} from "./types.ts";

export type {
  ElementEdit,
  InstrumentResult,
  LocateSourceOptions,
  PreviewPatchResult,
  SourceLocation,
  SourceMapperError,
} from "./types.ts";

const DEFAULT_FILENAME = "untitled.tsx";

export function instrumentSource(content: string): InstrumentResult {
  const ast = getAstFromContent(content);
  if (!ast) {
    return { ok: false, reason: "parse-failed" };
  }
  addOidsToAst(ast);
  const generated = getContentFromAst(ast, content);
  const mapped = getAstFromContent(generated);
  const locations = mapped
    ? createSourceLocations(mapped, DEFAULT_FILENAME)
    : createSourceLocations(ast, DEFAULT_FILENAME);
  return { ok: true, content: generated, locations };
}

export function locateSource(
  content: string,
  oid: string,
  options: LocateSourceOptions = {},
): SourceLocation | null {
  const ast = getAstFromContent(content);
  if (!ast) {
    return null;
  }
  const filename = options.filename ?? DEFAULT_FILENAME;
  return (
    createSourceLocations(ast, filename).find(
      (location) => location.oid === oid,
    ) ?? null
  );
}

export function previewPatch(
  content: string,
  edit: ElementEdit,
): PreviewPatchResult {
  const ast = getAstFromContent(content);
  if (!ast) {
    return { ok: false, reason: "parse-failed" };
  }

  let found = false;
  let classResult: ReturnType<typeof tryAddClassToNode> = "ok";
  let textResult: ReturnType<typeof updateNodeTextContent> = "ok";

  traverse(ast, {
    JSXElement(path: NodePath<T.JSXElement>) {
      const currentOid = getOidFromJsxElement(path.node.openingElement);
      if (currentOid !== edit.oid) {
        return;
      }
      found = true;
      if (edit.className) {
        classResult = tryAddClassToNode(path.node, edit.className);
        if (classResult !== "ok") {
          path.stop();
          return;
        }
      }
      if (edit.textContent !== undefined) {
        textResult = updateNodeTextContent(path.node, edit.textContent);
      }
      path.stop();
    },
  });

  if (!found) {
    return { ok: false, reason: "oid-not-found" };
  }
  if (classResult !== "ok") {
    return { ok: false, reason: "unsupported-className-expression" };
  }
  if (textResult !== "ok") {
    return { ok: false, reason: "unsupported-void-element" };
  }

  return {
    ok: true,
    original: content,
    generated: getContentFromAst(ast, content),
  };
}
