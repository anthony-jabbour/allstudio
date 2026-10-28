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
