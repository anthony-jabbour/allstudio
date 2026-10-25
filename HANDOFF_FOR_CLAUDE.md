# Handoff for Claude Code — public `allstudio`

Open this directory as the repository root: `allstudio/`.

GitHub remote: `https://github.com/anthony-jabbour/allstudio.git` (public). The private cloud remote is `https://github.com/anthony-jabbour/allstudio-cloud.git`.

Do not open the parent `AllStudio/` folder as if it were the Git project. Do not import `../cloud` or `../allstudio-cloud`.

## Actual scaffold status

This repository is a **buildable foundation**, not a design editor.

| Area | Status |
|---|---|
| Bun workspace | Implemented |
| `@allstudio/editor` | Scaffold shell + source mapper (`instrumentSource` / `locateSource` / `previewPatch`) |
| `@allstudio/project` | v1 manifest parse/validate only; schema not locked |
| `apps/playground` | Launches; imports workspace packages |
| `examples/nextjs-site-fixture` | Minimal Next.js + Tailwind site |
| `apps/desktop` | Not created (wait for Onlook proof) |
| `packages/protocol` | Not created (wait for first cloud integration) |
| Onlook extraction | Parser slice in `@allstudio/editor` (see `docs/validation/PHASE-01.md`) |
| Electron | Not started |

## Implemented versus planned

Implemented: install/lint/typecheck/unit tests/public-boundary check/playground/fixture; Phase 0 Onlook research report; Phase 1 source mapper in `@allstudio/editor`.

Planned next: preview/DOM selection slice. Do not start Electron until that path is proven.

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

Continue Phase 1: attach the source mapper to a real preview (select rendered element → oid → `previewPatch` → refresh). Do not start Electron yet.

Founder approved Phase 0 exit option A (`docs/decisions/ADR-0002-phase-0-exit.md`).
