# Phase 02 — Validation report

**Status:** IN PROGRESS — connected local workflow implemented; recommendation READY FOR HUMAN VALIDATION. Only the founder may mark this phase PASS.\
**Date:** 2026-10-25.\
**Scope / commit:** public repository `/Users/jabbo/AllStudio/allstudio`, branch `phase-02/local-workflow`, based on `291899f` and the stacked desktop/native/preview PRs. Final head is recorded in the PR. Session-start state below is historical and preserved.\
**Founder approval:** Phases 0 and 1 PASS, reconfirmed 2026-10-25. Founder clarified: “Phases 0 and 1 PASS; start Phase 2.” No Phase 2 PASS claimed.\
**Research:** [Desktop toolchain and D6/D7 comparison](../research/phase-02-desktop.md).

## Acceptance criteria (unchanged)

1. With dependencies preinstalled and network disabled: launch, open, preview,
   edit, save, quit, reopen, and inspect source changes on disk.
2. Verify file watching, external edit/hash conflicts, data restoration after
   interrupted save, and non-destructive failure handling.
3. Attempt `..` traversal, symlink escapes, unauthorized paths, untrusted
   navigation, and IPC calls from preview content; deny access.
4. Verify a locally opened project neither requires nor silently contacts
   Clerk/Railway; explicitly distinguish online BYOK requests.
5. Test from a packaged app as soon as packaging supports it, not only a
   developer run.

The criteria above are unchanged. Connected gate evidence is recorded in the final section; earlier NOT RUN/BLOCKED statements below describe the initial slices and are superseded there. No phase PASS is asserted.

## Session-start environment (exact outputs; credential line omitted)

Commands run from `/Users/jabbo/AllStudio` unless noted:

```text
$ sw_vers
ProductName:    macOS
ProductVersion: 27.0.1
BuildVersion:   26A434
$ uname -m
arm64
$ xcode-select -p
/Library/Developer/CommandLineTools
$ node -v
v22.22.3
$ bun -v
1.3.14
$ git status
fatal: not a git repository (or any of the parent directories): .git
$ git log --oneline -3
fatal: not a git repository (or any of the parent directories): .git
$ gh auth status
github.com
  ✓ Logged in to github.com account Vegad-code (keyring)
  - Active account: true
  - Git operations protocol: https
  [token line omitted]
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'
```

The parent directory is the workspace container. Commands below were run in the existing public repository, without creating a checkout or worktree:

```text
$ git status --short --branch
## main...origin/main
 M HANDOFF_FOR_CLAUDE.md
 M docs/validation/PHASE-01.md
?? .serena/
$ git remote -v
origin  git@github.com:anthony-jabbour/allstudio.git (fetch)
origin  git@github.com:anthony-jabbour/allstudio.git (push)
$ git log --oneline -3
226c170 Merge pull request #10 from anthony-jabbour/claude/fervent-tesla-7bsghy
91f3fac Add the Phase 2 Codex local build prompt
4065e83 Add the Phase 2 cloud agent prompt (#9)
```

The tree was not clean at entry. `main...origin/main` is the locally stored comparison, not a fresh remote fetch or proof of latest remote HEAD. No unrelated edits were reverted. GitHub credential values are intentionally excluded; tabs in system output are expanded for readability.

## Initial slice definition

Phase and specific acceptance criterion: S0 feasibility, leading toward gate 3 and gate 5; a running, packaged hardened Electron shell before project execution.

User-visible behavior proposed: actual native app window hosting the existing editor shell, with a narrow typed IPC surface and an unprivileged preview. This is not a new editor implementation.

Founder decisions still needed: exact runtime/build/packager/test pins and installation permissions (D1–D4), preview surface (D6), instrumentation (D7), unsigned/ad-hoc Mac gate packaging (D12). Later slices require D5 and D8–D11, including script-execution consent and recovery storage.

Reuse research: canonical GitHub metadata, npm versions and official docs recorded in the linked research note; proposed tools all exceed 1,000 stars. REA not applicable to this runtime comparison and not invoked.

Modules proposed for S0, pending approvals: `apps/desktop/src/{main,preload,renderer}`, its package/build config, root package scripts/lockfile, targeted Electron test and CI configuration. Preserve runtime-neutral `@allstudio/editor`; do not import Electron or node:fs there. No product code changed yet.

