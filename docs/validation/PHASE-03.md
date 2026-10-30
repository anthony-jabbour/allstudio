# Phase 03 — validation report

Status: IN PROGRESS — baseline and research only; no Phase 3 runtime slice accepted.
Date: 2026-10-27 (America/Los_Angeles).
Repository: public `anthony-jabbour/allstudio`.
Branch: `feat/phase-03-studio-foundation`.
Tested source baseline: `d132d58ed70f2a38ea4af529144f5a051827aa36`.
Environment: existing macOS arm64 workspace, Bun 1.3.14, Vitest 3.2.7; actual Electron development and unsigned Mac package.

## Executed baseline commands

All commands run from `/Users/jabbo/AllStudio/allstudio`. Production code unchanged.

| Command | Exit | Observed result |
|---|---:|---|
| `bun run lint` | 0 | 113 files checked; no fixes |
| `bun run typecheck` | 0 | project/editor/playground/three fixtures/desktop |
| `bun run test` | 0 | 224 tests, 14 files |
| `bun run validate:public-boundary` | 0 | 212 files scanned |
| `bun run build` | 0 | Playground and all three Next fixtures |
| `bun run build:desktop` | 0 | Main/preload/renderer/native runtime build |
| `bun run test:desktop` | 0 | Six development shell/security checks |
| `bun run test:local` | 0 | 19 actual connected local-workflow checks |
| `bun run package:desktop` | 0 | unsigned arm64 Mac app; stock icon; signing explicitly disabled |
| `node scripts/e2e/local-workflow.e2e.mjs apps/desktop/dist/mac-arm64/allstudio.app/Contents/MacOS/allstudio --offline` | 0 | 19 connected packaged restricted-network checks; offline production build explicitly NOT RUN |

Build logs captured locally at `/tmp/allstudio-phase03-{build,local,package}.log`; these temporary paths are not durable published artifacts. The connected workflow produced durable ignored local evidence under `apps/desktop/dist/local-workflow-XYKr74/`: `saved.png`, `interrupted.png`, `edit-trace.zip`, `reopen-trace.zip`, `recovery-trace.zip`, `requested-origins.json`, `standalone-build.log` and the real edited disposable project/profile.

The packaged restricted-network run produced `apps/desktop/dist/local-workflow-Ms1MPW/` with saved/interrupted screenshots and edit/reopen/recovery traces. It uses the existing harness's Electron network restrictions and macOS child egress denial while retaining loopback preview. Host networking was not changed. Its production `next build` was explicitly NOT RUN because of the known Google-font boundary. Temporary output: `/tmp/allstudio-phase03-offline.log`.

## Observed source/preview/regression behavior

Actual Apply saves original uninstrumented source and refreshes preview; source location matches selection. Explicit integration/script permission sequence runs. Cancelled integration, denied execution, failed replacement startup and cancelled chooser retain current project/draft. Session undo/redo modifies source and preview. Watcher reports external edits; stale saves preserve them. Quit/reopen retains source. Forced termination before commit retains original bytes, stops orphan preview and permits durable recovery while retaining an external change. Changed config invalidates remembered consent; cancellation executes no project code. Edited project builds outside Electron with wrapper inactive and without preview IDs.

Native picker/message-box answers are controlled by the existing harness; real writes, preview compilation, process termination, recovery and source checks are not mocked. This is not an unfamiliar-user/native-dialog usability study.

Security negatives exercised: preview lacks Node/native bridge and parent bridge access; unauthorized navigation/popups and asset traversal refused; another WebContents using real preload is denied; traversal, symlink/hardlink escape, config writes through source API and ungranted project IDs refused; no Clerk/Railway/model-provider requests. Actual subframe IPC probe reports **unavailable** under sandbox settings; pure guard tests cover the hypothetical sender. Do not call that unavailable probe a passing runtime attempt.

## Phase 3 evidence boundary

New shell/layers/typography/spacing/responsive/structural/assets operations: NOT IMPLEMENTED / NOT RUN.
Both-theme keyboard/focus/contrast and unfamiliar-user observations: NOT RUN.
Onlook/Penpot/FigCraft extraction fit tests: NOT RUN; selected upstream source inspected only.
REA runtime investigation: NOT PERFORMED; tools available, no supplied live CDP target. Paper MCP guide attempt returned “Paper Desktop isn't running”; no tokens/file/styles read.
No new privileges, dependencies, cloud code, Phase 4 board model or Phase 5 tools introduced.

