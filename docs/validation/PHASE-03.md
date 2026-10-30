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

## Slice 3.3 — research and reviewed design (2026-10-29)

Branch `feat/phase-03-typography` starts at `97f5bb4` in the existing checkout, stacked on draft PR #17. Current remote main remains `d132d58`; #17 quality/Electron checks are SUCCESS and no merge/review comments were observed.

Read additional pinned Onlook typography controls/hook source and inspected the current SourceEditWorkspace/snapshot contracts. Executed and captured11 installed Tailwind4.3.3 compiler candidates, then reproduced their exact CSS with assertions. Coupled size/leading can be retained through supported static utility syntax; colour-alpha compiles through oklab colour-mix, so naive RGB string equality is insufficient. See `phase-03-typography-compiler-probe.json` and the approved-boundary research note. No runtime/property-control/cascade/persistence result is claimed from compiler output.

A complete proposed six-group design is recorded at `docs/superpowers/specs/2026-10-29-phase-03-typography-design.md`. A fresh independent local builder review found no material planning gaps; no implementation or runtime tests were run by the reviewer. Design approval requested before changing production code. Base scope preserves other variants; actual breakpoint tools remain3.5.

Reason cloud capability checks returned login_required, account/workspace null and no scopes, with billing/compute not checked. A generic pairing login link was supplied privately so the user can select/approve the intended workspace. No account/workspace was chosen silently and no cloud task, paid run, activation or purchase occurred. Local review completed the independent design check.

Status: IN PROGRESS — design ready for founder review; no typography production code changed yet.


## Slice 3.3 — source-backed typography implementation (2026-10-29)

Status: **READY FOR REVIEW for Slice 3.3; Phase 3 remains IN PROGRESS.** Founder approved the linked six-group design with “Approve and implement Slice 3.3 (recommended).” Active checkout branch `feat/phase-03-typography`, stacked on unmerged #17 (`97f5bb434d6ac5c371f0337e9c52238976b265d8`). Remote main rechecked at `d132d58ed70f2a38ea4af529144f5a051827aa36`; private cloud head is `10ef1d77b802e2fa61be2cd08ce849226b5f29da`. No cloud files, native permissions, dependency/lockfile, mapper or filesystem adapter changed. Earlier preparation status above is historical.

### Implemented behavior and boundaries

The shared inspector edits six Base typography groups: size, weight, line height, alignment, sRGB hex text colour and existing project sans/serif/mono aliases. Pure token-range transformations retain unrelated classes, whitespace, responsive/state variants, explicit size/leading coupling and colour alpha. Unsupported/ambiguous groups refuse editing. Dynamic classes and repeated rendered instances remain read-only. Source settings and last observed CSS are distinct; missing utilities do not imply inherited/default values.

Preview protocol v3 adds exactly six bounded nullable measured strings on selected elements, with strict key/type/length validation. There is no layer-wide computed-style scan, new IPC endpoint, path or native capability. Existing nonce/origin/window/schema/instance checks remain. The inspector uses the existing class draft, diff/Apply, expected hash, atomic write, journal and history pipeline. Source is never saved on blur; unsaved text drafts survive typography Apply. Literal confirmation requires changed measured output matching the request; project presets require observed change without assuming default definitions. Equivalent, unavailable or CSS-overridden output retains source and reports rendering unconfirmed after the existing bounded refresh deadline, with Undo available.

### Executed verification

