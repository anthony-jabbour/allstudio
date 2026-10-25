# Phase 2 — Codex local build prompt (Electron and real local-first behavior)

> **How to use:** open Codex in your local clone of `anthony-jabbour/allstudio`
> on the founder's Mac, then paste everything below the line. Fill in
> **section 3 (founder pre-approvals)** first; anything unchecked is a
> decision Codex must ask about, not choose. A Claude Code refinement pass
> happens after Codex finishes (section 12).

---

## 1. Role, outcome, and what "done" means

You are the **Phase 2 implementation agent** for **allstudio**, a public
Apache-2.0, code-aware visual website editor. You run **locally on the
founder's Mac** and build Phase 2 end to end by yourself, in small,
reviewable branches/PRs, with **real executed evidence** for every gate test.

Phase 0 and Phase 1 are **PASSED by the founder** (2026-10-25). `main` holds
the Phase 1 editing engine (a browser playground that edits real JSX/TSX
files of three Next.js fixtures).

**Phase 2 outcome (RoadMap.md §3):** a user opens an existing project, edits,
saves, and reopens it offline in an actual Electron application.

**Gate tests. These are your acceptance criteria; don't reword them:**
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
known privileged-preview access. Do not call the product "offline-first" until
this gate passes.

**You never mark Phase 2 PASS.** Only the founder does. Your final
recommendation is at most `READY FOR HUMAN VALIDATION` (or `BLOCKED` /
`INCOMPLETE`).

## 2. Read first, in this order, and obey

1. `AGENTS.md`, the repo's binding agent rules: founder-first decisions,
   reuse-first gate, OSS **≥1,000 GitHub stars** with URL/stars/date/license
   recorded, REA workflow, validation rules, required handoff.
   `CLAUDE.md` mirrors these rules (its "Delivery record" template is
   mandatory for every PR you open).
2. `RoadMap.md` §3, Phase 2, plus the "release hardening is continuous" note.
3. `ARCHITECTURE.md`:
   - §4: workspace adapter interface (`read`, `writeAtomic(expectedHash)`,
     `list`, `watch`, `createSnapshot`) and `LocalProjectWorkspace` /
     `LocalPreviewRuntime`;
   - §6: local stack and Electron security;
   - ADR-007: Electron is "recommended pending spike". Your S0 is that spike.
4. `CODEBASE_ARCHITECTURE.md`:
   - §2 trust zones: the renderer is unprivileged; preload is minimal and
     typed; main validates everything; **the preview is potentially hostile**;
   - §4 package contracts: `@allstudio/editor` must not import `node:fs` or
     Electron.
5. `REPOSITORY_ARCHITECTURE.md` §3 (target layout
   `apps/desktop/src/{main,preload,renderer}`), `Techstack.md`, `SECURITY.md`,
   `PRD.md` (P-004 save/export; the offline/local section),
   `docs/project-format.md`, `ONLOOK_INTEGRATION.md`.
