# Phase 2 — Cloud agent prompt (Electron and real local-first behavior)

> Paste everything below the line into a new Claude Code cloud session on
> `anthony-jabbour/allstudio`. Before launching, the founder fills in the
> **Founder pre-approvals** block (section 3). Anything left unchecked stays
> a blocked decision that the agent must ask about, not choose.

---

## 1. Your role and the outcome

You are the Phase 2 implementation agent for **allstudio**, a public
Apache-2.0 code-aware visual website editor. Phase 0 and Phase 1 are
**PASSED by the founder** (2026-10-25). Your job is to build **Phase 2 —
Electron and real local-first behavior** in small, reviewable PRs, with real
executed evidence for every gate test.

**Phase 2 outcome (RoadMap.md §3):** a user opens an existing project, edits,
saves, and reopens it offline in an actual Electron application.

**Phase 2 gate tests (verbatim, these are your acceptance criteria):**
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

**Exit:** a trusted local workflow survives restarts and disconnection; no
known privileged-preview access. Do not advertise "offline-first" before this
gate passes. **You never mark Phase 2 PASS.** Only the founder does. Your
final recommendation is at most `READY FOR HUMAN VALIDATION`.

## 2. Read first (in this order) and obey

1. `AGENTS.md`, then `CLAUDE.md` (the repo's operating rules: founder-first
   decisions, reuse-first gate with **≥1,000 GitHub stars** recorded with
   URL/date/license, REA workflow, delivery record format, no PASS claims).