Exact reproducer: pending dependency approval. Planned fixture is the existing editor with a deliberately hostile local preview; packaged execution must use the produced .app binary, not merely a dev server.

Tests planned: positive shell launch and allowed top-frame request; negative preview/subframe IPC, malformed arguments, untrusted navigation and popups; verify packaged launch and earlier phase regression tests. These remain NOT RUN.

Carry-over: the existing dev adapter's final path-check-to-rename race and handle-relative cleanup are unresolved for a production adapter. Simply moving that adapter into Electron would not close the gate. Research the supported native handle-relative primitives before choosing an implementation or dependency.

## Checks actually executed in this session

From `/Users/jabbo/AllStudio/allstudio`:

| Exact command | Exit | Observed result |
|---|---:|---|
| `bun run test` | 0 | 197 tests passed, 9 files, Vitest 3.2.7 |
| `bun run typecheck` | 0 | project, editor, playground and all three fixtures exited 0 |
| `bun run lint` | 0 | Biome checked 82 files; no fixes applied |
| `bun run validate:public-boundary` | 0 | Public boundary check passed; 139 files scanned |

`git diff --check` also exited 0 after Markdown whitespace corrections; phase-status assertions passed.

These are baseline regression checks. They do not validate Electron, offline operation or packaging. No dependency installations, project scripts, paid API requests or cloud deployments were performed. Build/browser E2E were not rerun in this initial research slice.

## Delivery record

**Roadmap phase / acceptance criterion:** Phase 2 start; record founder Phases 0/1 approvals, environment, baseline and reuse research.\
**Founder approvals or unresolved decisions:** Phases 0/1 PASS and Phase 2 start authorized; explicit tool/behavior approvals pending as listed above.\
**OSS candidates:** canonical URLs, stars, dates, licenses and comparison in the research note. No adoption yet.\
**REA:** not applicable to the initial desktop stack comparison; not run.\
**Files changed and visible result:** phase 0/1 reports and historical audit/review status annotations, ADR-0002 and handoff now reflect founder approvals without inventing new test evidence; this report and desktop research note start Phase 2.\
**Tests run:** four baseline commands above, all exit 0.\
**Real-world proof:** host/tool versions and existing repository status observed. No desktop UI/file-save/restart proof yet.\
**Negative/security/regression checks:** existing 197-test suite and public-boundary scan passed; no new native security validation yet.\
**Not run, failures, and risks:** five Phase 2 gate tests, packaged app, offline UI, new native adapter and independent review NOT RUN. Serena initially selected the parent workspace with no language backend; activating the existing nested TypeScript project restored semantic tools. One read was blocked by the read-volume hook; semantic reads continued.\
**Gate recommendation:** BLOCKED — FOUNDER DECISION for S0 implementation; Phase 2 remains IN PROGRESS and is not PASS.

## S0 — hardened native shell (2026-10-25)

Branch: `phase-02/desktop-s0`. Founder approved D1–D4, D6=A, D7=B spike, D12 and network installation on 2026-10-25; subsequent storage/script approvals are recorded in the research note. These supersede initial pending-choice statements above.

Implemented separate main/preload/renderer builds, sandbox/context isolation with Node disabled, typed main-frame-only runtime IPC, main sender/frame/URL validation, a confined app asset protocol, denied popups/top navigation/downloads/permissions, and the existing shared EditorShell. No project script or file privilege is exposed yet. No cloud service is imported or needed.

Commands executed: `bun install` (Bun 1.3.14, exit 0); `bun run build:desktop` (exit 0); `bun run test:desktop` (six checks passed); `bun run package:desktop` (exit 0); `node scripts/e2e/desktop.e2e.mjs apps/desktop/dist/mac-arm64/allstudio.app/Contents/MacOS/allstudio` (six checks passed). The actual arm64 package launched independently of any development server. Build output uses the stock Electron icon and is intentionally unsigned, as approved.

Shell negative checks: renderer lacks Node/raw IPC; a hostile loopback iframe cannot access the bridge or parent; another WebContents with the actual preload gets native IPC denied; top navigation/popups denied; encoded asset traversal denied. Pure guard tests cover same-URL subframes, different WebContents, missing frames and unexpected arguments. No project save/path/recovery gate proof yet.