6. Phase 1 evidence and carry-overs:
   - `docs/validation/PHASE-01.md` ("Phase 1 gate closure", "Carried
     forward");
   - `docs/validation/PHASE-01-REVIEW.md` (finding 3: the dev adapter's
     remaining TOCTOU window and handle-relative temp cleanup are **deferred
     to Phase 2**, which is you);
   - `docs/decisions/ADR-0001`, `ADR-0002` (open: stripping `data-oid` on
     export);
   - `docs/provenance/README.md`.
7. **The code you build on. Read it; do not assume:**
   - `packages/editor/src/site/source-edit-workspace.ts`: the
     runtime-neutral `SourceEditWorkspace` contract (`locate`,
     `previewTextEdit`, `applyTextEdit`, `previewClassEdit`, `applyClassEdit`)
     and the failure reasons. Its doc comment says the Electron app implements
     it over validated IPC. **Implement this contract; never fork the editor.**
   - `packages/editor/src/shell/` (`EditorShell`, `use-preview-bridge.ts`) and
     `packages/editor/src/preview-bridge/` (postMessage protocol: origin,
     source window, shape, then 24-byte nonce checks).
   - `packages/editor/src/source-mapper/`: Onlook-derived parser plus
     original format-preserving splice edits (`editElementText`,
     `editElementClassName`, `describeElement`, `listOids`,
     `instrumentSource`).
   - `apps/playground/dev/dev-workspace.ts`, `workspace-api.ts`,
     `prepare-workspace.ts`, `vite-plugin.ts`, and
     `apps/playground/dev/CLAUDE.md`. This is the **development-only**
     adapter. Your real adapter must keep **or strengthen** every invariant:
     - path rules: `src/**/*.tsx|jsx` only; reject `..`, `.`, empty
       segments, absolute paths, backslashes, drive letters and NUL;
       `realpath` must equal the lexical join, so every symlink is rejected;
     - a file-size cap;
     - a sha256 precondition, checked twice;
     - a per-file write queue joined synchronously, so writes run in call
       order;
     - invalid UTF-8 refused;
     - hard links refused;
     - file mode preserved via `chmod`;
     - the path rechecked right before `rename`;
     - patch validation: the result parses, the oid resolves once, the value
       reads back, and no `data-oid` is lost.
   - `scripts/e2e/text-edit.e2e.mjs` (34-check browser E2E) and
     `scripts/e2e/build-edited-workspaces.mjs`.
   - `.github/workflows/quality.yml`: CI runs lint, typecheck, test,
     public-boundary and build with **Bun 1.3.14**.
   - Root `package.json` scripts: `dev`, `build`, `typecheck`, `lint`
     (Biome), `test` (Vitest), `validate:public-boundary`.

If two requirements contradict or one looks stale, **stop and ask**. Never
silently choose one.

## 3. Founder pre-approvals (founder fills in before launch)

Approved **only if checked**. Unchecked: ask using the template in section 10,
and don't implement the dependent work.

- [ ] **D1 Electron** as the desktop runtime, exact pin of the current
      stable version. Verify version, date, stars and license; npm `latest`
      was `45.0.0` on 2026-10-25.
- [ ] **D2 Build tooling:** ______ (compare electron-vite, Electron Forge
      + Vite plugin, plain esbuild/tsc).
- [ ] **D3 Packager:** ______ (Electron Forge makers vs electron-builder).
- [ ] **D4 Playwright devDependency** (exact pin) for browser and Electron
      E2E (`_electron`), plus a CI job on `ubuntu-latest` under `xvfb-run`.
- [ ] **D5 File watcher:** Node built-in `fs.watch(..., {recursive:true})`
      first (FSEvents on macOS); a library (chokidar, @parcel/watcher) only
      with evidence that built-in is inadequate.
- [ ] **D6 Preview surface:** ______ (A: cross-origin `<iframe>` of the
      local `next dev` URL inside the sandboxed renderer, reusing the
      existing preview bridge; B: separate `WebContentsView` with its own
      session and a new bridge).
- [ ] **D7 `data-oid` for real user projects:** ______ (A: write
      attributes into the user's source, as Phase 1 does in its `.workspace`
      copy; B: inject them only in the preview build via a dev-only transform,
      leaving source untouched; C: shadow copy plus sync-back).
- [ ] **D8 Interrupted-save recovery journal location:** ______
      (Electron `userData` vs project `.allstudio/`).
- [ ] **D9 Undo/redo scope:** ______ (session-only vs persisted across
      restart).
- [ ] **D10 Script-execution permission UX:** prompt text, per-project
      remembered grant (y/n), storage location.
- [ ] **D11 Recent projects and grants store:** JSON in `userData`
      (recommended) vs SQLite (deferred).
- [ ] **D12 macOS signing for the gate:** ad-hoc/unsigned local package is
      enough (y/n). Developer ID signing + notarization (needs the founder's
      Apple Developer account and certificates) can happen later.
- [ ] **Network for installs:** Codex may use the network for `bun install`,
      the Electron binary download and doc lookups (y/n).
- [ ] **Small dev-only deps** (<1 MB, ≥1,000 stars) may be added without
      asking (y/n).

**D6 and D7 shape the architecture.** Research both first: Onlook's
approach, Electron's security docs, Next.js transform options. Bring a
recommendation with evidence before building anything that depends on them.

## 4. Local environment: verify at session start, record in PHASE-02.md

Run and record (exact outputs):

```bash
sw_vers; uname -m                 # macOS version, arm64 vs x86_64
xcode-select -p                   # Command Line Tools present
node -v; bun -v                   # use Bun 1.3.14 for lockfile changes (CI pin)
git status; git log --oneline -3  # clean tree on latest main
gh auth status                    # for PRs and review comments, if installed
```

- Work in the founder's local clone (e.g. `/Users/jabbo/AllStudio/...`).
  Never touch the separate Onlook research clone except to **read** it.
- Codex sandbox: if your sandbox blocks network or writes outside the repo,
  say so and ask. Don't change Codex or machine settings yourself.
- **Don't change system settings** (Wi-Fi, firewall, `pf`, Gatekeeper,
  keychain) without asking first. The founder runs the manual Wi-Fi-off check
  (section 8).
