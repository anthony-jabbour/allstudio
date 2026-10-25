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

Playground: [http://localhost:5173](http://localhost:5173) (use `localhost`, not `127.0.0.1`; the preview bridge only talks to this exact origin).

`bun run dev` also:

1. copies `examples/nextjs-site-fixture` into the git-ignored
   `apps/playground/.workspace/nextjs-site-fixture` (first run only),
   instruments its `src/app/*.tsx` with `data-oid`, and adds the preview bridge
   as `src/instrumentation-client.ts`;
2. starts that copy with `next dev` on [http://localhost:3101](http://localhost:3101);
3. serves the development-only workspace API under `/__allstudio/workspace/`.

Edits from the playground are written to the workspace copy only. Start over
with `ALLSTUDIO_RESET_WORKSPACE=1 bun run dev` or by deleting
`apps/playground/.workspace/`.

### Text-edit walkthrough

1. Open <http://localhost:5173> and wait for "Preview bridge: connected".
2. Click the heading "Aurora Atelier" in the preview.
3. The panel shows `src/app/page.tsx:7–12 in Home`. Edit the text.
4. **Preview patch** shows the diff without writing. **Apply** writes it.
5. The status reads "Saved to src/app/page.tsx and the preview shows the new text."
   Check the file: `git diff --no-index examples/nextjs-site-fixture/src/app/page.tsx apps/playground/.workspace/nextjs-site-fixture/src/app/page.tsx`.

### Browser E2E (manual, needs Playwright)

Playwright is not a repository dependency. With `bun run dev` running and a
Playwright + Chromium install on `NODE_PATH`:

```bash
node scripts/e2e/text-edit.e2e.mjs ./e2e-output
```

It writes `trace.zip` (open with `npx playwright show-trace`) and screenshots.

Supported fixture alone (separate process, unedited original):

```bash
bun run dev:fixture
```

Fixture: [http://localhost:3001](http://localhost:3001)

## Intentionally not built

- Electron desktop app
- `@allstudio/protocol`
- Onlook application/UI extraction (only the source-mapper slice is extracted)
- Cloud integration
- Creative boards
