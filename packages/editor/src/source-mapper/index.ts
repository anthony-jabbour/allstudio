import { type NodePath, type T, traverse } from "./babel.ts";
import { addOidsToAst, getOidFromJsxElement } from "./ids.ts";
import { createSourceLocations } from "./locations.ts";
import { getAstFromContent, getContentFromAst } from "./parse.ts";
import {
  insertOidsPreservingFormat,
  isConfinedEdit,
  spliceElementClassName,
  spliceElementText,
} from "./splice.ts";
import { readClassName, tryAddClassToNode } from "./style.ts";
import { readNodeTextContent, updateNodeTextContent } from "./text.ts";
import type {
  DescribeElementResult,
  ElementClassName,
  ElementEdit,
  ElementEditResult,
  ElementTextContent,
  InstrumentOptions,
  InstrumentResult,
  LocateSourceOptions,
  PreviewPatchResult,
  SourceLocation,
} from "./types.ts";

export type { DiffHunk, DiffLine, LineDiff } from "./diff.ts";
export { createLineDiff, formatLineDiff } from "./diff.ts";
export {
  type ResponsiveBuildConfig,
  validateResponsiveProject,
} from "./responsive-project.ts";
export type {
  DescribeElementResult,
  ElementClassName,
  ElementEdit,
  ElementEditResult,
  ElementTextContent,
  InstrumentOptions,
  InstrumentResult,
  LocateSourceOptions,
  PreviewPatchResult,
  SourceLocation,
  SourceMapperError,
} from "./types.ts";

const DEFAULT_FILENAME = "untitled.tsx";

export function instrumentSource(
  content: string,
  options: InstrumentOptions = {},
): InstrumentResult {
  const ast = getAstFromContent(content);
  if (!ast) {
    return { ok: false, reason: "parse-failed" };
  }
  const preserved = options.preserveFormatting
    ? insertOidsPreservingFormat(content)
    : null;
  let generated = preserved;
  if (generated === null) {
    addOidsToAst(ast);
    generated = getContentFromAst(ast, content);
  }
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
  let className: ElementClassName = {
    ok: false,
    reason: "unsupported-className-expression",
  };
  traverse(ast, {
    JSXElement(path: NodePath<T.JSXElement>) {
      if (getOidFromJsxElement(path.node.openingElement) !== oid) {
        return;
      }
      text = readNodeTextContent(path.node);
      className = readClassName(path.node);
      path.stop();
    },
  });

  return { ok: true, location, text, className };
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

/** Parser ranges for literal JSX IDs; strings, comments and JSX text are excluded. */
export function listOidAttributes(
  content: string,
): Array<{ oid: string; start: number; end: number }> | null {
  const ast = getAstFromContent(content);
  if (!ast) return null;
  const attributes: Array<{ oid: string; start: number; end: number }> = [];
  traverse(ast, {
    JSXOpeningElement(path: NodePath<T.JSXOpeningElement>) {
      for (const attribute of path.node.attributes) {
        if (
          attribute.type === "JSXAttribute" &&
          attribute.name.name === "data-oid" &&
          attribute.value?.type === "StringLiteral" &&
          typeof attribute.start === "number" &&
          typeof attribute.end === "number"
        )
          attributes.push({
            oid: attribute.value.value,
            start: attribute.start,
            end: attribute.end,
          });
      }
    },
  });
  return attributes;
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

/**
 * Sets the static text of one element. Splices only the text bytes when the
 * element's children have a simple shape; otherwise regenerates with
 * `previewPatch` and refuses (`unconfined-patch`) if that changed bytes
 * outside the element.
 */
export function editElementText(
  content: string,
  oid: string,
  text: string,
): ElementEditResult {
  const spliced = spliceElementText(content, oid, text);
  if (spliced.ok) {
    return {
      ok: true,
      original: content,
      generated: spliced.generated,
      strategy: "splice",
    };
  }
  if (spliced.reason !== "not-spliceable") {
    return { ok: false, reason: spliced.reason };
  }
  const range = elementRange(content, oid);
  const patched = previewPatch(content, { oid, textContent: text });
  if (!patched.ok) {
    return patched;
  }
  if (!range || !isConfinedEdit(content, patched.generated, ...range)) {
    return { ok: false, reason: "unconfined-patch" };
  }
  return {
    ok: true,
    original: content,
    generated: patched.generated,
    strategy: "regenerate",
  };
}

/**
 * Replaces the whole static `className` string of one element (empty
 * removes the attribute). Always a splice; never reformats the file.
 */
export function editElementClassName(
  content: string,
  oid: string,
  className: string,
): ElementEditResult {
  const spliced = spliceElementClassName(content, oid, className);
  if (!spliced.ok) {
    return {
      ok: false,
      reason:
        spliced.reason === "not-spliceable"
          ? "unconfined-patch"
          : spliced.reason,
    };
  }
  // JSX decodes HTML entities in attribute strings (`&amp;` → `&`): refuse a
  // value that would not read back exactly as written.
  const written = describeElement(spliced.generated, oid);
  const expected = className === "" ? null : className;
  if (
    !written.ok ||
    !written.className.ok ||
    written.className.value !== expected
  ) {
    return { ok: false, reason: "unsupported-className-value" };
  }
  return {
    ok: true,
    original: content,
    generated: spliced.generated,
    strategy: "splice",
  };
}

function elementRange(content: string, oid: string): [number, number] | null {
  const ast = getAstFromContent(content);
  if (!ast) {
    return null;
  }
  let range: [number, number] | null = null;
  traverse(ast, {
    JSXElement(path: NodePath<T.JSXElement>) {
      const { start, end } = path.node;
      if (
        getOidFromJsxElement(path.node.openingElement) === oid &&
        typeof start === "number" &&
        typeof end === "number"
      ) {
        range = [start, end];
        path.stop();
      }
    },
  });
  return range;
}