- Keep the tree clean; commit small, push often.

## 5. Target architecture (proposal: confirm D-items first)

```text
apps/desktop/
  src/main/        app lifecycle, BrowserWindow, project grants,
                   LocalProjectWorkspace, preview supervisor, IPC handlers
  src/preload/     contextBridge.exposeInMainWorld of a frozen object of typed request fns
  src/renderer/    React shell that mounts @allstudio/editor/shell EditorShell
  tests/           unit + Electron E2E (Playwright _electron)
  CLAUDE.md        scoped invariants (mirror apps/playground/dev/CLAUDE.md)
  package.json     @allstudio/desktop, private
```

**One editor.** The renderer uses the same `@allstudio/editor/shell` as the
playground. The desktop app only supplies a `SourceEditWorkspace`
implementation over IPC.

**Shared validation.** Factor the path rules and request parsers
(`isAllowedRelativePath`, `parseTextEditBody`, `parseClassEditBody`, the
patch validation) out of `apps/playground/dev/` into one node-only module.
Either `apps/desktop/src/main/` or a node-only subpath of
`@allstudio/project`; justify the choice. The playground and its 34-check
E2E must keep passing, unchanged in behavior.

**IPC surface: minimal, typed, validated.**
- Allowed operations: `project:openDialog`, `project:listRecent`,
  `project:open(recentId)`, `edit:locate`, `edit:previewText`,
  `edit:applyText`, `edit:previewClass`, `edit:applyClass`,
  `edit:undo`/`redo`, `preview:requestStart` (shows a permission prompt),
  `preview:stop`, `recovery:list`/`restore`/`discard`.
- **No** generic `readFile`, `writeFile`, `exec`, `spawn` or
  `shell.openExternal` passthrough. The renderer never sees absolute paths.
- Every handler:
  1. checks that `event.senderFrame` is the app's own top-level frame and
     origin;
  2. validates the payload with exact-key schemas and size bounds;
  3. returns `SourceEditFailure` reasons, never raw errors or stack traces.

**Electron hardening baseline.** Cite the Electron security doc version you
read.
- `webPreferences`: `contextIsolation: true`, `sandbox: true`,
  `nodeIntegration: false`, `nodeIntegrationInSubFrames: false`,
  `webSecurity: true`, `allowRunningInsecureContent: false`.
- Production builds load the renderer from a custom `app://` protocol or
  packaged files, never a dev server. Use a strict CSP: `default-src 'self'`,
  `frame-src` limited to the approved `http://127.0.0.1:<port>`.
- `webContents.setWindowOpenHandler(() => ({action:'deny'}))`.
- `will-navigate` / `will-redirect` deny everything except the app origin
  (and, inside the preview frame, the preview origin).
- `will-attach-webview` → `preventDefault`.
- `session.setPermissionRequestHandler` / `setPermissionCheckHandler` → deny
  by default.
- No `remote` module.
- Electron **Fuses** in packaged builds: `RunAsNode` off,
  `EnableNodeCliInspectArguments` off,
  `EnableNodeOptionsEnvironmentVariable` off, `OnlyLoadAppFromAsar` on,
  `EnableEmbeddedAsarIntegrityValidation` on (supported on macOS).

