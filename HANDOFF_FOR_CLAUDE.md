# Handoff for Claude Code — public `allstudio`

Open this directory as the repository root: `allstudio/`.

GitHub remote: `https://github.com/anthony-jabbour/allstudio.git` (public). The private cloud remote is `https://github.com/anthony-jabbour/allstudio-cloud.git`.

Do not open the parent `AllStudio/` folder as if it were the Git project. Do not import `../cloud` or `../allstudio-cloud`.

## Actual scaffold status

This repository is a **buildable foundation**, not a design editor.

| Area | Status |
|---|---|
| Bun workspace | Implemented |
| `@allstudio/editor` | Source mapper (`instrumentSource` / `locateSource` / `previewPatch` / `describeElement` / format-preserving `editElementText` + `editElementClassName`), preview bridge + protocol, `EditorShell` text + class edit UI |
| `@allstudio/project` | v1 manifest parse/validate only; schema not locked |
| `apps/playground` | Fixture picker; each fixture copy runs in an iframe; select heading/button/layout → edit text or className → JSX file write → hot reload (dev-only workspace adapter) |
| `examples/nextjs-site-fixture` | Aurora Atelier: minimal Next.js + Tailwind landing page |
| `examples/nested-components-fixture` | Lumen Notes: nested components, reused component, `.map()`, ternary, `&&` |
| `examples/tailwind-variants-fixture` | Harbor Studio: responsive/state/dark variants, `cn()`, template-literal className |
| `apps/desktop` | Connected local project workflow: preview-only IDs, real source saves, watch/conflicts, session history, recovery and packaged Mac evidence; founder Phase 2 gate pending |
| `packages/protocol` | Not created (wait for first cloud integration) |
| Onlook extraction | Parser slice in `@allstudio/editor`; preview bridge is original (see `docs/validation/PHASE-01.md`) |
| Electron | Connected workflow implemented on the Phase 2 branch; see `docs/validation/PHASE-02.md` |

## Implemented versus planned

Implemented: install/lint/typecheck/unit tests/public-boundary check/playground/fixtures; Phase 0 Onlook research report; Phase 1 source mapper; Phase 1 slice 2 browser text-edit loop; Phase 1 slice 3 three fixtures + class edits + format-preserving writes (`docs/validation/PHASE-01.md`).

Phase 1 is founder **PASS** (2026-10-25) on `main` @ `5f29824` (PRs #2–#8). Evidence: `docs/validation/PHASE-01.md` and `docs/validation/PHASE-01-REVIEW.md`. Phase 0 is also founder **PASS** (2026-10-25), via ADR-0002 option A. Phase 2 is **IN PROGRESS**: connected development and packaged Mac workflows executed, including restricted-network operation and real interrupted-save recovery. Recommendation is at most READY FOR HUMAN VALIDATION; no agent marks Phase 2 PASS. See `docs/validation/PHASE-02.md` and `apps/desktop/README.md`. Cloud may write it; the gate proof is a local Mac run. Ask before picking a packaging tool.

## Verified commands

Run from this repository root (`allstudio/`). Observed on 2026-10-24:

| Command | Result |
|---|---|
| `bun install` | exit 0; lockfile written; Bun 1.3.14 |
| `bun run lint` | exit 0 |
| `bun run typecheck` | exit 0 |
| `bun run test` | exit 0; Vitest 3.2.7; 15 tests passed |
| `bun run validate:public-boundary` | exit 0; 83 files scanned |
| `bun run build` | exit 0; playground Vite 7.3.7 + fixture Next.js 16.4.3 |
| `bun run dev` | playground listening at http://localhost:5173 |

Re-run on 2026-10-25 (Linux, Bun 1.4.4) for Phase 1 gate closure: `bun run test` 196 passed (9 files); typecheck, lint, boundary and build (playground + 3 fixtures) all exit 0. `ALLSTUDIO_RESET_WORKSPACE=1 bun run dev` serves the playground on :5173 and fixture previews on :3101/:3102/:3103. `node scripts/e2e/text-edit.e2e.mjs` 34 checks passed (trace + webm recording; needs a Playwright install outside the repo). With the dev server stopped, `node scripts/e2e/build-edited-workspaces.mjs` builds every edited copy.

## Blockers

- Package manager is **provisional** (Bun 1.3.14). Onlook pins 1.3.1. Founder may switch after the Onlook spike.
- v0.1 product docs still contain superseded statements. Use v0.2 architecture files when they conflict.
- External Onlook research clone: `/Users/jabbo/AllStudio/research/onlook` at `423e2e924366419e418ee049093872d535eea41a`. Do not merge that tree into this repo.

## Architecture decisions still awaiting approval

- Final package manager (Bun vs pnpm)
- Public npm scope availability for `@allstudio/*`
- Electron packaging tool
- Exact `.allstudio` project schema beyond the illustrative v1 type

## First recommended roadmap task

Phase 2: Electron and real local-first behavior. Open decisions that do not block starting Electron: Playwright in CI; select vs interact; packaging tool (ask before adopting).

Founder approved Phase 0 exit option A (`docs/decisions/ADR-0002-phase-0-exit.md`).