Historical offline production-build limitation remains: `next/font/google` can fail in offline production builds; the editor does not rewrite project fonts. An online build pass does not remove this limitation. Physical power-loss, public signed/notarized distribution and other OS/architectures remain unproven.

## Founder direction and review

Founder explicitly requested screenshot-matching Paper-style layout/colors/typography and both light/dark modes, shared across Home/Studio. Exact Paper font/token values were not exported. Original theme values may approximate screenshots. Phase 2 script/config/storage decisions remain accepted.
Research/design documents are proposed in `docs/research/phase-03-*.md`. No founder approval of Phase 3 or implemented integration is recorded. Independent fresh read-only design reviewer identified one material gap: Pages navigation was not assigned a slice although the architecture anticipated a bounded native route API. Added separate 3.2b with main/preload/shared + playground/shared UI ownership, static route eligibility, hostile route validation, selection invalidation and explicit draft-discard/cancel behavior. Reviewer found no other material blocker for the initial shell. A read-only follow-up confirmed the route gap resolved and reported nothing important remaining for this design-review scope. Review did not rerun tests or independently verify upstream runtimes.

Recommendation: INCOMPLETE for Phase 3. Baseline passes do not close any new Phase 3 acceptance scenario. Founder retains exclusive phase-gate approval.

## Slice 3.1 authorization and baseline expansion

Founder answered “Approve and implement this slice (recommended)” to shared Paper-inspired Home/Studio, both themes, existing save pipeline, no new engines/dependencies, system default with local override and collapsible side panels. Implementation is authorized; phase approval remains separate.

Additional baseline commands: `ALLSTUDIO_FIXTURE=nested-components-fixture bun run test:local` and `ALLSTUDIO_FIXTURE=tailwind-variants-fixture bun run test:local`, each exit 0 with 19 checks. Evidence: `apps/desktop/dist/local-workflow-Vy3pMT/` and `apps/desktop/dist/local-workflow-GQP5oG/` respectively.

## Slice 3.1 — implemented shared Studio shell

Status: READY FOR REVIEW for the first shell; Phase 3 remains IN PROGRESS.
Founder approval: explicit “Approve and implement this slice (recommended)” in this chat, including system default, saved light/dark override, collapsible narrow-window panels and no new engine/dependency.

### Changed and demonstrated behavior

Shared EditorShell now provides compact allstudio/project/mode chrome, application appearance, navigator/canvas/inspector regions and explicit current capabilities. Original theme variables and CSS are exported from the editor package; desktop and browser consume the same implementation. Desktop Home displays searchable remembered local project references/cards and opens through existing grants. Cards use a generic original file glyph, not a fabricated website thumbnail.

Theme/panel controls preserve the mounted iframe, unsaved text/class drafts and source bytes. Local appearance survives restart. Existing static text/class Apply, source locations/diffs, HMR confirmation, undo/redo, conflicts, consent cancellation and recovery remain working. No source mapper/protocol/native permission change occurred. Host busy state keeps the editor body inert during native operations.

The preview uses a fixed **1440px desktop layout viewport** within the scrolling canvas. Explicit device widths/zoom remain Slice 3.5, not hidden fake controls. Shared app layout was tested at the original Electron window and 620px width; inspector inputs/actions remain keyboard reachable with no horizontal document overflow. The canvas itself scrolls to expose the wider website. This is an intentional initial limit.

### Executed checks on implementation

