# Phase 3 — baseline, gaps and dependency-ordered implementation

Status: IN PROGRESS. Slice 3.0 research/baseline complete; approved Slice 3.1 shell implemented, with runtime evidence in PHASE-03.
Date: 2026-10-27 (America/Los_Angeles).
Branch: `feat/phase-03-studio-foundation` in the existing `/Users/jabbo/AllStudio/allstudio` checkout.
Public HEAD / GitHub main: `d132d58ed70f2a38ea4af529144f5a051827aa36`.
Private HEAD / GitHub main: `10ef1d77b802e2fa61be2cd08ce849226b5f29da` (read-only verification; no cloud changes).

## Baseline and authority

Both remote heads were checked with `git ls-remote origin refs/heads/main`; neither advanced from the supplied commits. Public initial untracked paths: `.serena/`, `docs/phase 3 prompts.md`, `docs/research/phase-03-workspace-reuse.md`, `docs/superpowers/plans/2026-10-26-phase-03-workspace.md`. These remain untouched and excluded from this delivery. Cloud has pre-existing AGENTS/CLAUDE/Notion changes; they remain untouched. No clean-tree claim is made.

Read required AGENTS/CLAUDE, RoadMap, v0.2 architecture, design, PRD/system/Onlook/stack/handoff and Phase 1/2 validation context. Current source and passing behavior take precedence over stale “scaffold only” descriptions. Historical tests/gates were not rewritten. Current workspace policy supersedes older worktree instructions: use this checkout and a dedicated branch, never a separate worktree/clone.

Substantive contradictions:

- Old Onlook plan calls its Phase 3 “Cloud adapter and agent” and proposes many packages; RoadMap Phase 3 is Studio. No cloud or speculative packages.
- Older PRD makes transfer P1 and frames the product as website-only; v0.2 makes transfer P0 and separates site/board surfaces. Transfer and boards are not Phase 3 implementation work.
- Older architecture/stack label Electron and public licensing unsettled; v0.2 plus accepted Phase 2 settle those choices.
- Older research handoff directs a separate worktree; the current workspace policy wins.
- Older provenance says never copy UI while current request permits selective lawful reuse. No UI copying yet; revise provenance with an approved concrete extraction, not blanket permission.
- Light-only mockup direction is superseded by the founder's current screenshot-matching Home/Studio typography/layout/colors and both light/dark requirement. Exact competitor token/font values were not exported.

## Trace and reusable contracts

`EditorShell/SourceElementEditor` → `usePreviewBridge` → validated preview select snapshot → `SourceEditWorkspace.locate` → static `SourceElementInfo` + hash → preview/apply text/class request → narrow preload + main IPC validation → `LocalWorkspace.edit` → native byte-checked save/journal/history → Next HMR → bridge track/element response → source relookup and visible confirmation.

Retain `locate`, `previewTextEdit`, `applyTextEdit`, `previewClassEdit`, `applyClassEdit`, source patch/readback/confinement functions, preview-only instrumentation, session history, conflict/recovery and consented process runner. Native grants never move into shared React code. Preview snapshots are untrusted observations, not filesystem authority. Expected hash checks remain main-process enforced.

Source inventory inspected: shell and hook; source-mapper index/text/style/splice contract; protocol/client; desktop renderer/styles/shared API/preload; LocalWorkspace edit/history/watch/recovery boundaries; Projects lifecycle and script consent; preview-runner and security guards; playground adapters, three fixture layouts and regression harnesses. Not every upstream or desktop helper received exhaustive line-by-line review.

## Gap analysis

