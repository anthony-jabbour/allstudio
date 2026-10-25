# Phase 01 — Validation report

**Status:** IN PROGRESS  
**Scope:** Smallest Onlook-derived source mapper inside `@allstudio/editor`  
**Branch:** `research/phase-0-onlook`  
**Founder decision:** ADR-0002 option A (2026-10-24)  
**This report does not mark the phase PASS.**

## User-observable outcome (this slice)

Call `@allstudio/editor` APIs on the Aurora Atelier fixture:

1. inject `data-oid`
2. resolve the `hero-heading` source location
3. preview a text + Tailwind class patch as a JSX string diff
4. refuse expression `className` edits without rewriting

Live canvas selection, preview refresh, and Electron are **not** in this slice.

## Founder approvals

- Phase 0 exit via documented CodeSandbox blocker + parser spike: **A**
- In-source `data-oid` during editing for Phase 1: default from ADR-0002

## Files changed

- `packages/editor/src/source-mapper/**`
- `packages/editor/src/index.ts` (re-exports)
- `packages/editor/tests/source-mapper.test.ts`
- `packages/editor/package.json` (Babel, tailwind-merge)
- `docs/provenance/README.md`
- `docs/decisions/ADR-0002-phase-0-exit.md`

## Tests run

Observed 2026-10-24 from `allstudio/`:

| Command | Result |
|---|---|
| `bun run test` | exit 0; Vitest 3.2.7; **15 passed** (6 new source-mapper tests) |
| `bun run typecheck` | exit 0 |
| `bun run lint` | exit 0 |
| `bun run validate:public-boundary` | exit 0; 83 files scanned |

## Real-world proof

`packages/editor/tests/source-mapper.test.ts` reads `examples/nextjs-site-fixture/src/app/page.tsx` and asserts:

- heading `component === "Home"` at line 7
- generated text `Aurora Atelier — edited`
- `text-emerald-700` replaces `text-zinc-950`
- `clsx("px-3")` className edits return `unsupported-className-expression`
- invalid source returns `parse-failed`
- unknown oid returns `oid-not-found`

The fixture file on disk is not modified.

## OSS candidates

| Tool | URL | Stars (2026-10-25) | License | Role |
|---|---|---|---|---|
| Onlook parser | https://github.com/onlook-dev/onlook | 27,003 | Apache-2.0 | Adapted source |
| Babel | https://github.com/babel/babel | 44,048 | MIT | AST parse/generate (`@babel/standalone` already in Onlook) |
| tailwind-merge | https://github.com/dcastil/tailwind-merge | 5,696 | MIT | Class conflict merge (already in Onlook) |

## REA

Not applicable. Extraction from public Apache-2.0 source already inspected in Phase 0.

## Negative / security / regression

- Expression `className` is refused (Onlook would append call arguments).
- Public-boundary scan passed.
- Editor shell scaffold tests still pass.
- No Electron, no iframe, no CodeSandbox.

## Not done (Phase 1 remaining)

- Live preview / DOM selection
- Three representative fixtures
- Conditional/expression text refusal
- Formatting preservation / Prettier
- Hash conflict (`expectedSha256`)
- Insert/move/remove structure edits
- Independent review + human demo of a running editor

## Gate recommendation

**IN PROGRESS** — parser slice is test-backed. Phase 1 gate is not met. **Not PASS.**
