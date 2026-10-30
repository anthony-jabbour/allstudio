# Phase 3.5 — responsive frames, device widths, zoom, breakpoint-scoped edits

Status: PROPOSED DESIGN — `BLOCKED — FOUNDER DECISION`. No production code changed.
Date: 2026-10-30. Base: `feat/phase-03-routes` (draft PR #22, stacked on #21).

## Research (parent-performed; the research subagent failed with a quota error)

- **OBSERVED (code):** the canvas is a fixed `.preview-pane { width: 1440px }` ([studio.css](../../../packages/editor/src/shell/studio.css)) containing one sandboxed iframe at `width: 100%`, so Tailwind media queries evaluate against a true 1440px layout viewport. All four property helpers (`typography`, `spacing`, `appearance`, `layout`) edit **Base tokens only** and preserve `sm:/md:/lg:` tokens byte-for-byte. Harbor `#hero` has `md:grid-cols-2 md:items-center lg:py-28`.
- **OBSERVED (docs):** typography/spacing specs explicitly defer "breakpoint-specific source controls and viewport/zoom tools" to 3.5. Plan gate scenario C: "three true widths + breakpoint-specific change → unrelated scope retained."
- **Onlook pin `423e2e92…` (27,042 stars, Apache-2.0, per earlier audit):** has a frame/viewport manager and style-edit-with-breakpoint concepts coupled to MobX and its sandbox. Rejected for extraction (same reasoning as 3.2b/3.4). No new dependency is needed: width presets are one CSS width, zoom is one CSS transform.
- **REA:** not installed/not used. Figma/Paper observations come only from founder screenshots (OBSERVED: zoom control in the right rail; INFERRED: many frames per canvas — not applicable here, D2 keeps one live preview).
- **No new OSS adoption proposed**, so the 1,000-star rule is not triggered.

## Proposed architecture (no fake device chrome)

1. **Width presets** change the real iframe width (Tailwind default breakpoints: sm 640, md 768, lg 1024, xl 1280, 2xl 1536; proposed presets Mobile 390, Tablet 768, Laptop 1024, Desktop 1440, plus custom px 320–2560). No device bezel. Projects with custom `screens` are UNSUPPORTED/labelled "Tailwind defaults assumed".
2. **Zoom** (Fit, 50, 75, 100%) is a CSS `transform: scale()` on the pane wrapper. Selection overlay rects arrive in iframe coordinates and must be multiplied by the scale; hit-testing stays inside the iframe. Source of truth is never preview DOM styles.
3. **Breakpoint-scoped edits** extend the four helpers with a `variant` parameter (`base | sm | md | lg | xl | 2xl`): read/replace only tokens whose variant chain exactly equals the target; other variants byte-preserved; stacked/state variants (`md:hover:`) are never touched. Confirmation compares computed style at a width at/above the breakpoint, else saved-but-unconfirmed.
4. **Protocol:** no new bridge fields expected (the iframe width alone drives media queries); one version bump only if the bridge must report `window.innerWidth` for confirmation.

## RED tests (when approved)

- `md:` edit on Harbor `#hero` rewrites only `md:` tokens; Base and `lg:` bytes identical.
- Editing at a breakpoint with no existing token inserts one token and leaves cascade-lower tokens untouched.
- Width change to 390/768/1440 yields measured `innerWidth` and different hero geometry (browser e2e, three true widths).
- Zoom 50% selection box matches element's scaled rect within 1px.

## Founder decisions needed

```text
Decision needed: How do the width control and the inspector's edit target (Base/sm/md/lg) relate?
Why it matters: Defines the core 3.5 UX; a wrong coupling silently writes edits to the wrong breakpoint.
What is known: Preview width is a true iframe width; all inspectors are Base-only today; Tailwind is mobile-first (md: applies at >=768).
Options:
  A. Coupled with explicit override: choosing a width preset sets the edit target to the largest breakpoint <= that width (390 -> Base, 768 -> md, 1440 -> xl-or-lg-nearest); a visible breakpoint chip in the inspector lets the user override. Fewer clicks, mirrors Figma-like "what you see is what you edit".
  B. Independent: width and edit-target are separate controls; inspector always shows the target chip (default Base) and warns when the target is hidden/overridden at the current width. More explicit, less magic, more clicks.
My recommendation: A, with the chip always visible and an inherited-vs-explicit indicator ("inherited from Base" / "set at md"), plus a "clear md override" action.
Blocked work: all of 3.5 implementation (canvas width/zoom chrome, variant parameter in typography/spacing/appearance/layout, inspector chip, e2e).
Secondary decisions: (1) preset list and breakpoints in scope (recommended: Base/sm/md/lg only first; xl/2xl later); (2) whether "clear override" is in the first slice (recommended: yes); (3) custom Tailwind `screens` unsupported (recommended: yes).
```
