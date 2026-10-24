# Handoff for Claude Code — public `allstudio`

Open this directory as the repository root: `allstudio/`.

GitHub remote: `https://github.com/anthony-jabbour/allstudio.git` (public). The private cloud remote is `https://github.com/anthony-jabbour/allstudio-cloud.git`.

Do not open the parent `AllStudio/` folder as if it were the Git project. Do not import `../cloud` or `../allstudio-cloud`.

## Actual scaffold status

This repository is a **buildable foundation**, not a design editor.

| Area | Status |
|---|---|
| Bun workspace | Implemented |
| `@allstudio/editor` | Scaffold shell only |
| `@allstudio/project` | v1 manifest parse/validate only; schema not locked |
| `apps/playground` | Launches; imports workspace packages |
| `examples/nextjs-site-fixture` | Minimal Next.js + Tailwind site |
| `apps/desktop` | Not created (wait for Onlook proof) |
| `packages/protocol` | Not created (wait for first cloud integration) |
| Onlook extraction | Not started |
| Electron | Not started |

## Implemented versus planned

Implemented: install/lint/typecheck/unit tests/public-boundary check/playground/fixture.

Planned next, not started: Phase 0 Onlook reproduction in an **external** worktree/fork, then the smallest code-editing vertical slice in this repo.

## Verified commands

Run from this repository root (`allstudio/`). Observed on 2026-10-24:

| Command | Result |
|---|---|
| `bun install` | exit 0; lockfile written; Bun 1.3.14 |
| `bun run lint` | exit 0 |
| `bun run typecheck` | exit 0 |
| `bun run test` | exit 0; Vitest 3.2.7; 9 tests passed |
| `bun run validate:public-boundary` | exit 0; 65 files scanned |
| `bun run build` | exit 0; playground Vite 7.3.7 + fixture Next.js 16.4.3 |
| `bun run dev` | playground listening at http://localhost:5173 |

## Blockers

- Package manager is **provisional** (Bun 1.3.14). Onlook pins 1.3.1. Founder may switch after the Onlook spike.
- v0.1 product docs still contain superseded statements. Use v0.2 architecture files when they conflict.
- No Onlook checkout exists in this workspace.

## Architecture decisions still awaiting approval

- Final package manager (Bun vs pnpm)
- Public npm scope availability for `@allstudio/*`
- Electron packaging tool
- Exact `.allstudio` project schema beyond the illustrative v1 type

## First recommended roadmap task

**Phase 0: reproduce and validate Onlook's source-editing behavior.**

Pin `onlook-dev/onlook` (planning SHA `423e2e924366419e418ee049093872d535eea41a` — reconfirm), build it outside this repository, and trace DOM selection → source location → JSX/CSS mutation → preview refresh. Do not copy the upstream tree into `allstudio/` until that path is observed and provenance is recorded.

Do not start Phase 1+ implementation in this handoff.
