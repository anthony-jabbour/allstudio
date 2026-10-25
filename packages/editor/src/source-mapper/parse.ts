/**
 * Adapted from Onlook (Apache-2.0).
 * Upstream: https://github.com/onlook-dev/onlook
 * Commit: 423e2e924366419e418ee049093872d535eea41a
 * Source: packages/parser/src/parse.ts
 * Modifications: synchronous generate; id stripping omitted until export exists.
 * Copyright 2024 On Off, Inc.
 */
import { generate, parse, type T } from "./babel.ts";

export function getAstFromContent(content: string): T.File | null {
  try {
    return parse(content, {
      sourceType: "module",
      plugins: [
        "typescript",
        "jsx",
        ["decorators", { decoratorsBeforeExport: true }],
        "classStaticBlock",
        "dynamicImport",
        "importMeta",
      ],
    });
  } catch {
    return null;
  }
}

export function getContentFromAst(
  ast: T.File,
  originalContent: string,
): string {
  return generate(
    ast,
    {
      retainLines: true,
      compact: false,
      comments: true,
      concise: false,
      minified: false,
      jsonCompatibleStrings: false,
      shouldPrintComment: () => true,
      retainFunctionParens: true,
    },
    originalContent,
  ).code;
}