| Exact command | Observed final result |
|---|---|
| `bun run lint` | exit 0, no issues |
| `bun run typecheck` | all seven workspace checks exit 0 |
| `bun run test` | 17 files, 301 tests passed |
| `bun run validate:public-boundary` | exit 0 |
| `bun run build` | playground and all three Next.js fixtures exit 0, online |
| `bun run build:desktop` | exit 0 |
| `bun run package:desktop` | exit 0, unsigned Mac arm64 package |
| `bun run test:desktop` | 6 development checks passed |
| `node scripts/e2e/desktop.e2e.mjs apps/desktop/dist/mac-arm64/allstudio.app/Contents/MacOS/allstudio` | 6 packaged checks passed |
| `bun run test:local` | 26 native checks passed, including six-property source/render proof, undo/redo and typography quit/reopen |
| `ALLSTUDIO_FIXTURE=nested-components-fixture bun run test:local` | 23 checks passed |
| `ALLSTUDIO_FIXTURE=tailwind-variants-fixture bun run test:local` | 23 checks passed |
| `node scripts/e2e/local-workflow.e2e.mjs apps/desktop/dist/mac-arm64/allstudio.app/Contents/MacOS/allstudio --offline` | 26 packaged offline checks passed with OS preview egress denied; typography source and appearance survive full quit/reopen |
| `node scripts/e2e/typography.e2e.mjs` with `bun run dev` and disposable copies | 10 real-browser scenarios passed |
| `NODE_PATH=/Users/jabbo/AllStudio/allstudio/node_modules/.bun/@playwright+test@1.64.1/node_modules node scripts/e2e/text-edit.e2e.mjs /tmp/allstudio-typography-browser-regression` | all 34 prior browser checks passed, three fixtures, no examples source changed |
| `node scripts/e2e/layers.e2e.mjs` | all 13 layer scenarios passed, including typography refusal for repeated instances |

RED was observed for the missing typography module/inspector, new measured schema tests, unknown-colour alpha incorrectly blocking size, unchanged literal output incorrectly confirming success, typed hex mutating its own shorthand alpha, and stale custom-input synchronization after manual Classes A/B/A changes. Each received a focused fix and final GREEN proof. A cold-start harness click before bridge connection initially lost selection; the harness now waits for the real connected state before clicking (also after reload/reopen/fixture switch). The first font-alias assertion wrongly assumed the system monospace name; inspection showed the project uses Geist Mono, so the assertion now checks the actual project alias. The offline production build remains **NOT RUN** in the offline harness; historical `next/font/google` offline failure is unchanged. A subframe native IPC probe remains **unavailable**, not evidence of a successful denial; renderer/main-frame guards and real preview capability attacks passed their available checks.

### Source, rendered and persistence evidence

Committed review evidence is under [evidence/phase-03-typography](evidence/phase-03-typography/): six-property screenshot, overridden/unconfirmed screenshot, dark/narrow screenshot, offline reopened screenshot, exact before/after TSX snapshots and command logs. Browser source changes only `text-5xl`→`text-[36px]`, `font-semibold`→`font-bold`, `leading-tight`→`leading-[1.5]`, `text-zinc-950`→`text-[#112233]`, plus `text-center font-mono`; unrelated JSX and the unapplied text draft remain intact. Actual selected-heading CSS: 36px, 700, 54px, center, rgb(17,34,51), project Geist Mono. No-op retained inode/mtime. CSS `!important` override kept the source edit but correctly withheld visual confirmation. Harbor Base size edit retained `sm:text-5xl lg:text-6xl`, rendered60px at1440px, and reported unconfirmed. A stale hash preserved external bytes.

Full traces remain local: typography `/var/folders/hr/xvx1mh7d68nfwk82tdspn3380000gn/T/allstudio-typography-e2e-Cl9I7Q/trace.zip`; browser regression `/tmp/allstudio-typography-browser-regression/trace.zip` plus webm/diffs; layers `/var/folders/hr/xvx1mh7d68nfwk82tdspn3380000gn/T/allstudio-layers-e2e-14EMPd/trace.zip`. Native evidence directories: online `apps/desktop/dist/local-workflow-oNV4cs`, packaged offline `local-workflow-KLJpVF`, nested `local-workflow-wG2Mj2`; variants `local-workflow-9ws4OD`. Disposable edited playground copies retained at `/tmp/allstudio-typography-noo8czhc/edited-workspaces`. Pre-existing copies restored, only byte-recognized generated v2 bridge files refreshed to v3, existing JSX untouched.

### Independent review, security and remaining gates

