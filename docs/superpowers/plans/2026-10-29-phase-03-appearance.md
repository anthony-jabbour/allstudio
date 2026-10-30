# Phase 3.4b Appearance Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline for core implementation; one independent final branch review.

**Goal:** Real source-backed background colour and uniform radius editing, exact patches, rendered confirmation, undo/redo and offline persistence.
**Architecture:** Extend the approved shared source-draft pipeline with a pure appearance transform and fixed selected measurement record. Reuse typography colour/alpha helpers. No new engine, dependency, native capability or competing design document.
**Tech Stack:** Existing TypeScript/React19/Tailwind4.3.3/Electron/Vitest/Playwright.
**Spec:** ../specs/2026-10-29-phase-03-spacing-layout-design.md, founder approved 2026-10-29.

## Global Constraints

- Same active checkout on feat/phase-03-appearance, stacked on spacing PR #19 (`d7e7d46`); no worktree/clone/merge.
- Base-only scope, preserve every other variant/unrelated utility/whitespace. Static literals only; hash/path/AST/history/recovery authority unchanged.
- Background sRGB hex/preset with slash/hex alpha retained; uniform radius 0–2048px, at most 3 decimals. Images, gradients, hover/focus and per-corner radii are preserved, not rewritten.
- Source versus observed values remain distinct; no phantom black/zero, no save on blur, no cascade rewrite/rollback. Strict bounded messages; preview remains untrusted.
- Layout/sizing remain 3.4c. Entire 3.4 stays open until that follow-up exists.

## Review Focus

- Harbor `#harbor-cta` Base colour/radius edits must retain `hover:bg-sky-500` and focus-visible bytes.
- Mixed corners, unknown `bg-*` tokens, important/variable/arbitrary properties fail closed for the affected group only.
- A background image or gradient, same rendered value, or CSS override never yields false visual success.
- Partial hex entry, invalid drafts and external class-draft A/B/A remain synchronized without phantom writes.
- Colour-mix alpha cannot use naive RGB string equality.

### Task 1 — pure appearance source model

**Files:** create site/appearance.ts and tests/appearance.test.ts; extract shared colour/alpha helpers from typography.ts into site/color-tokens.ts with existing typography regressions.
**Produces:** AppearanceProperty = backgroundColor|borderRadius. inspectAppearanceClasses(className) returns per-property value/unset/unsupported/ambiguous state. setAppearanceClass(className,property,utility) returns {ok:true,className}|{ok:false,message}.

- [x] Write failing desired tests: Harbor CTA `bg-sky-600`→`bg-[#112233]` retains hover/focus; `rounded-full`→`rounded-[12px]`; no-op exact bytes; preserve images/gradients/variants; fail closed on mixed corners/unknown bg/important/variables/range/precision.
- [x] Run tests and observe missing-module RED. Implement the smallest token-range model. Reuse parseColorUtility/normalizeHex. Preserve slash and hex alpha when only the colour changes.
- [x] Run helper + typography + spacing tests; assert retained companions and no broader formatting. Commit task 1.

### Task 2 — measured bridge and shared confirmation

**Files:** preview protocol/client and affected exports/tests/harness versions; shell/appearance-confirmation.ts and tests.
**Produces:** PreviewAppearance fixed nullable strings for backgroundColor, backgroundImage and borderRadius. Add fixed appearance record to selected snapshots, version 5; no layer-wide style reads. appearanceTargets(before,after,observed) returns changed expectations; observesAppearance requires actual change and literal match or observed project change. Image/gradient backgrounds stay unconfirmed.

- [x] Add missing/extra/type/length/null and wrong-version negative tests; observe RED.
- [x] Implement the three-field selected measurement with the existing 256-character cap. One getComputedStyle call feeds typography, spacing and appearance. Unavailable stays null.
- [x] Add confirmation tests for changed-only targets, uniform vs per-corner radius, colour-mix sRGB compare, hidden-by-image refusal and absent measurements. Run protocol/helper/type checks. Commit task 2.

### Task 3 — integrated Appearance inspector and proof

**Files:** shell/appearance-inspector.tsx, editor-shell.tsx, studio.css; e2e/appearance.e2e.mjs and extend native workflow; user/validation docs.
**Consumes:** Task 1 source settings and Task 2 strict measured/confirmation contract through current class-draft APIs.

- [x] Real browser RED: Harbor `#harbor-cta` Appearance controls absent; no file writes on draft/Preview. Implement two labeled native preset/custom fields, explicit mixed/unknown/unsupported source state and read-only observed values, grouped Appearance section with diff/Apply.
- [x] Extend pending-refresh guard to appearance targets via existing timeout/poll/history flow; preserve other drafts. Confirm hex `#112233` and radius 12px, retain hover/focus. Verify image-covered/overridden unconfirmed, stale/dynamic/repeated/invalid cases.
- [x] Native source/diff/render/undo/redo/full restart proof, packaged offline proof, three fixtures, prior spacing/typography/layer/browser/security/recovery regressions, keyboard/focus/themes/narrow UI. Full available lint/type/test/boundary/build/desktop/package commands; no blocked command marked PASS.
- [x] Independent final review; fix demonstrated findings with RED→GREEN. Record actual evidence and limitations in PHASE-03/user docs, commit and open focused stacked draft PR. Entire 3.4 remains open for layout/sizing 3.4c.