| Exact command | Exit / observed outcome |
|---|---|
| `bun run test -- packages/editor/tests/editor-shell.test.tsx` | RED first: two new missing-toolbar/host-slot failures; GREEN after implementation: five tests |
| `bun run lint` | 0; 115 files checked |
| `bun run typecheck` | 0; all seven package checks |
| `bun run test` | 0; 226 tests, 14 files |
| `bun run validate:public-boundary` | 0; 223 scanned files |
| `bun run build` | 0; playground + all three fixtures |
| `bun run build:desktop` | 0; actual main/preload/renderer/helper/runtime resources |
| `bun run test:desktop` | 0; six checks with appearance persistence added |
| `bun run test:local` | 0; 22 expanded checks; final development geometry evidence `apps/desktop/dist/local-workflow-XD1jEV/` |
| `bun run package:desktop` | 0; unsigned arm64 package |
| `node scripts/e2e/desktop.e2e.mjs apps/desktop/dist/mac-arm64/allstudio.app/Contents/MacOS/allstudio` | 0; six packaged shell/security checks |
| `node scripts/e2e/local-workflow.e2e.mjs apps/desktop/dist/mac-arm64/allstudio.app/Contents/MacOS/allstudio --offline` | 0; 22 expanded packaged restricted-network checks; evidence `apps/desktop/dist/local-workflow-v9Z3FA/` |
| `NODE_PATH=/Users/jabbo/AllStudio/allstudio/node_modules/.bun/@playwright+test@1.64.1/node_modules node scripts/e2e/text-edit.e2e.mjs /tmp/allstudio-phase03-browser-fresh` | 0; 34 checks across all three fixtures; trace, webm, actual per-edit source diffs and screenshots |
| `git diff --check` | 0 |

Browser plugin skill was unavailable; used the repository's installed Playwright/Electron harnesses. No package installation was needed. The older browser harness initially failed to resolve `playwright`; setting NODE_PATH to the already installed transitive package resolved it. A run against reused generated fixture copies then hit a legitimate no-op on an already-edited button; trace confirmed “No change: the text already matches.” Preserved those copies, ran against newly prepared disposable fixtures, and restored the preserved directory afterward. Fresh edited test copies are retained at `/tmp/allstudio-phase03-tested-workspaces`; no `examples/` source changed.

A genuine reviewer-found viewport regression was reproduced by a failing test: hiding the navigator changed iframe innerWidth from 714 to 924. Fixed the preview layout width to 1440; the same regression and overlay-edge checks now pass. An accidental duplicate theme-test block after hostile navigation was removed from the smoke harness; it was a test-authoring error, not a security-policy relaxation. Initial Biome accessibility findings were fixed with a semantic labeled section and explicit button types.

### Actual file, preview and visual evidence

Final packaged directory `apps/desktop/dist/local-workflow-v9Z3FA/` contains `studio-dark.png`, `studio-light.png`, `studio-narrow.png`, `home-dark.png`, `home-light.png`, saved/interrupted screenshots, edit/reopen/recovery traces and the real disposable project. Source Apply/reopen/security/recovery assertions ran against that project's `src/app/page.tsx`.

Browser evidence `/tmp/allstudio-phase03-browser-fresh/` contains `trace.zip`, a webm, loaded/applied and all-three-fixture screenshots, plus `page.tsx.diff`, `aurora-button-text.diff`, `aurora-heading-classes.diff`, `aurora-layout-classes.diff`, nested-component and Tailwind variant diffs. Text/class changes altered only intended lines, and the responsive class change visibly changed the grid from two to three columns. These are existing manual class operations, not a claim that a new visual layout inspector exists.

Direct view_image comparison inspected supplied Paper Studio/Home references and actual screenshots. Five comparison points: restrained dark surfaces, compact sans-serif chrome, sidebar/canvas/inspector hierarchy, project-grid spacing and visible focus/selection accents. Original allstudio identity and both modes are retained. Intentional differences: no copied Paper/Figma branding/images, no exact proprietary token/font export, no freeform rail/pen tools, no account/team/publish controls, generic file cards until real thumbnails exist, and only implemented text/class fields in the inspector. The result follows the approved hierarchy/direction; it is not pixel-identical or a full Figma implementation. No claim of exact font identity or automated WCAG certification.

### Independent implementation review

One fresh read-only implementation reviewer found the viewport P2 above. After the failing reproduction and fix, the reviewer confirmed it resolved and reported no remaining material finding. Review was static; the reviewer did not rerun runtime tests. Separate earlier research review identified the missing Pages sub-slice, which was fixed and re-reviewed. Neither reviewer approved the phase gate.

### Remaining gates and next slice

