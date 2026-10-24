# ADR-0001 — Provisional public toolchain

- Status: **Provisional** (founder may replace before lock-in)
- Date: 2026-10-24
- Phase: repository scaffold / Roadmap Phase 0 harness

## Decision

Use a single Bun workspace for the public editor repository, with Biome for lint/format, Vitest for unit tests, Vite for the developer playground, and Next.js + Tailwind for the supported site fixture.

## Why

- The inspected Onlook monorepo uses Bun workspaces and pins `packageManager: bun@1.3.1`.
- This machine has Bun `1.3.14` installed.
- `REPOSITORY_ARCHITECTURE.md` v0.2 lists Bun as provisional, not locked.
- Next.js 16's `create-next-app` supports `--biome`, keeping one linter in the public repo.

## Verified candidates (2026-10-24)

| Tool | Canonical repo | Stars | License |
|---|---|---|---|
| Bun | https://github.com/oven-sh/bun | 96,386 | Other (Bun license) |
| Next.js | https://github.com/vercel/next.js | 143,216 | MIT |
| Vite | https://github.com/vitejs/vite | 83,512 | MIT |
| Vitest | https://github.com/vitest-dev/vitest | 17,278 | MIT |
| Biome | https://github.com/biomejs/biome | 25,990 | Apache-2.0 |

## Not chosen yet

- pnpm (installed locally as 11.22.0) remains a valid alternative if Onlook extraction is easier under pnpm.
- ESLint + Prettier (Onlook uses a private `@onlook/eslint` package). Revisit when extracting Onlook code.
- Electron Forge vs Builder: deferred until Phase 2.

## Consequences

Package manager, formatter, and test runner may change after the Onlook reproduction spike. Do not treat this ADR as a product lock.