2. `RoadMap.md` §3 Phase 2 and the "release hardening is continuous" note.
3. `ARCHITECTURE.md` §4 (workspace adapters, `writeAtomic`, `watch`), §6
   (local stack + Electron security), ADR-007 (Electron "recommended pending
   spike").
4. `CODEBASE_ARCHITECTURE.md` §2 (trust zones: unprivileged renderer, minimal
   preload, main validates everything, preview is potentially hostile) and §4
   (package contracts: `@allstudio/editor` must not import `node:fs`).
5. `REPOSITORY_ARCHITECTURE.md` §3 (target layout `apps/desktop/src/{main,
   preload,renderer}`), `Techstack.md`, `SECURITY.md`, `PRD.md` (P-004 save and
   export, offline section), `docs/project-format.md`.
6. Phase 1 evidence and carry-overs: `docs/validation/PHASE-01.md` ("Phase 1
   gate closure" and "Carried forward"), `docs/validation/PHASE-01-REVIEW.md`
   (finding 3: the dev adapter's remaining TOCTOU window and handle-relative
   cleanup are explicitly **deferred to you**), `docs/decisions/ADR-0001` and
   `ADR-0002` (open: stripping `data-oid` on export).
7. The code you are building on (read it, don't assume):
   - `packages/editor/src/site/source-edit-workspace.ts`: the runtime-neutral
     `SourceEditWorkspace` contract. Its comment already says *"the Electron
     app will implement it over validated IPC."* Implement this contract; do
     not fork the editor.
   - `packages/editor/src/shell/` (`EditorShell`, `use-preview-bridge.ts`),
     `packages/editor/src/preview-bridge/` (postMessage protocol with origin,
     source and nonce validation).
   - `packages/editor/src/source-mapper/` (format-preserving splice edits).
   - `apps/playground/dev/dev-workspace.ts`, `workspace-api.ts`,
     `prepare-workspace.ts`, `vite-plugin.ts`, and `apps/playground/dev/CLAUDE.md`.
     This is the development-only adapter whose invariants (path confinement,
     symlink rejection, sha256 preconditions, per-file serialized writes,
     UTF-8 guard, hard-link refusal, mode preservation, recheck before rename)
     your real adapter must keep **or strengthen**.
   - `scripts/e2e/text-edit.e2e.mjs` (34-check browser E2E; uses a global
     Playwright via `createRequire`) and `scripts/e2e/build-edited-workspaces.mjs`.
   - `.github/workflows/quality.yml` (CI: lint, typecheck, test,
     public-boundary, build, using Bun 1.3.14).

If any requirement is stale or contradicts another, **ask**; don't silently
pick one.

## 3. Founder pre-approvals (the founder fills this in before launch)

Treat each item as approved **only if checked**. Unchecked = ask using the
CLAUDE.md decision template and do not implement the dependent work.

- [ ] **D1. Electron as the desktop runtime**, pinned to an exact current
      stable version (agent verifies stars/license/version/date; npm `latest`
      was `45.0.0` on 2026-10-25).
- [ ] **D2. Desktop build tooling:** ______ (candidates to compare:
      electron-vite, Electron Forge with its Vite plugin, plain esbuild/tsc;
      agent recommends).
- [ ] **D3. Packaging tool:** ______ (Electron Forge vs electron-builder);
      Linux package smoke tests in the cloud, macOS later.
- [ ] **D4. Playwright as a devDependency** (exact pin) for browser and
      Electron E2E, plus CI jobs (the Phase 1 carry-over; Electron runs under
      `xvfb-run` on `ubuntu-latest`).
- [ ] **D5. File watcher:** Node built-in `fs.watch({recursive:true})` first;
      a library (chokidar / @parcel/watcher) only if built-in proves
      inadequate, with evidence.
- [ ] **D6. Preview surface:** ______ (A: keep the cross-origin `<iframe>` of
      the local `next dev` URL inside the sandboxed renderer and reuse the
      existing preview bridge; B: a separate `WebContentsView` with its own
      session and a new bridge).
- [ ] **D7. `data-oid` instrumentation for real user projects:** ______
      (A: insert attributes into the user's source, as Phase 1 does in its
      `.workspace` copy; B: instrument only in the preview via a build-time
      transform, so source stays untouched; C: work on a shadow copy and sync
      back).
- [ ] **D8. Interrupted-save recovery journal location:** ______ (Electron
      `userData` app directory vs project `.allstudio/`).
- [ ] **D9. Undo/redo scope for Phase 2:** ______ (per-session only, or
      persisted across restart).
- [ ] **D10. Script-execution permission UX:** what prompts, per-project
      remembered grant (yes/no), and where it is stored.
- [ ] **D11. Recent-projects/grants store:** JSON in `userData`
      (recommended) vs SQLite (deferred unless needed).
- [ ] **D12. Phase 2 gate OS:** Linux packaged build validated in the cloud,
      plus macOS manual validation by the founder on a Mac (yes/no).
- [ ] Allowed to add other dev-only dependencies under 1 MB without asking:
      yes/no.

**D6 and D7 are the two decisions that most shape the architecture.**
Research them first (Onlook's approach, Electron security docs, Next.js
build-transform options) and bring a recommendation with evidence before
implementing.

## 4. Verified cloud environment facts (observed 2026-10-25 in this environment type)

These were checked in this environment type; verify them again at session
start. They can change with the environment's network policy.

| Fact | Observed |
|---|---|
| OS / arch | Ubuntu 24.04.5, x86_64, 4 CPU, ~15 GB RAM, running as **root** |
| Toolchain | Node 22.22.0, Bun 1.4.4 (CI pins Bun 1.3.14; match CI for lockfile changes) |
| Display | No `DISPLAY`. `Xvfb` and `xvfb-run` are installed. Use `xvfb-run -a` to launch Electron |
| Electron system libs | `libgtk-3`, `libnss3`, `libgbm`, `libasound` present |
| Electron binary download | GitHub release assets (`github.com/electron/electron/releases/...` → `release-assets.githubusercontent.com`) reachable through the proxy; npm registry reachable |
| Browser | Chromium plus Playwright browsers pre-installed under `/opt/pw-browsers`. **Do not run `playwright install`.** `require('playwright')` works globally |
| Offline simulation | `unshare -n <cmd>` works (root): it gives a process tree no network. Use it for the offline gate run |
| Watcher limits | inotify `max_user_watches` = 130016 |
| Tools | `strace` available (useful to prove no outbound connects) |
| Persistence | The container is ephemeral. Commit and push often; anything uncommitted is lost when it is reclaimed |

**Root and the Chromium sandbox:** Chromium refuses to start its OS sandbox
as root without `--no-sandbox`. Running with `--no-sandbox` disables the
OS-level renderer sandbox, so it is **not** valid security evidence. For
security tests, create an unprivileged user (`useradd -m tester`) and run
Electron as that user with the sandbox enabled. If the sandbox still cannot
start (missing user namespaces or setuid `chrome-sandbox`), record it as a
limitation, keep `webPreferences.sandbox: true` in code, and do not claim OS
sandbox evidence.

## 5. Target architecture (proposal; confirm D-items before building)

```text
apps/desktop/
  src/main/        Electron main: window, app lifecycle, project grants,
                   LocalProjectWorkspace, preview supervisor, IPC handlers
  src/preload/     contextBridge only: a frozen object of typed request fns
  src/renderer/    React shell that mounts @allstudio/editor's EditorShell
  tests/           unit + Electron E2E (Playwright _electron)
  CLAUDE.md        scoped invariants (like apps/playground/dev/CLAUDE.md)
```

- **One editor.** The renderer uses the same `@allstudio/editor/shell` as the
  playground. The desktop app provides a `SourceEditWorkspace` implementation
  backed by IPC. Do not copy editor UI.
- **Node-only code stays out of `@allstudio/editor`.** Put the real file
  adapter in `apps/desktop/src/main/` (or a node-only subpath of
  `@allstudio/project` if you justify it). Factor shared validation
  (path rules, request parsers such as `parseTextEditBody` /
  `parseClassEditBody`) so the playground and desktop use **one**
  implementation. Keep the playground and its E2E working.
- **IPC surface (minimal, typed, validated):** only the operations the editor
  needs (open project via dialog, list recent, locate, preview/apply text,
  preview/apply class, start/stop preview after permission, undo/redo).
  - No generic `readFile`, `writeFile`, `exec` or `shell.openExternal` passthrough.
  - Every handler checks `event.senderFrame` is the app's own top frame and
    origin, then validates the payload with exact-key schemas and bounded
    sizes, and returns `SourceEditFailure` reasons, never raw errors.
- **Electron hardening baseline** (from Electron's official security
  checklist; cite the doc version you read):
  - `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`,
    `nodeIntegrationInSubFrames: false`, `webSecurity: true`.
  - A strict CSP for the renderer, loaded from a custom `app://` protocol or
    packaged files, not a dev server, in production builds.
  - `setWindowOpenHandler` → deny; `will-navigate` / `will-redirect` → deny
    anything that isn't the app or the approved localhost preview origin;
    `will-attach-webview` → prevent.
  - `session.setPermissionRequestHandler` / `setPermissionCheckHandler` →
    deny by default.
  - No `remote` module. Electron Fuses at packaging: `RunAsNode` off,
    `EnableNodeCliInspectArguments` off, `EnableNodeOptionsEnvironmentVariable`
    off, `OnlyLoadAppFromAsar` on, `EnableEmbeddedAsarIntegrityValidation` on
    where supported.
- **LocalProjectWorkspace** (the real file adapter that replaces Onlook's
  placeholder `NodeFsProvider`):
  - Project root granted only through the native folder dialog, or a
    test-only injection that is compiled out or disabled in packaged builds.
  - Canonical root via `realpath`, with the Phase 1 lexical rules plus
    `realpath === join(root, rel)`.
  - Atomic save: temp file in the same directory (`wx`), write, `fsync`,
    `chmod` to the original mode, recheck path and hash, `rename`, then
    `fsync` the directory.
  - A recovery journal (per D8) so a crash between steps leaves either the
    old file or the new file, plus a recoverable record, never a truncated
    file.
  - On next launch, detect leftover temp files and journal entries and offer
    restore or discard.
  - Try to close the Phase 1 TOCTOU deferral. Node has no `openat`/`unlinkat`,
    so evaluate holding a directory `FileHandle` and verifying `dev`/`ino`
    before and after rename. If it cannot be fully closed in Node, document
    exactly what remains.
- **Watcher:** detect external edits. If the selected element's file
  changed, re-locate or mark it stale. Never overwrite an externally changed
  file: the sha256 precondition still applies. Debounce bursts (editors that
  save via rename).
- **Preview supervisor:**
  - Explicit user permission before running any project script (per D10).
  - Spawn `next dev` via the project's local `node_modules/.bin`, never
    `npx` and never a shell string.
  - Fixed argv, scrubbed env (PATH, HOME, NODE_ENV, telemetry off), bound to
    `127.0.0.1` on an allocated port.
  - Structured startup errors (missing dependencies, port in use, crash).
    Kill the whole process tree on quit, crash and project switch.
  - The preview gets **no** preload and **no** IPC.
- **No cloud contact:**
  - Local mode imports no Clerk/Railway code.
  - Add a dev/test-only `session.webRequest` logger (and/or `strace -f -e
    trace=connect`) to prove that during the full gate run every request goes
    to `app://`, `file://` or `127.0.0.1`.
  - Leave BYOK out of Phase 2. If you add any UI mentioning it, label it
    "online, sends data to your provider".

## 6. Work plan: small PRs, each independently reviewable

Each slice: declare the files and the visible outcome, run the reuse-first
gate, write the smallest end-to-end test first, implement, run all checks,
open a **draft PR** with the CLAUDE.md delivery record, then iterate on the
Greptile review until it scores **5/5** (at most 5 loops). **Do not merge**
unless the founder tells you to in this session. Greptile's free plan has a
monthly credit cap that was exhausted once in Phase 1. If reviews stop
arriving, say so and ask; never fake a review.

| # | Slice | Proves |
|---|---|---|
| S0 | **Decision PR:** `docs/decisions/ADR-0003-desktop-toolchain.md` comparing Electron version, build tool, packager, watcher, preview surface and `data-oid` strategy (stars/license/maintenance/date). Spike on a scratch branch: hello-world Electron window under `xvfb-run`, preload exposes one function, `window.require`/`process` absent in the renderer, screenshot captured. | D1–D7 decisions; cloud can run Electron |
| S1 | `apps/desktop` skeleton: main/preload/renderer, hardened `webPreferences`, CSP, navigation/window-open/webview/permission denials, renderer mounts `EditorShell` with a stub workspace. Root scripts `desktop:dev`, `desktop:build`, typecheck/lint coverage, public-boundary script covers it. | Gate 3 groundwork |
| S2 | `LocalProjectWorkspace` + IPC handlers implementing `SourceEditWorkspace`. Shared validation factored out of the playground (no behavior change there; its tests still pass). Unit tests port every Phase 1 adapter test. | Real file edits through IPC |
| S3 | Atomic save with `fsync`, recovery journal, startup recovery UI. Fault-injection tests: kill the main process (`SIGKILL`) at each step between temp write and directory fsync, relaunch, assert the file is old-or-new and recovery is offered. | Gate 2 (interrupted save) |
| S4 | Preview supervisor + script permission prompt + process-tree cleanup + structured errors. | Gate 1 (preview), non-destructive failures |
| S5 | Watcher + external-edit and hash-conflict UX. | Gate 2 (watching, conflicts) |
| S6 | Undo/redo of applied edits (per D9) as inverse splice edits with hash preconditions, so an undo never clobbers an external change. | Build list "atomic save/undo" |
| S7 | Security negative suite (Playwright `_electron`, run as the unprivileged user with the sandbox on): IPC calls from the preview frame (direct and via `postMessage` spoofing), `..`/absolute/backslash/NUL paths, symlink and hard-link escapes, unauthorized roots, preview `window.location` / `window.open` / `<webview>` injection, forged bridge nonce. | Gate 3 |
| S8 | Offline gate run: dependencies preinstalled, then the whole flow under `unshare -n`: launch → open fixture → grant scripts → preview → edit text and class → save → quit → relaunch → reopen → assert disk diff, plus the request log/strace showing no non-local connects. | Gates 1 and 4 |
| S9 | Packaging: build the Linux package (AppImage or unpacked dir per D3) with fuses. Run S8's flow and a subset of S7 **against the packaged binary**. CI job (if D4 is approved) runs Electron E2E under `xvfb-run`. | Gate 5 |
| S10 | `docs/validation/PHASE-02.md` gate closure table (like PHASE-01), an independent read-only review by a separate agent instance, `HANDOFF_FOR_CLAUDE.md` update, and `apps/desktop/CLAUDE.md` invariants. | Evidence package for the founder |

Use the three Phase 1 fixtures (`examples/*`) as the "existing projects".
Copy them to a temp directory first, with dependencies preinstalled. Never
write into `examples/`.

## 7. Validation rules (what counts)

- Real evidence only: the actual Electron app, files on disk, `git diff` of
  the opened project, screenshots/traces from Playwright `_electron`, the
  request log, the strace output. A unit-test mock, a TypeScript pass or a
  self-review is not gate evidence.
- For every gate test, record the exact commands, exit codes and key output.
  Unrun means `NOT RUN`, not `PASS`.
- Negative tests must first be shown to **fail** without the protection
  (temporarily remove the guard, run, restore), the same as in Phase 1.
- Keep `bun run lint`, `typecheck`, `test`, `validate:public-boundary`, `build`
  and the Phase 1 browser E2E green on every PR.
- Traces and recordings are large: don't commit binaries. Note how to
  regenerate them.

## 8. Hard constraints (non-negotiable)

- Public repo only. Never import or reference private `allstudio/cloud` code
  or secrets. Local mode needs no network or login.
- No new substantial third-party dependencies without the matching D-item
  checked. No paid external calls, deployments, license changes or
  destructive operations. Don't change machine-wide or agent settings
  without asking.
- Untrusted previews never receive a privileged bridge. When in doubt, deny.
- Never copy proprietary code or assets. Onlook-derived code keeps its
  provenance (`docs/provenance/README.md`).
- Do not mark any phase PASS. Do not edit specs to legitimize a guess. If a
  material choice is unspecified, use the decision template:

  ```text
  I need your decision on [feature/behavior].
  A: [behavior and trade-offs]
  B: [behavior and trade-offs]
  I recommend [A/B] because [specific reasoning].
  Which should allstudio use?
  ```

  If unattended, write a visible **BLOCKED — FOUNDER DECISION** report and
  continue only independent approved work.
- Git: develop on your assigned branch; one PR per slice (stacked PRs are
  fine); draft PRs; commit trailers and PR footer per the session's
  attribution instructions; no model identifiers in commits, PRs or code.
- At most one diagnosis-driven automatic CI repair rerun per failure; report
  recurring failures with logs and hypotheses.

## 9. Known limitations of a cloud run (state these in PHASE-02.md)

1. **Linux only.** No macOS: no `.app`/DMG build, signing, notarization,
   FSEvents watcher behavior, case-insensitive APFS paths or macOS sandbox
   evidence. macOS validation is a founder/manual (or macOS CI runner) task.
2. **Headless display.** Xvfb is a virtual display. There's no human
   interaction, and native dialogs can't be clicked, so the folder picker is
   exercised through a test-only injection. The real picker needs a human
   check.
3. **Root container.** OS-sandbox evidence needs the unprivileged-user run
   (section 4). `--no-sandbox` results are not security evidence.
4. **Simulated offline.** `unshare -n` proves no network access from the
   process tree. Real "Wi-Fi off on a laptop" is a manual check.
5. **Ephemeral container.** "Restart" means app restart inside the
   container, not a machine reboot. Push work often.
6. **Fixtures, not real user projects.** Large real-world repositories,
   monorepos and other package managers are untested.
7. **Disk allowance.** Electron (~100–200 MB per platform download),
   `node_modules`, three Next builds and traces add up. Clean
   build outputs when you're done with them.
8. **Review capacity.** Greptile credits are limited; GitHub Actions minutes
   for Electron/xvfb jobs (and any future macOS runner) are a cost the
   founder approves.

## 10. Definition of done for this session

- Every Phase 2 gate test has executed evidence in
  `docs/validation/PHASE-02.md`, or is explicitly `BLOCKED`/`NOT RUN` with
  the reason and what is needed.
- All slice PRs are open as drafts with delivery records and Greptile 5/5 (or
  a stated reason why not), CI green, no merge conflicts.
- Open founder decisions are listed in one place with your recommendation.
- Final message: the delivery record and a gate recommendation of
  `READY FOR HUMAN VALIDATION`, `BLOCKED` or `INCOMPLETE`, never PASS.
