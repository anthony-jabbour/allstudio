# allstudio

Open-core, local-first, web-native design studio. This is the **public Apache-2.0 editor** repository.

GitHub: [https://github.com/anthony-jabbour/allstudio](https://github.com/anthony-jabbour/allstudio)

The hosted product lives in a separate private repository ([anthony-jabbour/allstudio-cloud](https://github.com/anthony-jabbour/allstudio-cloud)). This editor must remain useful without allstudio cloud, Clerk, Railway, or any private package.

## Current status

This is a **scaffold**, not the product.

Implemented:

- Bun workspace with `@allstudio/editor` and `@allstudio/project`
- Browser playground for workspace/import verification
- Minimal Next.js + React + Tailwind fixture
- Lint, typecheck, unit tests, and a public-boundary check

Not implemented:

- Onlook source-editing
- Electron desktop app
- Creative boards
- Cloud protocol package
- AI, billing, or accounts

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