Real-world artifacts (local, ignored): `apps/desktop/dist/evidence/development/{desktop.png,trace.zip}` and `apps/desktop/dist/evidence/packaged/{desktop.png,trace.zip}`.

Fresh independent reviewer: no actionable S0 findings. It independently ran the two security unit tests; did not run Electron/package or review the separate source/native spikes. Limits: Linux job uses --no-sandbox; this is smoke evidence, not Linux sandbox proof. Hostile-frame bridge absence is tested; direct subframe IPC currently relies on guard unit coverage. Added an actual Source editing heading assertion to the smoke script after the review.

Initial formatter runs accidentally scanned generated `out/` bundles, reporting third-party generated-code lint errors. Added `!**/out` to Biome and rebuilt clean outputs; targeted source formatting and subsequent repository lint passed. No generated bundles are committed.

S0 recommendation: READY FOR REVIEW. Phase 2: INCOMPLETE; gate tests 1–4 and the complete packaged project workflow of gate 5 remain unrun. Adding a Linux CI job does not claim its hosted run passed.

## Subsequent native and instrumentation spikes

Founder approved the original native helper after candidate research; see `docs/research/phase-02-native-files.md`. Seven native tests pass, including prepared-write cancellation, the independent reviewer's temp-substitution/mode regressions and parent-swap cleanup. The helper remains unexposed and unpackaged; adapter/journal/watch/IPC integration is not implemented. Descriptor-relative operations are not atomic compare-and-swap against all external writers.

Preview-only spike: three mapper-backed unit checks pass for deterministic IDs, text/class edits projected back to uninstrumented source, and refusal of instrumentation that would rewrite source. `NEXT_TELEMETRY_DISABLED=1 node scripts/spikes/preview-next.mjs` rendered seven stable IDs through real Next.js 16.4.3 compilation in a disposable repository-owned fixture copy. Original source/config and copied source hashes stayed unchanged. Only the copied config explicitly integrates the loader; no real user source/config was changed.

The initial public custom-server `conf` experiment returned HTTP 200 without invoking the loader. Installed Next source confirmed that path ignores `conf`; it is not counted as integration success. A pending founder decision asks whether real projects may receive an explicit consented, backed-up config integration. Production preview integration is BLOCKED — FOUNDER DECISION; no undocumented monkey-patching selected.

The isolated Next custom-server process retained resources after close; the spike logs this and exits its own process after a bounded three-second deadline. This is not production process-lifecycle proof.

Final working-tree regression run: `bun run test` passed 209 tests (12 files); typecheck, lint and public-boundary checks passed. Native-only PR scope was separately verified with 206 tests excluding the later three preview-spike tests. All three Next.js fixtures and the playground built successfully earlier in the session. S0 hosted quality and Linux development/packaged smoke passed after one executable-name CI repair; see `PHASE-02-S0-CI.md`. These results do not close the complete Phase 2 gate.

## Connected workflow — current evidence (2026-10-25)

Founder approved explicit config integration with consent and backup. D1–D12 choices, network installs and the original native helper were approved in chat before dependent implementation. No additional third-party dependency was selected for this slice.

### Actual behavior

An actual Electron app opens a chosen local folder or an existing remembered grant. It verifies folder identity, asks before adding the Next config wrapper and preserves the exact adjacent original config. The wrapper is inactive when the preview-loader environment variable is absent. It does not add data-oid to JSX/TSX on disk. The bundled preview-only transform and existing DOM bridge supply source mapping; the bridge is injected only into the active direct preview frame. Renderer imports the existing EditorShell and implements the original SourceEditWorkspace through a narrow validated IPC preload.

The main process holds the directory grant; the native helper receives its pinned directory FD. Source requests remain src/**/*.tsx|jsx only. Exact, separately approved configuration operations and bounded root metadata reads are internal main-process operations, never generic renderer filesystem endpoints. The native helper rejects traversal, symlinks, hard links, unsafe paths, oversized files and stale bytes. Permission bits, including special bits, are preserved. UTF-8 is validated without losing a BOM. Workspace-level synchronous queue admission preserves per-file call order and serializes history. Patch parsing/readback/OID checks still use the existing mapper.

