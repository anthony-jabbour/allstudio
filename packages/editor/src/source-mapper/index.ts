import { type NodePath, type T, traverse } from "./babel.ts";
import { addOidsToAst, getOidFromJsxElement } from "./ids.ts";
import { createSourceLocations } from "./locations.ts";
import { getAstFromContent, getContentFromAst } from "./parse.ts";
import { tryAddClassToNode } from "./style.ts";
import { readNodeTextContent, updateNodeTextContent } from "./text.ts";
import type {
  DescribeElementResult,
  ElementEdit,
  ElementTextContent,
  InstrumentResult,
  LocateSourceOptions,
  PreviewPatchResult,
  SourceLocation,
} from "./types.ts";

export type { DiffHunk, DiffLine, LineDiff } from "./diff.ts";
export { createLineDiff, formatLineDiff } from "./diff.ts";
export type {
  DescribeElementResult,
  ElementEdit,
  ElementTextContent,
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

/**
 * Resolves one oid to its source location and, when the element only holds
 * static text, the text React renders for it. Refuses missing or duplicated
 * oids so callers never act on the wrong element.
 */
export function describeElement(
  content: string,
  oid: string,
  options: LocateSourceOptions = {},
): DescribeElementResult {
  const ast = getAstFromContent(content);
  if (!ast) {
    return { ok: false, reason: "parse-failed" };
  }
  const filename = options.filename ?? DEFAULT_FILENAME;
  const matches = createSourceLocations(ast, filename).filter(
    (location) => location.oid === oid,
  );
  const location = matches[0];
  if (!location) {
    return { ok: false, reason: "oid-not-found" };
  }
  if (matches.length > 1) {
    return { ok: false, reason: "oid-ambiguous" };
  }

  let text: ElementTextContent = {
    ok: false,
    reason: "unsupported-dynamic-children",
  };
  traverse(ast, {
    JSXElement(path: NodePath<T.JSXElement>) {
      if (getOidFromJsxElement(path.node.openingElement) !== oid) {
        return;
      }
      text = readNodeTextContent(path.node);
      path.stop();
    },
  });

  return { ok: true, location, text };
}

/**
 * Every `data-oid` attribute value on a JSX element, in source order, or
 * null when the content does not parse. Text that merely looks like an
 * attribute is not counted.
 */
export function listOids(content: string): string[] | null {
  const ast = getAstFromContent(content);
  if (!ast) {
    return null;
  }
  const oids: string[] = [];
  traverse(ast, {
    JSXOpeningElement(path: NodePath<T.JSXOpeningElement>) {
      const oid = getOidFromJsxElement(path.node);
      if (oid !== null) {
        oids.push(oid);
      }
    },
  });
  return oids;
}

export function previewPatch(
  content: string,
  edit: ElementEdit,
): PreviewPatchResult {
  const ast = getAstFromContent(content);
  if (!ast) {
    return { ok: false, reason: "parse-failed" };
  }

  let matches = 0;
  traverse(ast, {
    JSXOpeningElement(path: NodePath<T.JSXOpeningElement>) {
      if (getOidFromJsxElement(path.node) === edit.oid) {
        matches += 1;
      }
    },
  });
  if (matches === 0) {
    return { ok: false, reason: "oid-not-found" };
  }
  if (matches > 1) {
    return { ok: false, reason: "oid-ambiguous" };
  }

  let classResult: ReturnType<typeof tryAddClassToNode> = "ok";
  let textResult: ReturnType<typeof updateNodeTextContent> = "ok";

  traverse(ast, {
    JSXElement(path: NodePath<T.JSXElement>) {
      const currentOid = getOidFromJsxElement(path.node.openingElement);
      if (currentOid !== edit.oid) {
        return;
      }
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

  if (classResult !== "ok") {
    return { ok: false, reason: "unsupported-className-expression" };
  }
  if (textResult !== "ok") {
    return { ok: false, reason: textResult };
  }

  return {
    ok: true,
    original: content,
    generated: getContentFromAst(ast, content),
  };
}
