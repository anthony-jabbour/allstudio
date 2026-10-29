# Phase 3.3 Typography Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; independent final review. Founder approved all six groups; do not ask again for their settled semantics.

**Goal:** Six safe visual typography controls with real source/diff/render/history/offline evidence.
**Architecture:** Pure Base-class inspection/update helper over existing class draft and SourceEditWorkspace. Fixed read-only selected typography snapshot, bounded confirmation, shared native React fields. No new dependency, native permission, font download or engine.
**Tech stack:** Existing TypeScript, React19, Tailwind4.3.3, Electron, Vitest and Playwright.
**Spec:** ../specs/2026-10-29-phase-03-typography-design.md.

## Global Constraints

- Same active checkout on feat/phase-03-typography, stacked on97f5bb4/#17; no worktree/clone/merge.
- Source files canonical; static class literals only. Preserve other scopes, unrelated classes/whitespace and explicit leading/alpha. No whole-string merge.
- Show source settings and last measured output separately. Absence of a utility is not proven inheritance. Never invent16px/400/black.
- Bounded literal inputs and fixed measured fields; hash/path/AST/readback/journal/history guards unchanged.
- Explicit diff/Apply, no save-on-blur or automatic rollback; unsupported/ambiguous/overridden results truthful.

## Review Focus

Size/slash leading, unknown arbitrary text/font classes, CSS compilation after class changes, responsive overrides, and draft/history/selection races. Tests below pin each.

### Task1: pure scoped transformations

**Files:** create packages/editor/src/site/typography.ts and tests/typography.test.ts.
**Produces:** TYPOGRAPHY_PROPERTIES and TypographyProperty; inspectTypographyClasses(className) returns per-property value/unset/unsupported/ambiguous state with raw utility, projected normalized value and rendered expectation; setTypographyClass(className,property,utility) returns updated static class string or fixed error. Target is a validated full Base utility, not arbitrary CSS.

- [ ] Write failing tests across all six groups: untouched variants/whitespace/duplicates; coupled slash leading; colours/alpha; presets/literals; unknown/important/ambiguous groups; numeric/hex injection; semantic no-op.
- [ ] Run tests to observe RED; implement minimum helper over token ranges, preserving exact unrelated bytes. Only normalize a requested target, never the whole source string.
- [ ] Run helper and prior source tests; confirm emitted representative utilities against installed compiler.

### Task2: measured preview contract

**Files:** protocol.ts, client.ts, shell exports and affected tests/harness versions.
**Produces:** required fixed typography record on selected snapshots with six bounded nullable strings, version3. No styles on tree rows or new native API.

- [ ] Write failing schema tests for missing/oversized/extra/invalid measured values and envelope/version protection.
- [ ] Add one selected-element getComputedStyle read and stylesheet-load refresh. Preserve layer dirty budgets and instance checks; no DOM style writes.
- [ ] Update every source producer/consumer/test and disposable preview runtime. Run protocol/type tests; malformed styles cannot affect source/write permission.

### Task3: inspector and real integration

**Files:** shell/typography-inspector.tsx, editor-shell.tsx, studio.css, tests and scripts/e2e/typography.e2e.mjs; extend existing desktop workflow.
**Consumes:** Task1 settings/expectations and Task2 measurements; current source location/hash/class draft/preview/apply APIs.

- [ ] Write failing actual font-size control scenario first. Show source preset/literal/unknown states and read-only measured values. Known project presets plus explicit numeric/hex modes; project font aliases only.
- [ ] Implement one source-backed font-size cycle, then all other five groups through the same helper/API. Preserve unsaved text drafts and manual class edits in the reviewed patch; unsupported properties remain explicit.
- [ ] Confirm requested changed properties, not class strings alone. Literal expectations use supported browser normalization; project presets report actual observation without fabricating default definitions. Bounded polling within existing HMR deadline; source-kept/unconfirmed feedback for overridden/equivalent/unavailable output.
- [ ] Verify all six through browser and Electron: exact source differences, actual computed CSS, no-op, negative/conflict/repeated/dynamic cases, source variants retained, undo/redo and packaged offline reopen. Keep earlier source/layers/security/recovery tests green and inspect both themes/keyboard/narrow layouts.
- [ ] Full lint/type/test/boundary/build/desktop/package checks; fresh independent review; record PHASE-03 and user docs. Commit focused changes and create stacked draft PR; no merge/phase PASS.
