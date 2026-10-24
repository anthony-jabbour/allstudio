# Developer setup (public editor)

## Requirements

Recorded on 2026-10-24 after local validation (update this file if versions change):

- Bun `1.3.14` (provisional; Onlook's inspected baseline pins `bun@1.3.1`)
- Node `v22.22.3` is available on this machine but the public workspace uses Bun
- macOS (this scaffold was created on Darwin)

Installed package versions after `bun install` on 2026-10-24:

- TypeScript `5.9.3`
- React / React DOM `19.3.0`
- Next.js `16.4.3`
- Vite `7.3.7`
- `@vitejs/plugin-react` `5.2.0`
- Vitest `3.2.7`
- Biome `2.4.2`
- Tailwind CSS `4.3.3`

Clone:

```bash
git clone https://github.com/anthony-jabbour/allstudio.git
cd allstudio
```

## Commands

From `allstudio/`:

```bash
bun install
bun run lint
bun run typecheck
bun run test
bun run validate:public-boundary
bun run dev
```

Playground: [http://localhost:5173](http://localhost:5173)

Supported fixture (separate process):

```bash
bun run dev:fixture
```

Fixture: [http://localhost:3000](http://localhost:3000)

## Intentionally not built

- Electron desktop app
- `@allstudio/protocol`
- Onlook extraction
- Cloud integration
- Creative boards