| Required outcome | Existing / executed baseline | Missing Phase 3 evidence |
|---|---|---|
| Open local source and persist | Real Electron source diff/HMR/reopen/recovery demonstrated | New Studio composition and Home states |
| Professional shared shell | Shared prototype text/class EditorShell | Toolbar, navigator/canvas/inspector layout and shared themes |
| Real layers | Selected element snapshot, OID + instance count | Bounded hierarchy, unique rendered instance IDs, tree selection requests, stale-generation handling |
| Visual properties | Safe full static class replacement | Property-specific scoped transforms; unknown/inherited and responsive semantics |
| Responsive workspace | Existing full iframe | Accurate 390/768/1440 layout widths, zoom/scroll overlay proof, breakpoint edit scope |
| Structural reorder | Babel mapping/splicing infrastructure | Deliberate eligibility rules, JSX sibling operation, key/comment preservation, real runtime proof |
| Assets | Native grant/security primitives | Bounded owned-asset listing/association contract; permissions and unsupported cases |
| Keyboard/feedback | Native buttons/inputs, save diff/status and host undo/redo | Tree keyboard behavior, focus management, context actions, shortcuts and palette contrast |
| Phase gate | Founder-passed Phases 0–2; rerun baseline | Scenarios A–G for new controls plus unfamiliar-user observations and founder approval |

## Slice execution plan

This refines the requested slices; it does not replace RoadMap gate definitions. Each implementation begins with a failing behavioral test and records exact evidence as produced. No deadlines or speculative packages.

| Slice / dependencies | Smallest user-visible outcome and allowed modules | Test and acceptance proof |
|---|---|---|
| 3.0 (now) | Research/recommendation/design map/plan and baseline; docs only | Canonical metadata/source references, actual baseline commands; independent design review |
| 3.1 after reviewed design | Same project opens in a shared professional Studio; Home uses existing recents/open; both themes. `editor/shell`, shared styles, desktop renderer, playground host, affected tests | First fail shell/accessibility/host checks; preserve Apply text/classes labels or update every harness caller deliberately. Real fixture edit → exact source → HMR → undo/redo/reopen. Theme must not reset drafts or alter project source |
| 3.2 after 3.1 (can prepare protocol test separately) | Real nested layers and bidirectional selection. `preview-bridge`, hook, shell tree and tests | First fail heading/button/container tree selection and reused-instance cases. Strict schema/size/depth/cycle/generation/nonce/origin/frame negatives. No native IPC extension |
| 3.2b after shell; separate route change from layer protocol | Navigate discovered supported static Next.js routes. Desktop main/shared/preload route contract, renderer adapter, shared Pages UI, playground adapter and matching tests | Enumerate bounded eligible routes inside current grant; refuse dynamic/catch-all/intercepted/ambiguous paths. First fail route switching with unsaved text/class drafts: preserve current route and draft until explicit discard/cancel. Validate route IDs against discovery, retain allowed preview origin, reject URLs/traversal/ungranted IDs. HMR/navigation invalidates selection generation; no arbitrary browser navigation or file reads |
| 3.3 after selection (first property may precede full tree) | Static typography control through existing class draft/apply, then size/weight/leading/alignment/color/safe font family | First fail one hero font-size operation; pure scope-preservation cases; real computed style + minimal source diff + restart; expand only after proof |
| 3.4 after property transform | Margin/padding/gap/background/radius/flex/grid/sizing in explicit supported subset | First fail section spacing/layout change; verify hover/dark/responsive preservation, negative ambiguity/no-op/stale-file, actual layout and undo |
| 3.5 viewport foundation alongside 3.1; responsive edits after 3.3 | Actual iframe sizes and zoom, selection alignment and selected breakpoint utilities | First fail innerWidth/geometry assertions at 390/768/1440 and scroll/zoom; breakpoint source diff + unrelated variant/runtime assertions. Preview width never silently sets edit scope |
| 3.6 after mapped identity and founder-reviewed eligibility | Visual move-before/after for proven static JSX siblings | First fail reorder fixture with keys/comments; refuse map/conditional/ambiguous/repeated targets; parse/build/preview, hash conflict, undo/redo/restart. No arbitrary dragging |
| 3.7 after bounded asset decision | Project-owned asset selection on supported static element, contextual actions, focus/keyboard and docs | First fail owned asset association end-to-end; traversal/symlink/ungranted/size/overwrite negatives. No import beyond approved grant. Packaged offline and user-task evidence |