Real nested layers and bidirectional selection (3.2), static route navigation (3.2b), visual typography/property transforms (3.3/3.4), explicit viewport/zoom and breakpoint scope (3.5), sibling structure edits (3.6) and owned assets (3.7) remain unimplemented. Unfamiliar-user sessions and formal accessibility/contrast checks remain pending human validation. The unsigned package and historical offline production Google-font limitation remain unchanged.

No further founder choice blocks preparing bounded Layers work. Structural eligibility/UX and new asset permission/import contracts require review before those later implementations. No cloud, AI/MCP, boards or third-party runtime was added.

Recommendation: READY FOR REVIEW for Slice 3.1; INCOMPLETE for the Phase 3 gate. Do not merge or mark PASS without founder approval.

## Slice 3.2 — preparation (2026-10-28)

Branch `feat/phase-03-layers` starts at `92ac26d` in the same active checkout, stacked on draft PR #16. Main remains `d132d58`. No merge occurred. GitHub readback confirms both PR #16 `check` and `electron-smoke` completed SUCCESS against `92ac26dcf08a5ea9c4e6fb8412ba78d732fb8df2`.

Read-only live playground DOM inventory: Aurora 7 rendered source elements / 7 source IDs / maximum DOM depth 4; Lumen 28 / 21 / depth 7; Harbor 19 / 18 / depth 7. Existing nested/Tailwind fixtures therefore already exercise repeated rendered IDs. No source edits or new test fixtures were needed for this inventory.

Inspected pinned Onlook `apps/web/preload/script/api/dom.ts` and `packages/models/src/element/layers.ts` for tree traversal, direct-text labels and rendered/source identity separation. Proposal remains an original bounded collector/tree over the existing bridge; no upstream source was copied and no dependency/native capability selected. Design: `docs/superpowers/specs/2026-10-27-phase-03-layers-design.md`. Implementation and its behavior/security tests remain pending design approval; no production source changed in this preparation step.

Fresh read-only Slice 3.2 builder review raised two material design gaps: full-document uniqueness versus truncated tree counts, and selection outside the displayed tree. The design now explicitly preserves existing full-document selected-element instance counting outside the new collector traversal budget, never authorizes edits from partial tree counts, and displays outside-tree selection truthfully without highlighting another row. Reviewer follow-up confirmed both gaps resolved and reported nothing important remaining before design approval. The selected-element query's pre-existing unbounded runtime is explicitly unclaimed. No implementation/runtime proof yet.

## Independent typography research while Layers approval is pending (2026-10-28)

Executed 13 installed tailwind-merge 3.7.0 behavior probes; fixture Tailwind resolves 4.3.3. Whole-string font-size merging removes explicit line-height utilities and also normalizes unrelated duplicate utilities. Recorded actual inputs/results in `docs/research/phase-03-typography-probes.json` and analysis/reproduction in `phase-03-typography-transform.md`. Existing source-edit implementation is unchanged. These library observations support property-scoped token preservation and future rendered-style confirmation; they do not establish a working typography inspector. No runtime test suite was rerun for these docs-only observations.

## Slice 3.2 — rendered layers and synchronized selection

Status: READY FOR REVIEW for this slice; Phase 3 remains IN PROGRESS. Implementation/validation collected 2026-10-28; final artifact/readback review 2026-10-29. Founder explicitly approved the reviewed design with “Approve and implement Slice 3.2 (recommended).” Branch `feat/phase-03-layers` is stacked on unmerged PR #16 (`92ac26d`) in the existing checkout. No merge, new worktree, dependency or native permission.

### Actual behavior and changed boundaries

