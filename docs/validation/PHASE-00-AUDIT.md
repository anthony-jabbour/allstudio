# Phase 0 / Phase 1 slice — Independent audit

**Status:** HISTORICAL AUDIT RECORD — this audit did not approve a gate. Founder subsequently marked Phases 0 and 1 **PASS** (2026-10-25); see the phase validation reports.\
**Auditor:** Claude Code (independent of the Cursor implementation in PR #2)  
**Date:** 2026-10-25  
**Audited commit:** `main` @ `cf4bcd5bfbb718e6b1d7674d2ef9652309672d06` (PR #2 merge)  
**Onlook reference:** `anthony-jabbour/onlook-baseline` branch `baseline/423e2e9`, HEAD verified `423e2e924366419e418ee049093872d535eea41a` (shallow clone outside this repo; nothing copied in)  
**Environment:** Linux cloud container, Bun 1.4.4 (CI pins 1.3.14), Node v22.22.0

## 1. Commands executed on `cf4bcd5` (before corrections)

| Command | Exit | Observed output |
|---|---|---|
| `bun install --frozen-lockfile` | 0 | 143 packages installed |
| `bun run test` | 0 | Vitest 3.2.7 — 4 files, **20 passed** (source-mapper 11, editor-shell 2, manifest 5, public-boundary 2) |
| `bun run typecheck` | 0 | project, editor, playground, fixture all `Exited with code 0` |
| `bun run lint` | 0 | `Checked 41 files … No fixes applied.` |
| `bun run validate:public-boundary` | 0 | `Public boundary check passed (81 files scanned).` |
| `bun run build` | 0 | playground Vite build (JS chunk 3,550 kB, >500 kB warning); fixture Next.js 16.4.3 static build of `/` |
| GitHub Actions `quality` run 7 on `cf4bcd5` | success | Same five checks under Bun 1.3.14 |

`PHASE-01.md` and `HANDOFF_FOR_CLAUDE.md` recorded 15 tests / 83 files; those counts predate the later PR #2 review commits.

## 2. Upstream oracle check

A scratch script (outside the repo) ran allstudio `instrumentSource` on Onlook's `packages/parser/test/data/ids/*` fixtures and compared OID-sanitized output with upstream `expected.*`:

| Upstream case | Matches upstream output | Existing OIDs preserved |
|---|---|---|
| `adds-ids-to-jsx` | yes | n/a |
| `does-not-add-ids-if-exist` | yes | yes |

Provenance headers match the upstream files listed in `docs/provenance/README.md`. Upstream has no `NOTICE` file, and its `LICENSE.md` is Apache-2.0 with "Copyright 2024 On Off, Inc.". The upstream `updateNodeTextContent` uses the same "edit the first `JSXText`" logic, so the defect below was **inherited**, not introduced by the port.

## 3. Behavior probes beyond the committed tests

| Probe | Result on `cf4bcd5` |
|---|---|
| Re-instrument already-instrumented source | Identical (idempotent) |
| No-op `previewPatch` / empty `className` | Identical output |
| Instrument fixture page | **Reformats unrelated lines**: moves `>` onto attribute lines, appends `);` to `</main>`. Babel `retainLines` is not a formatter. |
| Heading text+class patch | Correct class merge and text; text collapses onto the opening-tag line |
| `<p>Hello {name}!</p>` → text "Bye" | **`ok: true`, produced `Bye{name}!`** — silent semantic corruption |
| `<p>{name}</p>` → text "Static" | **`ok: true`, produced `Static{name}`** |
| `<a><span>Icon</span> Label</a>` → text "New" | **`ok: true`, inserted `New` before `<span>`; `Label` kept** |
| Text containing `\n` | `ok: true`; React renders it as a space (contract says single-line only) |
| Same `data-oid` on two elements, un-instrumented input | **`ok: true`, silently edited the first match** |
| Conditional `a ? <b/> : <i/>` branch edit | Edits only the targeted branch (correct) |
| `.map()` list item | One oid for all rendered instances (by design; DOM→instance disambiguation needed in preview) |
| Template-literal `className` | Refused (`unsupported-className-expression`) |
| `md:` / `hover:` variants | `tailwind-merge` keeps unrelated variants and replaces conflicting ones |
| `const icon = <svg/>` inside `Page` | `component` reported as `"icon"` (same as upstream) |
| Custom component `<Button>` | Receives `data-oid`; it reaches the DOM only if the component forwards props |
| `instrumentSource` locations | `path` is always `untitled.tsx` (no filename option) |
| Changed-file / hash conflict | No `expectedHash` in `previewPatch`; not implemented |

## 4. Corrections in this branch

1. `updateNodeTextContent` fails closed. It returns `unsupported-dynamic-children` unless every child is static text, a string literal, or a JSX comment, and `unsupported-multiline-text` for `\n`. Comments are kept, and static text collapses into one child.
2. `previewPatch` returns `oid-ambiguous` when more than one element carries the oid.
3. `NOTICE` no longer says that no Onlook source was imported. It now attributes the adapted files.
4. Six regression tests were added. All six **fail on `cf4bcd5`** and pass after the fix: 26/26 total, 17 source-mapper.

Refusal rather than semantic-preserving editing follows RoadMap §1 rule 4 ("fail closed") and the Phase 1 gate wording ("preserve semantics **or** return a clear unsupported result"). The founder can choose to add preserving edits later.

## 5. Not verified / out of scope

- Any browser, iframe, DOM selection, preview refresh, or file write. No such code exists in allstudio yet.
- Onlook `bun test` (93/93 per PHASE-00) was **not re-run**. The oracle check above was used instead.
- Upstream full app (needs CodeSandbox/OpenRouter/Supabase keys). Not attempted, by design.
- Bun 1.3.14 locally. CI covers it.
