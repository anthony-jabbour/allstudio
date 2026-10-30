# Phase 3.7 — project-owned assets (view / select / associate)

Status: PROPOSED DESIGN — `BLOCKED — FOUNDER DECISION`. No production code changed.
Date: 2026-10-30. Base: `feat/phase-03-routes`.

## Scope boundary

Read existing project-owned asset files only (e.g. `public/*.svg|png|jpg|webp`), show them in an Assets panel, let the user select one, and apply it to a supported source association. **Not in scope:** import/upload, native file picker, any new filesystem grant, remote assets, asset optimization.

## Research (parent-performed)

- **OBSERVED:** the fixture project has `public/{file,globe,next,vercel,window}.svg`. Desktop already lists project files through the existing consented `NativeFiles.list()` grant; playground uses `DevWorkspace.listSourceFiles()`. Neither currently exposes binary content to the renderer.
- **Gap (needs decision):** previewing thumbnails needs byte access to asset files. The preview server already serves `public/` to the iframe, so thumbnails could be shown via the already-approved loopback preview URL (`<img src=previewOrigin/asset.svg>`) with **no new IPC or grant**. The editor shell (privileged) must not load arbitrary file URLs itself.
- **Supported source association candidates (static only):** `<img src="/x.svg">` or `next/image` `src="/x.svg"` string-literal attribute. Dynamic/imported (`import img from`) assets are refused.
- **No new dependency proposed.** REA not used. Onlook pin has an image manager coupled to its sandbox/MobX; not extractable.

## Proposed slice (smallest)

1. Assets list: derived from the existing file listing filtered to `public/**` with an allowlisted extension set (`svg png jpg jpeg webp gif avif`), size/count bounded. Route/IPC addition limited to extending the existing list result (no new permission).
2. Thumbnails: `<img>` pointing at the preview origin path (loopback, already allowed in the editor CSP only if `img-src` is extended — to be verified; otherwise show name/size only).
3. Apply: when a static `<img>`/`next/image` element is selected, "Use asset" rewrites only the literal `src` string via the existing hash-checked class/attribute edit path; refuse if `src` is an expression, `srcSet` conflicts, or `alt` is absent (surface alt as a prompt, never invent it).
4. Confirmation: after HMR the element's `currentSrc` ends with the new path, else saved-but-unconfirmed.

## RED tests

- Listing filters out non-allowlisted, traversal (`../`), symlink escapes, oversized counts.
- `src` literal replacement byte diff on a fixture `<img>`; refusal on expression `src`.
- Undo/redo/reopen; negative: asset path outside `public/`.

## Founder decisions needed

```text
Decision needed: What may the Assets panel read and show in the first slice?
Why it matters: Thumbnails could require widening the editor CSP or adding a binary-read capability; either is a security-boundary change.
What is known: Asset names/paths are already obtainable through the existing consented file list; the preview origin already serves public/; no import/picker is approved.
Options:
  A. Names + paths + type/size list only (no thumbnails), plus "Use asset" on selected static <img>/next/image.
  B. A plus thumbnails via loopback preview URLs (requires verifying/extending the editor's img-src policy to the loopback preview origin only).
My recommendation: A for the first slice; B after a separate CSP review.
Blocked work: implementation of 3.7 (site/assets.ts, list extension, shell Assets panel, src-edit helper, e2e).
Secondary: (1) whether import/upload is a later separate slice (recommended: yes, own decision + grant); (2) whether `next/image` string-literal src is in scope with `<img>` (recommended: yes).
```