- Real instrumented DOM hierarchy appears in the shared navigator, with direct-text/aria-label/alt labels, nested expand/collapse and active selection. Uninstrumented wrappers are omitted; the parent is the nearest included DOM ancestor. This is a derived preview snapshot, not a canonical design document.
- Rendered node IDs are WeakMap-held identities separate from source OIDs. Canvas/tree selection uses the same source lookup and geometry. Reused component/list rows identify their own visible instance; editing one repeated instance remains refused.
- Tree supports one Tab stop, Up/Down, Left/Right, Home/End and Enter/Space. Disclosure/focus movement preserves drafts; selecting a different element keeps the existing canvas draft-discard behavior. Selected resolvable source context stays in the trusted inspector and row tooltip.
- Protocol version 2 adds sanitized bounded layer snapshots, strict generation/node-target selection and fixed errors. Existing exact-frame/origin/nonce checks remain. New limits: 1000 nodes, 10000 visited elements, 64 DOM levels, 80-character labels; identities remain bounded. Parent-before-child parsing rejects duplicate/cyclic/invalid parents. Truncation and outside-tree selection are explicit; stale layer requests retain current selection/drafts and cannot trigger source writes.
- Missing idle targets clear geometry and disable editing. Active apply/post-save confirmation retains the existing HMR deadline while a new source ID temporarily has no DOM target. Current save results still refresh hashes/source and observed preview before success.
- Layout-only scroll/resize remeasures the tracked target without recollecting an unchanged tree. Hierarchy/label/identity mutations mark collection dirty; every select-layer still recollects synchronously to reject stale targets.

Changed production files: `packages/editor/src/preview-bridge/{protocol,client}.ts`, `shell/{use-preview-bridge,editor-shell}.tsx|ts`, new `shell/layer-tree.tsx`, shared CSS and type exports. Test/harness files cover these changes. Source mapper, desktop main/preload/shared IPC, native file helper, grants and cloud remain unchanged. Onlook source was a behavior/reference inventory only; no third-party UI/algorithm source was copied. Tree/group semantics follow the [WAI-ARIA treeview pattern example](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/examples/treeview-navigation/); two narrowly justified Biome exceptions preserve list/group tree semantics. This is not assistive-technology certification.

### Commands and observed evidence

| Exact command | Observed result |
|---|---|
| `bun run test -- packages/editor/tests/preview-bridge.test.ts` | RED: 5 expected missing-contract/identity failures; GREEN: 44 protocol tests |
| `node scripts/e2e/layers.e2e.mjs` with `bun run dev` and disposable fixtures | RED: rendered tree absent; final GREEN: 13 real-browser scenarios across all three fixtures |
| `bun run lint` | exit 0, 119 files |
| `bun run typecheck` | exit 0, all seven package checks |
| `bun run test` | exit 0, 252 tests / 15 files; repeated after resumed final readback with the same result |
| `bun run validate:public-boundary` | exit 0, 232 files |
| `bun run build` | exit 0, playground and all three fixtures |
| `bun run build:desktop` and `bun run package:desktop` | exit 0, current unsigned arm64 Mac package |
| `bun run test:local` | 23 connected development checks; source/HMR/history/conflict/restart/recovery/security and initial tree selection |
| `ALLSTUDIO_FIXTURE=nested-components-fixture bun run test:local` | 23 checks, evidence `apps/desktop/dist/local-workflow-VgdD8b/` |
| `ALLSTUDIO_FIXTURE=tailwind-variants-fixture bun run test:local` | 23 checks, evidence `apps/desktop/dist/local-workflow-epge0t/` |
| `node scripts/e2e/local-workflow.e2e.mjs apps/desktop/dist/mac-arm64/allstudio.app/Contents/MacOS/allstudio --offline` | 23 packaged restricted-network checks, evidence `apps/desktop/dist/local-workflow-BIUPYh/`; offline production build explicitly NOT RUN |
| `node scripts/e2e/desktop.e2e.mjs apps/desktop/dist/mac-arm64/allstudio.app/Contents/MacOS/allstudio` | exit 0, six packaged shell/security checks, revalidated after resumed readback |
| `NODE_PATH=/Users/jabbo/AllStudio/allstudio/node_modules/.bun/@playwright+test@1.64.1/node_modules node scripts/e2e/text-edit.e2e.mjs /tmp/allstudio-layers-regression-fresh` | all 34 prior browser checks across three fixtures; no examples source changed |
| `git diff --check` | exit 0 |

Long-running integration process handles had expired when the turn resumed. Their completed PASS summaries, traces/screenshots and saved fixture files were inspected; the original PTY exit status was no longer retrievable for those completed runs. No live job was restarted based on an observation timeout. The final unit and packaged shell commands were rerun with fresh exit 0 results. Build/package child logs explicitly record exit 0. The integration outcomes above report the actual scenario summaries rather than inventing a recovered PTY exit status.

### Reproduced defects and corrections