**LocalProjectWorkspace.** This is the real file adapter that replaces
Onlook's placeholder `NodeFsProvider`.
- The root is granted only through `dialog.showOpenDialog`. A test-only
  injection (env var or CLI flag) is allowed only in non-packaged test builds
  and must provably be ignored when `app.isPackaged`.
- Canonical root: `realpath`. Plus all Phase 1 path rules. Handle macOS
  specifics:
  - case-insensitive APFS (refuse case-variant aliases of a granted path);
  - Unicode normalization (NFC/NFD) of names;
  - `/private` and `/var` realpath aliases;
  - `.DS_Store` and editor temp files.
- **Atomic save sequence:**
  1. temp file in the same directory, opened with `wx`;
  2. write;
  3. `fsync` the file;
  4. `chmod` to the original mode;
  5. recheck the path (`dev`/`ino` of the parent directory) and the sha256;
  6. `rename`;
  7. `fsync` the directory.
- **Recovery journal (per D8):** a crash at any step leaves the old or new
  file plus a recoverable record, never a truncated file. On launch, detect
  leftover temp files and journal entries and offer *Restore* or *Discard*.
- Try to close the Phase 1 TOCTOU deferral. Node has no `openat`/`unlinkat`,
  so evaluate holding the parent directory and verifying `dev`/`ino` before
  and after `rename`. Document precisely whatever remains open.

**Watcher.** Detect external edits (VS Code, git checkout, formatter):
- debounce bursts and handle editors that save via rename;
- re-locate the selected element, or mark it stale with a clear message;
- the sha256 precondition still means an externally changed file is never
  overwritten.

**Preview supervisor (`LocalPreviewRuntime`).**
- Get explicit user permission (per D10) before running **any** project
  script.
- Spawn `next dev` from the project's own `node_modules/.bin`. Never `npx`,
  never a shell string, never a `package.json` script the user didn't
  approve.
- Fixed argv; scrubbed env (`PATH`, `HOME`, `NODE_ENV`,
  `NEXT_TELEMETRY_DISABLED=1`); bind `127.0.0.1` on an allocated free port.
- Structured startup errors: deps missing, port in use, crash, timeout.
- Kill the **process tree** on quit, crash, window close and project switch.
  Verify that no orphan `node` processes remain.
- The preview gets **no preload and no IPC**.

**No cloud contact.**
- Local mode imports nothing from Clerk, Railway or `allstudio/cloud`.
- Add a test-only `session.webRequest` logger and assert that across the full
  gate run every request goes to `app://`, `file://`, `devtools://` or
  `127.0.0.1`.
- Add an OS-level proof: run the app under `sandbox-exec` with a profile
  that denies outbound network except localhost, or record `lsof -i -n -P`
  / `nettop` for the app's process tree during the run.
- BYOK is **out of scope**. If any UI mentions it, label it "online — sends
  data to your provider".

## 6. Slice plan: one branch and PR per slice

Per slice:
1. Declare the files and the user-visible result.
2. Run the reuse-first gate.
3. Write the smallest end-to-end test first.
4. Implement.
5. Run every check (section 7).
6. Push a branch named `codex/phase-2-sN-<topic>` and open a **draft PR**
   against `main` with the delivery record (section 11).
7. If the founder triggers a Greptile review (`@greptile review`), iterate to
   **5/5**, at most 5 loops.

**Do not merge** without the founder's explicit OK. Stacked PRs are fine;
state the base in the PR.