Fresh local read-only reviewer found three P2 issues (hex input normalization, unchanged-output confirmation and stale draft marker). All were reproduced/fixed; final re-review reported no additional actionable findings and independently ran93 helper/confirmation/protocol tests successfully. It did not substitute for founder review or runtime proof. Selected measurements stay untrusted and bounded; no preview native privilege, Electron security policy or filesystem grant changed. Existing path/hardlink/symlink/hash/conflict/recovery tests and layer dirty-scan budgets pass.

Remaining: founder review of this stacked slice and current PR head; unfamiliar-user and assistive-technology sessions remain pending human validation. Exact downloaded font availability and wide-gamut colour fidelity are not claimed. Breakpoint-specific tools, spacing/layout, structural editing and assets remain unimplemented slices3.4–3.7; static route navigation also remains pending. The next recommended slice is a reviewed source-safe spacing/layout design using this same draft/diff/hash/history/measurement flow. No new engine or permission decision is required by Slice3.3. Phase gate remains INCOMPLETE; no merge or PASS authorized.

### Typography review-stack readback and documentation audit

Draft [PR #18](https://github.com/anthony-jabbour/allstudio/pull/18) opened stacked on #17; source head `2ea702cae970924c5e0a7be9579474cc4666a93f` had quality and Electron smoke SUCCESS, last completion2026-10-30T03:52:57Z. No merge. User requested GPT-6 Luna at extra-high for bounded ancillary tasks; it updated the stale root README and prepared `docs/research/phase-03-gate-inventory.md`. Parent checked its diff and roadmap scope, corrected structural/asset wording to avoid new requirements, and refreshed CI against the exact head. Its link/diff checks and the parent lint check passed. This documentation audit does not certify the phase or replace runtime evidence.

## Slice 3.4 preparation — spacing, appearance and layout

Status: IN PROGRESS, proposed design awaiting founder approval; no spacing/layout production code. In the same active checkout, `feat/phase-03-spacing-layout` starts at typography documentation head `14d1216`. Existing approved Onlook pin423e2e9 was re-inspected for spacing controls and engine coupling; missing upstream numbers rendered as zero, which does not satisfy our unknown/source semantics. Canonical observed metadata: Onlook27,042stars Apache-2.0 and existing tailwind-merge5,701stars MIT on2026-10-29Pacific. No new library selected or installed. Official Tailwind spacing/sizing docs were consulted.

Executed installed Tailwind4.3.3 compiler proof for22 spacing/layout candidates and reproduced its exact output with assertions. `px`/`py` are logical axes, `size` couples width/height, and background slash alpha uses colour-mix. Compiler JSON and research are `docs/research/phase-03-spacing-layout-*`. This does not establish a visual control, cascade correctness or persistence. Proposed three-PR3.4a/b/c design covers the complete requested spacing/appearance/layout set and retains source/hash/history/unsupported boundaries. Fresh read-only GPT-6 Luna extra-high builder check found no material unanswered implementation question. No REA run, new permission or architecture change. Research docs pass lint/diff checks; implementation/runtime tests for3.4 remain NOT RUN.


## Slice 3.4a — real source-backed spacing (2026-10-29 Pacific)

**Status: READY FOR REVIEW for Slice 3.4a; Phase 3 and the full3.4 feature remain IN PROGRESS.** Founder approved the reviewed3.4 design with “Approve and implement Slice 3.4 (recommended).” Branch `feat/phase-03-spacing-layout` in the same active checkout starts at typography documentation head `14d1216`. Source implementation commits: `01b7ce0` scoped transformations, `a456313` measured protocol/confirmation, `2792ce2` shared inspector and actual save integration. No worktree, clone, new dependency, native permission, source-of-truth change, cloud edit, Phase4/5 feature or merge.

### What works

Nine controls cover margin/padding All/Inline/Block and gap All/Columns/Rows. Known source values, mixed/unset/unsupported states and actual last-observed logical sides are separate. Finite literals are bounded to padding/gap0–2048px, margin−2048–2048px, three decimals; margin supports auto and project presets remain project-defined. Shorthand expansion preserves its companion: `p-6`→`px-8 py-6`; `gap-6`→`gap-x-6 gap-y-[12px]`. Unrelated source bytes/whitespace, utilities and responsive/state scopes remain intact. Known unequal disjoint axes can be explicitly replaced with All; overlapping, physical/logical, important, variable/custom and arbitrary-property conflicts refuse the affected family.

The shared inspector keeps transient drafts and uses the unchanged SourceEditWorkspace/className hash/splice/atomic/history/recovery path. Preview and Apply are explicit, blur never writes. Typography and spacing drafts can share a patch; invalid fields block both design Apply buttons. Collapsing the Spacing section preserves its draft. Mixed changes confirm both groups. Source-kept/unconfirmed feedback preserves Undo when a responsive rule overrides the request or rendered output stays unchanged.

Protocol v4 adds a strict selected-only spacing record: ten spacing values plus display. The latter was required by a demonstrated inactive-gap failure: block elements can expose a changed computed row/column gap while gap is inactive. Display now prevents false success. One existing `getComputedStyle` read feeds both records; each fixed field is nullable and limited to256 characters, unknown keys/types/missing fields are rejected. No styles are collected on layer rows; no arbitrary keys/paths/native operations are exposed. Earlier version3 generated browser runtimes must be refreshed/reset; only byte-recognized editor-generated files were updated during restoration.

### Exact executed checks and results

| Command | Final observed result |
|---|---|
| `bun run lint` | exit0, no issues |
| `bun run typecheck` | seven workspace checks exit0 |
| `bun run test` | 346 tests /19 files passed |
| `bun run validate:public-boundary` | exit0 |
| `bun run build` | playground and all three fixtures exit0, online |
| `bun run build:desktop` | exit0 |
| `bun run package:desktop` | exit0, unsigned Mac arm64 |
| `bun run test:desktop` | 6 development security checks passed |
| `node scripts/e2e/desktop.e2e.mjs apps/desktop/dist/mac-arm64/allstudio.app/Contents/MacOS/allstudio` | 6 packaged security checks passed |
| `bun run test:local` | 29 native workflows passed, including exact spacing diff/render/undo/redo and full quit/reopen |
| `ALLSTUDIO_FIXTURE=nested-components-fixture bun run test:local` | 23 checks passed |
| `ALLSTUDIO_FIXTURE=tailwind-variants-fixture bun run test:local` | 23 checks passed |
| `node scripts/e2e/local-workflow.e2e.mjs apps/desktop/dist/mac-arm64/allstudio.app/Contents/MacOS/allstudio --offline` | 29 packaged offline workflows passed; OS preview egress denied and parent secret absent |
| `node scripts/e2e/spacing.e2e.mjs` against disposable `bun run dev` copies | 12 isolated real-browser scenarios passed |
| `node scripts/e2e/typography.e2e.mjs` against fresh copies | all 10 prior typography scenarios passed, run serially |
| `NODE_PATH=/Users/jabbo/AllStudio/allstudio/node_modules/.bun/@playwright+test@1.64.1/node_modules node scripts/e2e/text-edit.e2e.mjs /tmp/allstudio-spacing-browser-regression` | all 34 prior text/class scenarios passed, three fixtures; no examples source changed |
| `node scripts/e2e/layers.e2e.mjs` | all 13 layer scenarios passed, including repeated-instance spacing refusal |
| `env -i PATH="$PATH" NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 CI=1 node node_modules/next/dist/bin/next build` in the final saved native project `apps/desktop/dist/local-workflow-evAE66/project` | exit0; generated HTML retains final `text-[36px] p-[16px]`, recovered heading and no preview OIDs |
| `git diff --check` | clean |

RED was observed for the absent spacing module, absent Spacing region, new selected-record schemas (9 failed/52 passed before implementation), absent confirmation module, and a new inactive-block-gap regression. Final unit/functional runs above are GREEN. A cold selection test interacted with old enabled controls before the new source lookup settled; it now waits for the selected source class before touching the heading's fields. A focused draft-only check reproduced the correct selection synchronization with no source write.

Execution corrections are not hidden: one packaged security attempt overlapped package generation and the process exited SIGTRAP after two checks; the subsequent run after packaging completed passed all 6. Two browser harnesses were mistakenly run concurrently against one disposable source file, invalidating source assertions; these runs are excluded, and final harnesses were run serially on fresh copies. After a test-owned CSS override was removed, a typography regression saw its cached stylesheet; the harness now explicitly reloads after that external CSS teardown, and the full10-case fresh regression passes. A retained JSON measurement artifact needed only a trailing newline for formatter compliance; final lint passes. No product security or persistence behavior was relaxed to fix these harness issues.

### Actual source, rendering and persistence

Committed artifacts: [evidence/phase-03-spacing](evidence/phase-03-spacing/). `source-before/after.tsx.txt`, `spacing.png` and `measured.json` prove Harbor `#hero` Inline padding 24→32px, child x 232→240 (8px), original block sides112px and `py-20 lg:py-28` retained. Gap axis edits retain the companion, negative margins render−8px, and All margin resolves supported axes. All padding 40 retained lg block 112 and correctly remained unconfirmed. A block-heading gap change remained unconfirmed despite computed gap 16px. Mixed font-weight 500/padding 8 confirmed both groups in one exact patch. No-op retained inode/mtime; stale hashes preserved external bytes; dynamic expressions and repeated instances stayed refused. Dark/narrow native-focus order and collapse retained an unsaved draft without writes.

Native snapshots are uninstrumented real project files. All padding 24 writes the exact JSX patch; Undo/Redo restores bytes and CSS. Final full quit/reopen preserves font 36px plus padding 16px and exact source, including in the packaged offline run. Its screenshot is before a new selection; the actual computed assertions and persisted file establish the result. The final saved online project also builds independently with the editor wrapper inactive; HTML assertions verify the edited utilities and absence of preview OIDs.

Complete local traces: spacing `/var/folders/hr/xvx1mh7d68nfwk82tdspn3380000gn/T/allstudio-spacing-e2e-OhfeaJ/trace.zip`; typography `/var/folders/hr/xvx1mh7d68nfwk82tdspn3380000gn/T/allstudio-typography-e2e-4AVfY3/trace.zip`; browser regression `/tmp/allstudio-spacing-browser-regression/trace.zip` plus webm/diffs. Native directories: online `apps/desktop/dist/local-workflow-evAE66`, offline `local-workflow-1EzSfj`, nested `local-workflow-munkaS`, variants `local-workflow-LPz0iu`. Layer trace: `/var/folders/hr/xvx1mh7d68nfwk82tdspn3380000gn/T/allstudio-layers-e2e-qq4RLA/trace.zip`. Final edited disposable copies retained under `/var/folders/hr/xvx1mh7d68nfwk82tdspn3380000gn/T/allstudio-spacing-7kox3a7e/edited-workspaces`. Original copies restored; three recognized v3 runtime files refreshed to v4, original JSX preserved, unrelated legacy `nextjs-site-fixture` runtime left untouched.

### Review, security and boundaries

Fresh independent read-only implementation review found no actionable correctness/security/regression issues and independently passed98 spacing/confirmation/protocol tests. GPT-6 Luna extra-high handled fixture inventory and user documentation; the parent reviewed/integrated those edits. Serena was unavailable for the documentation agent, which used read-only shell fallback. Neither agent review nor green CI substitutes for founder approval.

No Electron main/preload/IPC/path grant/atomic write/history/recovery code changed. Existing negative IPC, traversal, symlink/hardlink, nonce/origin/frame/schema, stale/ambiguous target and recovery tests passed. The subframe injection probe remains unavailable; its historical harness PASS line is not proof of a successful subframe denial. Offline production Next build remains NOT RUN in the offline harness, preserving the known next/font/google limitation; online portability was tested separately. Other OS/architectures, signing/notarization, unfamiliar-user sessions and assistive-technology validation remain pending/unclaimed.

Next approved work:3.4b background colour/uniform radius, then3.4c flex/grid/layout/sizing through the same source pipeline. Responsive tools3.5, bounded structural edits3.6, assets/finishing3.7 and route navigation3.2b remain open. Material structural/assets permission decisions require their own founder approval. Recommendation: READY FOR REVIEW for Slice 3.4a; INCOMPLETE for Phase 3. No merge or PASS.
