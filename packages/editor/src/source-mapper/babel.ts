/**
 * Adapted from Onlook (Apache-2.0).
 * Upstream: https://github.com/onlook-dev/onlook
 * Commit: 423e2e924366419e418ee049093872d535eea41a
 * Source: packages/parser/src/packages.ts
 * Modifications: parse/generate/traverse from standalone; type guards from @babel/types.
 * Copyright 2024 On Off, Inc.
 */
import { packages } from "@babel/standalone";
import type { NodePath } from "@babel/traverse";
import type * as T from "@babel/types";
import * as t from "@babel/types";

export const { parse } = packages.parser;
export const { generate } = packages.generator;
export const traverse = packages.traverse.default as (
  parent: T.Node,
  opts: Record<string, unknown>,
) => void;
export { t };
export type { NodePath, T };
