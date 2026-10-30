# Phase 3.4a Spacing Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline for core implementation; GPT-6 Luna extra-high for bounded ancillary audits; one independent final branch review.

**Goal:** Real source-backed margin/padding/gap editing, exact patches, rendered confirmation, undo/redo and offline persistence.
**Architecture:** Extend the approved shared source-draft pipeline with a pure spacing transform and fixed selected measurement record. No new engine, dependency, native capability or competing design document.
**Tech Stack:** Existing TypeScript/React19/Tailwind4.3.3/Electron/Vitest/Playwright.
**Spec:** ../specs/2026-10-29-phase-03-spacing-layout-design.md, founder approved2026-10-29.

## Global Constraints

- Same active checkout on feat/phase-03-spacing-layout; no worktree/clone. Stacked on typography PR18, no merge.
- Base-only scope, preserve every other variant/unrelated utility/whitespace. Static literals only; hash/path/AST/history/recovery authority unchanged.
- Padding/gap/radius0–2048px, margin−2048–2048px, at most3 decimals; auto only margin. Presets remain project-defined. Appearance/radius/layout/sizing are3.4b/c, not silently completed here.
- Source versus observed values remain distinct; no missing-value zero, no save on blur, no cascade rewrite/rollback. Strict bounded messages; preview remains untrusted.

## Review Focus

- Shorthand All→one axis must retain the other axis; axis→All must not corrupt source.
- Mixed All/axis, physical/logical, important/variable/arbitrary-property conflicts fail closed for affected groups.
- Same rendered value or inactive/responsive override never yields false visual success.
- Partial numeric entry, invalid drafts and external class-draft A/B/A remain synchronized without phantom writes.
- Vertical writing mode, direction, auto margins and row/column gap cannot be interpreted using fabricated defaults.

### Task1 — pure spacing source model

**Files:** create site/spacing.ts and tests/spacing.test.ts; extract only common top-level separator from typography.ts into site/class-tokens.ts with existing typography regressions.
**Produces:** SpacingProperty = padding|paddingInline|paddingBlock|margin|marginInline|marginBlock|gap|columnGap|rowGap. inspectSpacingClasses(className) returns per-property value/unset/mixed/unsupported state and projected utility/value/expectation. setSpacingClass(className,property,utility) returns {ok:true,className}|{ok:false,message}.

- [x] Write failing desired tests: `p-6` + Inline `px-8`→`px-8 py-6`; `gap-6` + row `gap-y-[12px]`→`gap-x-6 gap-y-[12px]`; axis values→All supported; no-op exact bytes; preserve variants/duplicates/whitespace; logical/physical conflicts, unknown/important/variables/arbitrary properties, auto/negative/range/precision/injection cases.
- [x] Run tests and observe missing-module RED. Implement the smallest token-range model, using explicit disjoint axis coverage rather than class order. Differing source values for the same axis or All+axis overlap are unsupported. All inspector may show mixed axes but an explicit All replacement is safe after validating those axes.
- [x] Run helper + typography + source mapper tests; assert retained companion values and no broader formatting. Commit task1.

### Task2 — measured bridge and shared confirmation

**Files:** preview protocol/client and affected exports/tests/harness versions; shell/spacing-confirmation.ts and tests.
**Produces:** PreviewSpacing fixed nullable strings for paddingInlineStart/End, paddingBlockStart/End, marginInlineStart/End, marginBlockStart/End, rowGap,columnGap plus display context. Add fixed spacing record to selected snapshots, version4; no layer-wide style reads. spacingTargets(before,after,observed) returns changed per-axis expectations; observesSpacing(observed,targets) requires actual change and literal match or observed project change.

- [x] Add missing/extra/type/length/null and wrong-version negative tests; observe RED.
- [x] Implement strict eleven-field selected measurement (ten spacing values plus display for active-gap confirmation) with existing256-character cap. One getComputedStyle call feeds typography and spacing. Unavailable stays null; schema/source/nonce/frame guards unchanged.
- [x] Add confirmation tests for shorthand companions, changed-only target comparison, unequal axis values, negative/auto/project values, unchanged overrides and absent measurements. Run protocol/helper/type checks. Commit task2.

### Task3 — integrated Spacing inspector and proof

**Files:** shell/spacing-inspector.tsx, editor-shell.tsx, studio.css; e2e/spacing.e2e.mjs and extend native workflow; user/validation docs.
**Consumes:** Task1 source settings and Task2 strict measured/confirmation contract through current class-draft APIs.

- [x] Real browser RED: Harbor #hero Inline padding control absent; no file writes on draft/Preview. Implement nine labeled native preset/custom fields, explicit mixed/unknown/unsupported source state and read-only observed axes, grouped Spacing section with diff/Apply. Share only useful existing field mechanics; no generic inspector framework.
- [x] Extend pending-refresh guard to spacing targets via existing timeout/poll/history flow; preserve other drafts. Confirm px literal32 on both actual inline sides and changed child geometry, preserve py20/lg28/md classes. Verify margin/auto/negative and row/column companion behavior, same-value override unconfirmed, stale/dynamic/repeated/invalid cases.
- [x] Native source/diff/render/undo/redo/full restart proof, packaged offline proof, three fixtures, prior typography/layer/browser/security/recovery regressions, keyboard/focus/themes/narrow UI. Full available lint/type/test/boundary/build/desktop/package commands; no blocked command marked PASS.
- [x] Independent final review; fix demonstrated findings with RED→GREEN. Record actual evidence and limitations in PHASE-03/user docs, commit and open focused stacked draft PR. Entire3.4 remains open for appearance and layout/sizing follow-ups.