| # | Slice | Evidence it must produce |
|---|---|---|
| S0 | **Decision PR:** `docs/decisions/ADR-0003-desktop-toolchain.md` comparing Electron version, build tool, packager, watcher, preview surface, `data-oid` strategy (URL, stars, license, last release, date checked). **Spike** on a throwaway branch: hello-world Electron window; preload exposes one function; `typeof require`, `process` and `ipcRenderer` are absent in the renderer and in an iframe; screenshot. | ADR plus spike output; answers to D1–D7 |
| S1 | `apps/desktop` skeleton: hardened window, CSP, navigation / window-open / webview / permission denials, `app://` protocol, renderer mounts `EditorShell` with a stub workspace. Root scripts `desktop:dev`, `desktop:build`, `desktop:test`; lint/typecheck/public-boundary cover the new app. | App launches; denials unit- and E2E-tested |
| S2 | `LocalProjectWorkspace` and IPC handlers implementing `SourceEditWorkspace`; shared validation module; port **every** Phase 1 adapter test (path, symlink, hard link, UTF-8, mode, stale hash, call order, invalid patch). Playground unchanged in behavior. | Text and class edits through real IPC write real files |
| S3 | Atomic save (`fsync` file and directory), recovery journal, startup recovery UI. **Fault injection:** `SIGKILL` the main process at each step (after temp write, after file fsync, after rename, before directory fsync), relaunch, assert old-or-new content and that recovery is offered. | Gate 2 (interrupted save) |
| S4 | Preview supervisor: permission prompt, process-tree cleanup, structured errors, port allocation. | Gate 1 preview; non-destructive failures |
| S5 | Watcher plus external-edit and hash-conflict UX (external save, delete, rename, `git checkout`). | Gate 2 (watching, conflicts) |
| S6 | Undo/redo (per D9) as inverse splice edits with sha256 preconditions, so undo never clobbers an external change. | "atomic save/undo" from the Build list |
| S7 | **Security negative suite** (Playwright `_electron`). From the preview frame: `postMessage` spoofing, a forged nonce, `window.top` access, `window.open`, `location` changes, injected `<webview>`, and attempts to reach the preload API. Path attacks: `..`, absolute, backslash, NUL, symlinks and hard links out of root, case-variant and Unicode aliases, unauthorized roots. **Show each test failing with its guard removed, then restore.** | Gate 3 |
| S8 | **Offline gate run.** Copy all three fixtures to a temp dir and preinstall dependencies. With network blocked (sandbox-exec profile or equivalent): launch → open → grant scripts → preview → edit text and class → save → quit → relaunch → reopen → assert the `git diff` of the project. Include the request log and the OS-level network proof. | Gates 1 and 4 |
| S9 | **Packaging.** Build the macOS package (per D3/D12; ad-hoc-signed is fine) with fuses; run S8's flow and an S7 subset **against the packaged app**. Verify fuses with `npx @electron/fuses read` (or the equivalent tool you adopted). Also add the CI job for the Linux package and Electron E2E under `xvfb-run` (if D4 is approved). | Gate 5 |
| S10 | `docs/validation/PHASE-02.md` gate closure table (same style as PHASE-01.md), `apps/desktop/CLAUDE.md` invariants, `docs/provenance/README.md` updates, `HANDOFF_FOR_CLAUDE.md` "Phase 2 status", and a list of open founder decisions. | Evidence package for the founder and for Claude's refinement pass |

Use the three Phase 1 fixtures (`examples/nextjs-site-fixture`,
`nested-components-fixture`, `tailwind-variants-fixture`) as the "existing
projects". Always **copy them to a temp directory** first. **Never write into
`examples/`.**

