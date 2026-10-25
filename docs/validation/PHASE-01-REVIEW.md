# Phase 1 — Independent source diff review

**Status:** REVIEW RECORD. Does not mark Phase 1 PASS. Founder gate approval required.  
**Date:** 2026-10-25  
**Reviewer:** a separate Claude agent instance, read-only. It did not write the
code under review and changed no repository files.  
**Scope:** `git diff 79c4c9d 32c8506 -- packages apps examples scripts` (65
files). This covers commits `cf4bcd5` (source mapper), `7bbd292` (fail-closed
text edits), `c178a2a` (preview → select → text edit loop) and `32c8506` (three
fixtures, className edits, format-preserving splice edits).

The reviewer read in full:

- `packages/editor/src/source-mapper/{splice,index,text,style,ids,parse}.ts`
- `apps/playground/dev/{dev-workspace,workspace-api,prepare-workspace,vite-plugin}.ts` and `apps/playground/vite.config.ts`
- `packages/editor/src/preview-bridge/{client,protocol}.ts`
- `packages/editor/src/shell/{editor-shell.tsx,use-preview-bridge.ts}`
- `packages/editor/src/site/source-edit-workspace.ts` and `apps/playground/src/workspace-client.ts`

It also ran `npx vitest run` four times, plus a scratch probe outside the
repository.

## Verdict

**No blocking issues found.** The reviewer could not trace any path that
writes outside the selected element, corrupts JSX, or drops a `data-oid`.
Refusals write nothing, and the workspace API's path, token and origin
checks hold.

## Findings and disposition

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | should-fix | `DevWorkspace.serialized` awaited path resolution before it joined the per-file queue, so concurrent applies could run out of call order. The concurrency test failed once. Safety was not affected: one write wins and the other gets `stale-file`. | **Fixed** (PR #6). The queue is now joined synchronously, keyed by the lexically validated path. A new deterministic test slows the first resolution: it fails before the fix and passes after. |
| 2 | minor | Invalid UTF-8 anywhere in a file would be rewritten as U+FFFD on write. | **Fixed** (PR #6). Such files are refused with `unsupported-encoding`, and a test checks the bytes are unchanged. |
| 3 | minor | `writeAtomically` replaces the inode (file mode, hardlinks), and there is a small TOCTOU window between `resolve` and `rename`. Exploiting it needs local write access to the workspace. | **Fixed** (PR #8). The temp file gets the original permission bits (chmod defeats the umask). Hard-linked files are refused (`path-rejected`). The path is resolved again just before `rename`, and a directory swapped for a symlink aborts the write; if the directory was moved elsewhere, its temp file stays in the moved directory (documented and tested). Three tests fail before the fix and pass after. A swap between that recheck and `rename` is still theoretically possible; closing it fully needs directory-handle-relative writes, which belong to the Phase 2 native file adapter. |
| 4 | minor | A text edit on a self-closing custom component (`<Foo />`) adds a `children` prop. The edit is confined and syntactically safe. | **Documented.** Custom components only reach the DOM with a `data-oid` when they forward props; the fixtures' components do not. |
| 5 | minor | `a&amp;b` was spliced verbatim; it was caught downstream as `invalid-patch`. `>` was refused, which blocked `[&>*]:p-2`. | **Fixed** (PR #6). The mapper now refuses values that do not read back exactly as written, and allows `&` and `>`. |
| 6 | minor | With duplicate `className` attributes, the first one was edited but React uses the last. | **Fixed** (PR #6). Duplicates are refused for both reading and editing. |
| 7 | note | The preview supplies the data behind the "preview shows the new …" confirmation, so a hostile page can fake it. It cannot cause a write: writes need a user click plus the server-side hash and token. | **Accepted** as a UX-trust limit; it is recorded here. |

### Test adequacy follow-ups

- `source-edit.test.ts` accepted either outcome for the regenerate fallback.
  **Fixed** in PR #6: it now pins `unconfined-patch`.
- `expectConfined` in `fixtures.test.ts` compares whole lines. Byte-level
  confinement is covered by exact-string assertions in `source-edit.test.ts`
  and `dev-workspace.test.ts`, and by the E2E's per-edit "one changed line
  inside the element" check.
- There is no unit test of the editor shell for forged `postMessage`s. The
  protocol is unit-tested, and the E2E covers it end to end (forged nonce
  from the preview frame, and a message from another window).

## Areas verified safe (from the report)

- **Splice confinement.** Only the located element's child or attribute
  ranges change. The located element must carry a unique oid. Dynamic
  children are refused. The regenerate fallback is gated by prefix/suffix
  equality (`isConfinedEdit`). `validatePatch` re-parses the result, checks
  the value, and checks that the multiset of oids is unchanged (AST
  `listOids`).
- **Path confinement.** Lexical rules (`..`, `.`, empty segments,
  absolute paths, backslashes, drive letters, NUL, `src/` only, `.tsx`/`.jsx`
  only) plus `realpath === join(root, path)`, which rejects every symlink.
  File size is capped. The source scan never follows symlinks.
- **Stale writes.** The sha256 is checked twice, and the write is a temp
  file with `wx` followed by a rename.
- **API.** POST only; exact `Origin`; `Sec-Fetch-Site` same-origin or
  absent; JSON content type; a timing-safe session token checked before the
  body is read; a 16 KB cap; exact-key bodies; regex-validated fields;
  extra URL segments rejected. CORS is off, and the preview runs on another
  origin.
- **Preview process.** Fixed argv; the env carries only PATH, HOME,
  NODE_ENV and telemetry-off; it binds to localhost.
- **Bridge and shell.** The editor checks origin, then the source window,
  then shape, then the nonce (24 random bytes), with bounded fields. The
  bridge checks the parent window, the origin and the nonce, and always
  posts with an explicit target origin. The iframe sandbox omits
  `allow-top-navigation`. Writes come only from user button clicks, and the
  path and hash come from the server, never from the preview.