Save intent is fsynced to private JSON in userData before publication. A restart offers Restore pending edit / Keep current files / Cancel. Restore refuses a divergent current file; Keep never overwrites source. Undo/redo is session-only and hash-checked. Recursive fs.watch reports external changes; stale saves do not overwrite them. Preview code executes only after explicit permission or an unchanged remembered fingerprint of the executable/arguments/runtime assets and package/config files. The UI displays the approved warning that project code runs with the user's account access. Quit stops the process group; an inherited pipe lease also stops the preview when Electron is killed.

### Gate mapping (not a founder PASS)

| Exact criterion above | Executed evidence |
|---|---|
| 1 | Actual Mac Electron development and unsigned packaged workflows: launch/open/preview/select/preview-patch/Apply/source inspection/quit/reopen. Restricted-network packaged run uses an unavailable loopback HTTP proxy for Electron networking and an OS Seatbelt deny for preview-child non-loopback egress; preview-child EPERM and absent parent-secret sentinel are asserted. Loopback preview remains available. Host network is not modified; Chromium's Mac sandbox remains enabled. |
| 2 | Live fs.watch notification; external source edit then stale Apply refused, bytes retained; real source undo/redo; real SIGKILL after the helper reaches PREPARED and before commit; original source retained, preview child exits, next launch restores the fsynced pending edit and retains the external comment. Backend tests also cover concurrent save order, no-op inode/mtime, BOM and invalid UTF-8, private journal mode under restrictive umask and recovery conflicts. |
| 3 | Actual IPC attempts for dot-dot/absolute/backslash/empty/dot paths, symlink file and directory escapes, hard links, config writes through the source API and ungranted project IDs denied. Actual preview has no Node/native bridge, cannot access parent bridge, and cannot navigate to a different origin. The subframe preload probe is unavailable under the real sandbox settings; exact-frame unit guards cover a hypothetical direct IPC sender. Another WebContents supplied with the real preload is denied by main. |
| 4 | Fresh local profile, no sign-in or app cloud keys; browser-request origins recorded with no Clerk/Railway requests. Application source has no cloud auth/runtime dependency. Parent secret sentinel is omitted from the preview env. Manual editor makes no model-provider call; UI explicitly says BYOK model requests require internet. This does not claim third-party resources used by the user's own project are offline services. |
| 5 | Same connected workflow and security/recovery checks executed against the actual arm64 .app binary, not a dev server. Packaged shell smoke also passed six checks. Native helper, runner, loader and bridge ship as physical runtime resources outside ASAR. |

### Commands and observed results

- `bun run test`: 218 tests passed, 14 files; `bun run typecheck`, `bun run lint`, `bun run validate:public-boundary`: exit 0 (208 files in the boundary scan at that run).
- `bun run build`: exit 0, browser playground and all three original Next fixtures. `bun run build:desktop` and `bun run package:desktop`: exit 0.
- `node scripts/e2e/local-workflow.e2e.mjs`: connected actual development app flow succeeded, including source/preview round trip, restart, SIGKILL recovery, permission cancellation/invalidation and a production build outside Electron.
- `ALLSTUDIO_FIXTURE=nested-components-fixture node scripts/e2e/local-workflow.e2e.mjs` and the equivalent tailwind-variants-fixture command: real connected flows succeeded on both additional fixtures (13 checks at those earlier runs, before the extra permission/build assertions).
- `node scripts/e2e/local-workflow.e2e.mjs apps/desktop/dist/mac-arm64/allstudio.app/Contents/MacOS/allstudio --offline`: packaged restricted-network flow executed. Exact final check count/artifact directory is recorded in the final command output and PR validation.
- `node scripts/e2e/desktop.e2e.mjs apps/desktop/dist/mac-arm64/allstudio.app/Contents/MacOS/allstudio`: six shell/security checks passed.

Artifacts are ignored local files under `apps/desktop/dist/local-workflow-*`: saved/failure/interrupted screenshots, edit/reopen/recovery traces, requested-origins JSON and standalone-build logs. Every run uses a fresh disposable fixture and profile. Native picker/message-box return values are controlled by the E2E harness; real files, native helper, preview compilation, UI selection/Apply and process termination are not mocked. Human native-dialog UX remains part of founder validation.

### Failures investigated and boundaries