1. Desktop HMR race: a newly saved source OID briefly disappeared before the refreshed DOM arrived. The first connected run saved real source but cancelled confirmation as an idle missing selection. Preserved the current apply/pending confirmation path while keeping genuinely removed idle targets disabled. The connected and packaged workflows then completed all 23 checks.
2. Collector overhead: a real scroll probe with 1000 extra DOM nodes observed 1014 source-attribute reads from needless recollection. Dirty classification removed this added hierarchy scan; the 13-scenario layer suite verifies the bound. This does not benchmark or bound the pre-existing whole-document selected-element uniqueness query.
3. Harness precision: parent treeitem boxes contain descendants; row activation tests now click the parent's own visible row. The old Fixture label locator became ambiguous with legitimate layer text and now targets the combobox. Forged-message tests were upgraded to protocol 2. No trust checks were relaxed.

### Source, preview and visual proof

Layer-specific evidence: `/var/folders/hr/xvx1mh7d68nfwk82tdspn3380000gn/T/allstudio-layers-e2e-3Lhpx5/` contains `layers.png`, `source-before.tsx`, `source-after.tsx` and `trace.zip`. The screenshot shows the same edited heading in the tree, actual preview and source inspector, with an exact source diff. The 13 scenarios cover heading/button/container selection, keyboard/draft preservation, real save/HMR, stale/malformed requests, escaped DOM labels, reused components/map instances, other fixture compatibility, node/depth/visit truncation, duplicate source targets outside the displayed tree and idle target removal.

Final packaged evidence `apps/desktop/dist/local-workflow-BIUPYh/` includes both theme Studio/Home screenshots, narrow-window proof, saved/interrupted screenshots, edit/reopen/recovery traces and real project files. Its final heading is **Recovered local edit**, as asserted after interrupted-save restoration; it is not expected to remain the earlier Saved locally checkpoint. Actual JSX contains no preview-only instrumentation. The two additional native fixture directories above likewise retain their tested source and traces.

Prior browser regression evidence `/tmp/allstudio-layers-regression-fresh/` contains `trace.zip`, webm, three-fixture screenshots and 11 per-edit source diffs. Those exercise existing manual text/class edits, not new visual typography/layout controls. User-facing docs now explain the rendered subset, tree keyboard behavior and explicit limits.

Direct screenshot review inspected packaged dark/light active tree states and the actual browser source-diff/HMR state. Tree nesting, selected-row contrast, inspector context, canvas outline and theme spacing are visible. Exact Paper font/token fidelity and formal screen-reader behavior remain unclaimed.

### Independent review, compatibility and remaining limits

A fresh read-only implementation reviewer reported no actionable P1/P2/P3 findings after checking protocol/identity/generation limits, repeated-instance refusal, HMR and tree keyboard behavior. Final delta review also found no actionable issue in dirty collection or row-focus styling. Reviews were static; reviewers did not execute runtime tests or approve the phase.

Protocol 1 cached playground runtime copies are incompatible by design; regenerate disposable `.workspace` copies after preserving any fixture edits (`ALLSTUDIO_RESET_WORKSPACE=1 bun run dev`). Actual Electron previews bundle matching version 2 runtime and require no new user source markers. Prior local fixture sources were preserved/restored for this task, refreshing only generated bridge files that exactly matched the old pinned bridge. Edited test fixture copies remain under `/tmp/allstudio-layers-01k2x1hy/`. No real user project or earlier-phase evidence was reset.

The selected-element whole-document uniqueness query remains outside the new collector budget, as founder-approved; no hard total selection-runtime bound is claimed. New collector/transport limits are explicit, and partial tree counts never authorize edits. Only source-identified DOM nodes are shown; dynamic/unmapped/ambiguous edits still fail through existing workspace validation. Unfamiliar-user sessions, formal contrast/assistive-technology checks, signed distribution and physical power-loss remain pending. The historical offline production `next/font/google` limitation remains unchanged.

Recommendation: READY FOR REVIEW for Slice 3.2; INCOMPLETE for Phase 3. Next unimplemented slices: static route navigation (3.2b), visual typography and spacing/layout controls (3.3–3.4), device/zoom/breakpoint tools (3.5), structural edits and assets (3.6–3.7). No merge or phase PASS authorized.
