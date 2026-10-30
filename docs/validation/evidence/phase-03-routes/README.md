# Phase 03 — Slice 3.2b Static Route & Page Navigation Evidence

Browser and native E2E evidence captured during Slice 3.2b validation on 2026-10-30.

## Artifacts in this directory

- `routes-about.png` — Studio navigator Pages list and preview navigated to `/about`, with `#about-heading` edited to `"About Aurora Studio"` and persisted to `src/app/about/page.tsx`.
- `routes-draft-confirm.png` — Explicit inline draft-discard confirmation banner (`route-draft-confirm`: `Discard and switch` / `Keep editing`) when switching routes while an unsaved inspector draft is active.
- `measured.json` — Recorded static routes (`/`, `/about`), unsupported route (`/journal/[slug]`), and hostile route API rejection probes (`//evil.com` -> 400 `invalid-request`, `http://evil.com` -> 400 `invalid-request`, `/about/../secret` -> 400 `invalid-request`, `/journal/[slug]` -> 422 `route-unsupported`, `/missing` -> 404 `route-not-found`).
- `about-before.tsx.txt` — `src/app/about/page.tsx` before route-scoped text edit.
- `about-after.tsx.txt` — `src/app/about/page.tsx` after route-scoped text edit (`About Aurora Studio`).
