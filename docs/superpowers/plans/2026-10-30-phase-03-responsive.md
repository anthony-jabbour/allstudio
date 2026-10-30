# Phase 3.5 Responsive Editing Implementation Plan

> **For agentic workers:** Execute core inline with superpowers:executing-plans and TDD; GPT-6 Luna extra-high handles bounded ancillary audits/docs. One fresh independent implementation review before the draft PR.

**Goal:** True390/768/1440 preview widths, accurate zoom/selection and source-safe breakpoint edits through all four inspectors, clear overrides, history and offline persistence.
**Architecture:** Extend existing source transforms with exact breakpoint selection; keep full source canonical and all other tokens byte-preserved. Use a shared transformed iframe/overlay pane, fixed viewport measurements and a bounded read-only default-breakpoint eligibility audit. Existing hash/atomic/history pipeline remains authoritative.
**Tech stack:** Existing React/TypeScript/Tailwind4.3.3, Babel, Electron native helper, Vitest and serial Playwright.
**Spec:** ../specs/2026-10-30-phase-03-responsive-design.md; founder chose A and approved bounded CSS/config metadata audit.

## Global Constraints

- Same checkout, feat/phase-03-responsive starts at7eeec3c, stacked on draft PR22; no worktree/clone/merge/force-push/review-bot post. Preserve untracked user files.
- Scopes Base/sm/md/lg/xl/2xl, default thresholds0/640/768/1024/1280/1536. Presets390/768/1024/1440; custom320–2560px; zoomFit/50/75/100%.
- Width preset/custom commit picks largest default scope at/below width. Visible scope selector allows override. Initial Desktop1440/100%/xl follows the same mapping. Zoom changes no source or scope.
- Exact variant-chain edits only. State/stacked/arbitrary/different scopes preserved. No inferred inheritance/default source values. Clear override only for non-Base, with shorthand companions retained.
- No new dependency, grant, Electron permission, arbitrary file read, binary access or cloud/Phase4/5 capability. Approved CSS/config audit is read-only/bounded under current grant and returns eligibility only.
- Preserve existing source limits, refusal, expected hashes, atomic saves, undo/recovery and untrusted preview boundaries. A saved but overridden/inactive result stays unconfirmed.
- One browser harness or Electron instance at a time. Fresh disposable playground copies; stop server before native tests. Use bun run test (Vitest).

## Review Focus

- Scope selection never mutates another scope or loses slash-leading, alpha, box-axis or size companions.
- Clear override removes only its property; ambiguous/important/unknown groups refuse, and unchanged output is unconfirmed.
- Width/scope transitions must guard unapplied or invalid drafts and never retarget them silently; pending saves block context switches.
- Shared scale must not double-scale overlay coordinates; real iframe width, both scrolling contexts, Fit resizing and hit testing require geometry proof.
- Unknown/custom/imported breakpoint configurations disable scoped writes; recheck eligibility on non-Base property requests, Base/manual class behavior preserved.

### Task1 — exact scope source transforms

**Files:** site/class-tokens.ts (scope helpers/constants), typography.ts, spacing.ts, appearance.ts, layout.ts; new tests/responsive-classes.test.ts.
**Interfaces:** EditBreakpoint enum union; scopedUtility(raw,scope) returns body only for exact selected scope (Base default), scopeUtilities(body,scope) adds the prefix to each generated companion token. Existing inspect/set helpers gain optional final scope argument default Base. Each family gets clear<PropertyFamily>Class(className,property,scope) returning the existing update union, non-Base only.

- [ ] Write failing tests for all four families at md, scope insertion/all six scopes, byte preservation, stacked/state isolation, no-op, important/ambiguous refusal and invalid scope.
- [ ] Implement minimal parser parameterization over original token ranges; do not mask/reformat unrelated source. Target utilities remain unprefixed validated bodies; raw source labels keep prefixes.
- [ ] Write/run RED clear tests: font-size slash→scoped leading companion, leading slash→size; p/gap axes retain companions; size width→height; remove appearance/display only; no Base clear or dynamic/ambiguous rewrites. Implement family removers using existing parsed matches/ranges.
- [ ] Run targeted helper and existing source tests, then full unit/type/lint. Commit task1.

### Task2 — default breakpoint eligibility inside existing grants

**Files:** site/breakpoints.ts + tests; desktop/native/files.c, main/native-files.ts, local-workspace.ts and typed requests/API/preload/main wiring; playground dev-workspace/workspace-api/client adapters; corresponding native/API tests.
**Interfaces:** getResponsiveCapabilities() returns bounded supported-defaults/unsupported/unavailable status with fixed reason, never CSS. Optional breakpoint on property ClassEditRequest; every non-Base preview/apply rechecks current default eligibility before invoking unchanged source edit pipeline.

- [ ] RED: pure audit accepts current fixture CSS/default package and rejects custom breakpoint/theme/config, plugins, unknown/import/escape/unsupported style sources; count/byte/path/encoding limits. Capture identical emitted CSS probe for default vs unused custom md to document why CSSOM alone is insufficient.
- [ ] RED: native helper cannot write CSS or list/read arbitrary paths, symlink/hardlink escapes or unbounded CSS; sender/schema/scope/unknown action negatives. Implement narrow readonly CSS/config metadata collection using existing descriptor protections, with source writes unchanged. Bound files/entries/bytes and imports; no renderer raw contents.
- [ ] Wire eligibility through both adapters. Recheck on non-Base requests so external custom-theme changes fail safely without writing JSX. Preserve old Base/manual behavior. Run metadata/native/API/type regressions; commit task2.

### Task3 — real viewport/zoom and scoped inspector integration

**Files:** shell/viewport-controls.tsx + pure viewport.ts/tests, editor-shell.tsx, four inspector/confirmation modules, studio.css, protocol/client only for fixed innerWidth/height; tests + e2e/responsive.e2e.mjs/native workflow.

- [ ] Browser RED:390/768/1440 widths and50% overlay geometry. Add controls, draft-safe transitions using existing route guard pattern, initial Desktop/100%/xl, visible scope chip and actual width/readout. Scale iframe+overlay together and size its scroll wrapper; Fit recomputes from available canvas dimensions, cap0.1–1 for legibility/no automatic enlargement.
- [ ] Pass scope through all fields and their source modes, invalid draft handling and combined confirmation. Add per-property Clear override actions. Removed overrides require source readback and observed change, with no fabricated fallback value. Show unsupported/default eligibility explicitly; keep text editing independent.
- [ ] Real browser proof: default scopes, create md override without existing token, clear companion-safe override, keep Base/lg/state bytes, three true widths with geometry,50%/75%/Fit scrolling/selection, draft cancellation and conflicts. Validate custom theme rejection and external change refusal.
- [ ] Native/packaged offline proof: scoped typography/spacing/appearance/layout, exact source diffs, undo/redo/restart; viewport changes do not write files. Existing seven browser harnesses run serially with explicit Base setup where needed; native fixtures/security/recovery regressions.

### Task4 — independent review and focused delivery

- [ ] Run available lint/type/Vitest/boundary/build/desktop/package checks and serial runtime matrix. No blocked or unrun command reported PASS; retain next/font/google offline-build limitation and unavailable subframe probe.
- [ ] Fresh independent review; fix demonstrated issues RED→GREEN. Append PHASE-03 exact evidence/source/screenshots/limits and user docs. No unfamiliar-user or assistive-technology gate fabricated.
- [ ] Commit/push focused responsive branch and draft PR on routes; attach it. Phase3 remains IN PROGRESS. Then3.6 B and3.7 A on their own branches, no merge.