Follow-up branches/PRs are created in this same checkout only after finishing a slice; never switch away from uncommitted user work. Keep research separate from runtime integration. Each slice receives independent review. No merge or phase PASS without founder approval.

## First implementation scope for review

Phase / criterion: 3.1; real fixture opens in professional shared shell and existing text/class writes persist.
User-visible result: screenshot-informed Studio hierarchy with original allstudio theme variables; both modes; same reliable project controls, source/diff/error states.
Allowed modules: shared shell/CSS and exports if required, desktop renderer/CSS, playground host/CSS, existing shell tests and E2E harness assertions. No main/preload/protocol/source-mapper edits needed for initial presentation.
Fixtures: all three existing real Next projects; Aurora first complete edit/reopen, nested/reused and Tailwind variants as regressions.
Dependency choice: none. Keep existing source and native pipeline. No copied upstream manager until the audit/proof justifies it.
Checks: lint/typecheck/unit/boundary; desktop and fixture builds; real Electron integration with source and screenshot proof; packaged offline; keyboard/focus/contrast in both themes. Preserve visible unsupported states; no fabricated tree or working-looking property controls.
Founder approved system appearance initially, local light/dark override and collapsible panels in this chat. A source-safe implementation must not silently decide later structural/asset permissions.

## Static route sub-slice boundary

The Layers bridge in 3.2 needs no native IPC extension. Pages discovery/navigation is a distinct 3.2b slice and must not be silently omitted or smuggled into that protocol. Discover static App Router page files only under the existing supported/granted project source scope, excluding dependency/build/secret directories; include route-group/duplicate and root-page fixtures. Unsupported dynamic/ambiguous patterns display a reason instead of guessed parameters. Main returns bounded discovered route identities, not generic filesystem listings. Navigating accepts only a current discovered identity and preserves the approved preview-origin restriction; stale identity fails closed. Any new route API schema/scan cap is reviewed with the actual implementation before adding privileged endpoints. No claim that source policy currently permits an existing route API.

Before navigating away with unsaved inspector fields, explicitly offer discard-and-navigate or cancel; cancel retains current iframe, selection and drafts. Do not save or discard silently. This is the proposed concrete interaction to review, consistent with Phase 2 cancellation guarantees. Browser playground needs equivalent disposable-fixture discovery/navigation evidence. Acceptance: two static fixture routes navigate safely, source edits target the selected route, unsupported route and hostile URL requests fail, and cancelled switching preserves drafts. A navigation UI without actual discovery/security proof does not pass.

## Gate scenarios and recording

A Hero: selected heading typography → minimal source diff → refreshed computed style → restart.
B Layout: section spacing/alignment → source diff → real geometry → undo.
C Responsive: three true widths + breakpoint-specific change → unrelated scope retained.
D Structure: static sibling reorder → valid JSX/runtime → undo/redo/persistence.
E Restart: saved source and appearance reopen offline in packaged app.
F Failures: expressions/reused instances/invalid inputs/stale hashes/external modifications refuse without source loss.
G Security: bounded bridge, isolated preview, scoped native grants, no privileged capability added for UI convenience.

Every case compares selection, inspector display, actual source, preview and persisted file. Exact commands/artifacts are maintained in [PHASE-03](../validation/PHASE-03.md). Existing baseline is not evidence that any new control works. User observations and founder gate remain pending.

## Related deliverables

- [Source inventories, metadata, reuse matrix](phase-03-open-source-editor-audit.md)
- [Architecture alternatives and two proof plans](phase-03-editor-architecture-recommendation.md)
- [Screenshot analysis and component/theme map](phase-03-design-reference-analysis.md)
- [Typography scope-preservation probes](phase-03-typography-transform.md)

Recommendation: READY FOR REVIEW for the research/design package; Phase 3 INCOMPLETE. Slice 3.1 implementation followed explicit founder approval; no dependency install, cloud change, new source transform or third-party asset copy occurred.
