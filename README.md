# allstudio

Open-core, local-first, web-native design studio. This is the **public Apache-2.0 editor** repository.

GitHub: [https://github.com/anthony-jabbour/allstudio](https://github.com/anthony-jabbour/allstudio)

The hosted product lives in a separate private repository ([anthony-jabbour/allstudio-cloud](https://github.com/anthony-jabbour/allstudio-cloud)). This editor must remain useful without allstudio cloud, Clerk, Railway, or any private package.

## Current status

Phases 0–2 are **PASS, founder-approved**. The public editor opens supported Next.js/React/Tailwind projects in Electron, selects elements in the live preview, applies supported text and class changes to real source files, saves, supports undo/redo, and reopens offline. See [Phase 0 validation](docs/validation/PHASE-00.md), [Phase 1 validation](docs/validation/PHASE-01.md), and [Phase 2 validation](docs/validation/PHASE-02.md).

Phase 3 is **IN PROGRESS** and has not passed its phase gate. The current stacked draft review changes contain the shared Studio shell, rendered layers with synchronized selection, and bounded source-backed typography and spacing controls. These implementations remain in draft review and are not merged to `main` as of 2026-10-29. See the [Phase 3 gate inventory](docs/research/phase-03-gate-inventory.md) for implemented evidence, remaining features and human gates, and a dated PR/CI snapshot.

This status does not claim Phase 4 boards, Phase 5 local AI/MCP, or private cloud capabilities in later roadmap phases.

## Setup

See [docs/developer-setup.md](./docs/developer-setup.md).

```bash
bun install
bun run test
bun run dev
```

## Documentation

v0.2 `CODEBASE_ARCHITECTURE.md` and `REPOSITORY_ARCHITECTURE.md` override conflicting statements in the older v0.1 `PRD.md`, `ARCHITECTURE.md`, `ONLOOK_INTEGRATION.md`, and `Techstack.md`. Those older files are preserved, not silently rewritten.

Start with `HANDOFF_FOR_CLAUDE.md` if you are an coding agent opening this repository.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
