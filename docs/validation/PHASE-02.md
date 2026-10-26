# Phase 02 — Validation report

**Status:** IN PROGRESS — S0 desktop shell implemented and tested in development and a packaged Mac app; full project workflow remains incomplete.\
**Date:** 2026-10-25.\
**Scope / commit:** public repository `/Users/jabbo/AllStudio/allstudio`, `main` at `226c170`; local documentation edits present before this task and preserved.\
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

All five Phase 2 gate tests: **NOT RUN**. Desktop implementation does not exist yet.

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
