# Phase 3 Studio evidence

Captured from the Electron local workflow on 2026-11-02. The screenshots show the actual app and local fixture, not mockups.

- `home-light.png`, `home-dark.png`, and `home-list-light.png`: local Recents in both themes and list mode.
- `studio-light.png`, `studio-dark.png`, and `studio-narrow.png`: the shared Studio in both themes and at a narrow window size.
- `assets-reopened.png`, `reorder-reopened.png`, and the `*-reopened.png` property captures: saved project after Electron quit/reopen.
- `layers-final.png`: fresh browser proof that a connected preview cannot activate mouse/keyboard button actions or navigate links.
- `browser-assets-final.png`: fresh browser proof for static `<img>` and `next/image` source association.
- `*-before.tsx.txt` and `*-after.tsx.txt`: exact fixture source before/after representative edits, including typography, spacing, appearance, layout, reorder, assets, and responsive changes.
- `standalone-build.log`: the edited workspace build outside Electron.

Fresh native verification after the final preview bridge/security fixes: `bun run test:local` — **39 local-workflow checks passed**. The suite checked source diffs, rendered output, undo/redo, persistence after restart, offline reopen, recovery, asset association for `<img>` and `next/image`, local project Home, and IPC/preview boundaries. The subframe IPC probe is unavailable and remains an explicit limitation.

The browser asset suite passed both image cases; the layers suite passed 14 checks, including the click/navigation isolation regression. Unit test `apps/playground/tests/asset-confinement.test.ts` exercises a real temporary symlink swap during `lstat` and confirms outside file metadata is never returned.

Raw Playwright trace archives were kept out of this public evidence directory because they contain local absolute paths and temporary workspace session tokens. The screenshots, actual before/after source snapshots, and exact test counts remain here; the original trace archives remain in ignored local test output.
