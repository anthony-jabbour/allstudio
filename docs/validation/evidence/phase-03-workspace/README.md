# Phase 3 Studio evidence

Captured from the Electron local workflow on 2026-11-02. The screenshots show the actual app and local fixture, not mockups.

- `home-light.png`, `home-dark.png`, and `home-list-light.png`: local Recents in both themes and list mode.
- `studio-light.png`, `studio-dark.png`, and `studio-narrow.png`: the shared Studio in both themes and at a narrow window size.
- `assets-reopened.png`, `reorder-reopened.png`, and the `*-reopened.png` property captures: saved project after Electron quit/reopen.
- `layers-final.png`: fresh browser proof that a connected preview cannot activate mouse/keyboard button actions or navigate links.
- `browser-assets-final.png`: fresh browser proof for static `<img>` and `next/image` source association.
- `*-before.tsx.txt` and `*-after.tsx.txt`: exact fixture source before/after representative edits, including typography, spacing, appearance, layout, reorder, assets, and responsive changes.
- `standalone-build.log`: the edited workspace build outside Electron.

The Home/Studio screenshots were captured before the persistent Electron-version/development footer was removed on 2026-11-03. They remain interaction and layout evidence, not current evidence of the final shell chrome. The latest GitHub Xvfb run skips window screenshots because an earlier screenshot capture timed out; no newer visual capture is available without opening Electron locally.

Fresh native verification after the final preview bridge/security fixes: `bun run test:local` — **39 local-workflow checks passed**. The suite checked source diffs, rendered output, undo/redo, persistence after restart, offline reopen, recovery, asset association for `<img>` and `next/image`, local project Home, and IPC/preview boundaries. The subframe IPC probe is unavailable and remains an explicit limitation.

The browser asset suite passed both image cases; the layers suite passed 14 checks, including the click/navigation isolation regression. Unit test `apps/playground/tests/asset-confinement.test.ts` exercises a real temporary symlink swap during `lstat` and confirms outside file metadata is never returned.

Raw Playwright trace archives were kept out of this public evidence directory because they contain local absolute paths and temporary workspace session tokens. The screenshots, actual before/after source snapshots, and exact test counts remain here; the original trace archives remain in ignored local test output.

GitHub run [41584536003](https://github.com/anthony-jabbour/allstudio/actions/runs/41584536003) passed 39 development and 39 packaged local-workflow checks, plus 6 packaged desktop/security checks on head `20ad19f`. GitHub Xvfb skips window screenshots because an earlier screenshot capture timed out at `spacing.png` after source/render assertions passed; `scripts/e2e/local-workflow.e2e.mjs` skips screenshots only when `CI=true`. No Electron app was opened locally for the latest verification.
