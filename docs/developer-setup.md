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

`bun run dev` also, for each of the three fixtures in `examples/`:

1. copies it into the git-ignored `apps/playground/.workspace/<id>` (first run
   only), inserts `data-oid` attributes into its `src/**/*.tsx` without
   reformatting anything else, and adds the preview bridge as
   `src/instrumentation-client.ts`;
2. starts that copy with `next dev`:

   | Fixture id | Source | Preview |
   |---|---|---|
   | `aurora-atelier` | `examples/nextjs-site-fixture` | <http://localhost:3101> |
   | `lumen-notes` | `examples/nested-components-fixture` | <http://localhost:3102> |
   | `harbor-studio` | `examples/tailwind-variants-fixture` | <http://localhost:3103> |

3. serves the development-only workspace API under
   `/__allstudio/workspace/<id>/`.

Edits from the playground are written to the workspace copies only. Start
over with `ALLSTUDIO_RESET_WORKSPACE=1 bun run dev` or by deleting
`apps/playground/.workspace/`.

### Editing walkthrough

1. Open <http://localhost:5173>, pick a fixture, and wait for "Preview bridge: connected".
2. Click a heading, button, or layout element in the preview. The panel shows
   its source file and lines, e.g. `src/components/new-note-button.tsx:3–9 in NewNoteButton`.
3. Edit **Text** (static text only) or **Classes** (the whole static
   `className` string). **Preview … patch** shows the diff without writing;
   **Apply …** writes it.
4. The status reads "Saved to … and the preview shows the new text/classes."
   Compare with the original, for example:
   `git diff --no-index examples/nested-components-fixture/src apps/playground/.workspace/lumen-notes/src`.
   Expect only the edit plus inserted ` data-oid="…"` attributes.

Disabled fields explain why. Examples: expression text (`{count} notes`),
expression `className` (`cn(…)`, template literals), or an element rendered
more than once (`.map()` items, reused components).

### Browser E2E (manual, needs Playwright)

Playwright is not a repository dependency (founder decision pending). With
`ALLSTUDIO_RESET_WORKSPACE=1 bun run dev` running (fresh copies) and a
Playwright + Chromium install on `NODE_PATH`:

```bash
node scripts/e2e/text-edit.e2e.mjs ./e2e-output
```

It writes `trace.zip` (open with `npx playwright show-trace`) and screenshots.

A fixture alone (unedited original, separate process):

```bash
bun run dev:fixture                                       # Aurora Atelier on :3001
bun --filter @allstudio/nested-components-fixture dev     # Lumen Notes on :3002
bun --filter @allstudio/tailwind-variants-fixture dev     # Harbor Studio on :3003
```

## Intentionally not built

- Electron desktop app
- `@allstudio/protocol`
- Onlook application/UI extraction (only the source-mapper slice is extracted)
- Cloud integration
- Creative boards
