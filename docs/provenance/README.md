# Provenance

Inspected Onlook research baseline: `onlook-dev/onlook` commit `423e2e924366419e418ee049093872d535eea41a`. Research clone: `/Users/jabbo/AllStudio/research/onlook` (outside this Git repository).

When Onlook (or other third-party code) is extracted, record for every incorporated module:

| Field | Required value |
|---|---|
| Upstream repository | Canonical URL |
| Commit SHA | Pinned revision |
| Upstream path | File or directory copied |
| Destination path | allstudio path |
| License | SPDX identifier and notice files |
| Modifications | Summary of allstudio changes |

## Extracted modules (Phase 1 source mapper)

Upstream: https://github.com/onlook-dev/onlook  
Commit: `423e2e924366419e418ee049093872d535eea41a`  
License: Apache-2.0 (Copyright 2024 On Off, Inc.)  
Destination package: `@allstudio/editor`

| Upstream path | Destination | Modifications |
|---|---|---|
| `packages/parser/src/packages.ts` | `packages/editor/src/source-mapper/babel.ts` | Parse/generate/traverse from `@babel/standalone`; type guards from `@babel/types` |
| `packages/parser/src/parse.ts` | `packages/editor/src/source-mapper/parse.ts` | Synchronous generate; id-stripping omitted |
| `packages/parser/src/helpers.ts` | `packages/editor/src/source-mapper/fragments.ts` | Fragment helper only |
| `packages/parser/src/ids.ts` | `packages/editor/src/source-mapper/ids.ts` | No branch-oid map; local uniqueness only |
| `packages/parser/src/code-edit/style.ts` | `packages/editor/src/source-mapper/style.ts` | Refuse expression `className`; `tailwind-merge` only |
| `packages/parser/src/code-edit/text.ts` | `packages/editor/src/source-mapper/text.ts` | Single-line text only (multiline refused); refuses expression/element children instead of editing the first `JSXText` |
| `packages/parser/src/template-node/map.ts` + `helpers.ts` | `packages/editor/src/source-mapper/locations.ts` | `SourceLocation` only; dynamic/core types omitted |
| `packages/utility/src/id.ts` (charset only) | `packages/editor/src/source-mapper/oid.ts` | `crypto.getRandomValues` instead of nanoid |
| `packages/constants/src/editor.ts` (`DATA_ONLOOK_ID`) | `packages/editor/src/source-mapper/types.ts` (`DATA_OID_ATTRIBUTE`) | Attribute name still `data-oid` |

Public API (`instrumentSource`, `locateSource`, `previewPatch`) is original allstudio code in `packages/editor/src/source-mapper/index.ts`.

Do not copy Onlook trademarks, `assets/`, UI, sandbox, or `EditorEngine`.