- Initial feature test failed because Open project did not exist; implementing the connected UI made the real workflow pass.
- The escape-directory test deliberately formed a symlink cycle. Turbopack refused to rebuild it on restart; the denial checks had passed. Test-created links are now removed before normal preview recompilation. No production path guard was loosened.
- Cancelling a picker remounted the editor and lost an unapplied draft. A completed-operation regression reproduced it; unchanged results now retain the current editor. An initial immediate assertion raced the operation and was strengthened before treating it as evidence.
- A restrictive umask produced an unreadable recovery file; a real-file failing regression led to chmod on the open private temp FD. BOM package JSON in the CommonJS config path similarly received a failing regression and corrected parsing. Async CommonJS config is executed outside the app by its test.
- Wrapping all of Electron in an additional macOS Seatbelt profile failed because Chromium could not initialize its own sandbox. The successful harness does not disable Chromium's Mac sandbox: it applies browser transport blocking and OS egress denial only to the Node-mode preview child.
- An **extra offline production next build was attempted and failed** because the fixture imports next/font/google and Google fonts could not be downloaded. This is outside the unchanged manual launch/open/preview/edit/save/restart gate. Manual offline preview used Next's fallback fonts and completed; online standalone production build succeeded with the config wrapper inactive. The harness reports this additional offline production-build limitation rather than rewriting user typography or treating that failed extra check as PASS.
- Native directory-relative operations do not create kernel-atomic compare-and-swap against arbitrary same-UID external writers. Final publication checks and uncertain-outcome journaling are documented; this is not an OS sandbox for explicitly permitted Node project code.
- Tested project compiler: Next.js 16.4.3. Source editing is the supported static text/class subset from Phase 1; arbitrary config/compiler versions, source structure edits, Windows, signing/notarization and physical power-loss tests are not claimed.

### Independent review and documentation drift

A fresh, read-only reviewer examined the connected production diff, including native path separation, recovery, grants, wrappers, lifetime, IPC/navigation, renderer and packaging. It ran four focused backend/config tests and found no actionable production issues. It did not rerun Electron. Later QA regressions and their fixes are listed above; final executed tests remain the evidence.

The private Notion Agent Map and F-004 were queried selectively. F-004 remains In Progress/In Progress; its notes still describe Electron as absent, and the map still describes Phase 0 as unpassed. These are older records: the founder's direct Phase 0/1 PASS and approved unmerged Phase 2 implementation supersede them. No requirement was changed from those notes. PRs remain unmerged, so no Shipped/changelog entry is asserted.

### Delivery record

**Roadmap phase / acceptance criterion:** Phase 2, all five criteria above, unchanged.\
**Founder choices / approvals:** exact S0 toolchain; iframe; preview-only IDs; userData JSON/recovery; session history; script consent/remembered fingerprint; original C helper; consented config wrapper and exact backup; unsigned local package.\
**OSS research:** S0 candidate URLs/stars/date/licenses in linked research; no new tool adopted for this connected slice. Existing mapper and preview bridge reused.\
**REA:** not applicable to this runtime integration; not invoked. Public source/docs and executed tests used.\
**Changed and actual behavior:** native grant → consented setup/run → cross-origin preview → IPC mapper edit → fsynced source save → watch/history/recovery → quit/reopen.\
**Tests / UI / file proof:** exact commands and real artifact paths above; source bytes and modes inspected, not mocks. CI result belongs to the exact submitted head and is recorded separately when available.\
**Negative/security/regression checks:** documented above; previous phase unit/build coverage retained.\
**Unknowns / blocked decisions:** no founder design decision remains blocked. Known environment/compiler/export boundaries listed above; phase approval remains the founder's decision.\
**Recommendation:** READY FOR HUMAN VALIDATION — never marked Phase 2 PASS by an agent.

Final local packaged restricted-network run: **16 checks passed**, artifact directory `apps/desktop/dist/local-workflow-d5VaDE/`. The additional offline production build is explicitly not asserted by that manual gate command, after its earlier documented Google-font failure. The ordinary development workflow separately passed **16 checks** including the outside-Electron production build (`apps/desktop/dist/local-workflow-9fsrgz/`). Toolbar controls are activated with real Enter key events in the harness after pointer diagnostics showed scrolling could deliver a click to the preview instead of the toolbar; canvas element selection still uses pointer clicks. No persistence or recovery operation was mocked. Latest full regression run: 218 tests / 14 files, all typechecks, lint and boundary scan exit 0 (209 files at that scan).