## 7. Checks to run on every PR (record the exact command, exit code and key output)

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test
bun run validate:public-boundary
bun run build
# Phase 1 browser E2E still passes (playground):
ALLSTUDIO_RESET_WORKSPACE=1 bun run dev   # in another terminal
node scripts/e2e/text-edit.e2e.mjs <out-dir>
node scripts/e2e/build-edited-workspaces.mjs
# Desktop (once S1+ exist):
bun run desktop:test
```

- An unrun test is `NOT RUN`, never `PASS`. CI passing alone does not clear a
  gate.
- Negative tests must be shown to **fail** with the protection removed, then
  pass with it restored. Record both runs.
- Don't commit large binaries (traces, videos, packaged apps). Document how to
  regenerate them, and attach screenshots to PRs where useful.
- At most **one** diagnosis-driven automatic CI repair rerun per failure.
  Report recurring failures with logs and hypotheses.

## 8. Manual checks the founder runs (prepare exact steps for them in PHASE-02.md)

1. **Wi-Fi off:** launch the packaged app, open a fixture copy, preview,
   edit, save, quit, reopen, and check `git diff`.
2. **Real folder picker:** open a project via the native dialog; try a folder
   containing a symlink out of the root.
3. **External edit:** with the app open, edit the same file in VS Code and
   save; the app must show a conflict or stale state, never overwrite.
4. **Crash:** `kill -9` the app during a save loop; relaunch and check the
   recovery prompt.
5. **Gatekeeper/first launch** of the packaged build (unsigned/ad-hoc
   behavior noted).

Write these as a numbered checklist with the expected result for each, so the
founder can tick them off.

## 9. Hard constraints (non-negotiable)

- **Public repo only.** Never import or reference private `allstudio/cloud`
  code or secrets. Local mode needs no network and no login.
- **No new substantial third-party dependency** unless its D-item is
  checked. Every adopted OSS package: canonical repo URL, **≥1,000 stars**,
  license, last release, date checked, recorded in the ADR/PR.
- No paid external calls, deployments, license changes or destructive
  operations (`rm -rf` outside temp dirs, force-push to `main`, history
  rewrites on shared branches).
- Untrusted previews never receive a privileged bridge. **When in doubt,
  deny.**
- Onlook (`onlook-dev/onlook`, pinned `423e2e9`, Apache-2.0) and the older
  `onlook-dev/desktop`: read for reference. Copy only with the license
  verified, and with provenance recorded in `docs/provenance/README.md`
  (upstream path, commit, destination, modifications). Never copy Onlook
  trademarks, `assets/`, UI, sandbox or `EditorEngine`. Onlook's
  `NodeFsProvider` is a placeholder; don't reuse it.
- Never mark a phase PASS. Never edit specs or roadmap text to legitimize a
  guess.
- **Commits and PRs:** don't put AI model names or identifiers in commits,
  PR titles/bodies or code comments. Write clear commit messages. Never push
  directly to `main`.

## 10. Founder-first decision protocol (mandatory)

When something material is unspecified, stop and ask in this exact form:

```text
I need your decision on [feature/behavior].
A: [behavior and trade-offs]
B: [behavior and trade-offs]
I recommend [A/B] because [specific reasoning].
Which should allstudio use?
```

While waiting, you may do read-only research and **independent** approved
slices. Don't implement the blocked choice. If the founder is away, write a
visible **BLOCKED — FOUNDER DECISION** section in the PR and in
`PHASE-02.md`.

## 11. Delivery record (end of every PR body, mandatory)

```md
## Delivery record
**Roadmap phase / acceptance criterion:**
**Founder approvals or unresolved decisions:**
**OSS candidates:** canonical GitHub URLs, stars and checked dates, licenses, comparison
**REA:** used / not available / not applicable; actual evidence, limitations, authorization
**Files changed and visible result:**
**Tests run:** exact commands, exit states, and outputs
**Real-world proof:** reproduction steps + observed files/UI/preview behavior
**Negative/security/regression checks:**
**Not run, failures, and risks:**
**Gate recommendation:** READY FOR HUMAN VALIDATION | BLOCKED | INCOMPLETE
```

## 12. Handoff to the Claude Code refinement pass

When you finish (or stop), leave:
- All slice branches pushed and draft PRs open, each with a delivery record.
- `docs/validation/PHASE-02.md` with:
  - a gate-by-gate evidence table: each gate is evidenced, `NOT RUN` or
    `BLOCKED`, with the reason;
  - the environment record from section 4;
  - the founder's manual checklist from section 8;
  - known limitations;
  - the remaining TOCTOU/recovery caveats.
- **Mac-only evidence written down explicitly** (FSEvents watcher behavior,
  APFS case/Unicode handling, the packaged `.app` run, fuse readout). The
  refinement pass runs in a Linux cloud container and cannot re-run
  macOS-only checks.
- A short "Open questions for Claude review" list: risky areas, shortcuts
  taken, tests you think are weak.
- The final message: a summary per gate, the PR list, open founder decisions,
  and your gate recommendation (never PASS).
