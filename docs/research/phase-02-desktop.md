# Phase 2 — desktop research and decisions

Date: 2026-10-25. Status: founder approved the initial toolchain and D6/D7 spikes on 2026-10-25; S0 installed and executed below.

## Feature and evidence boundary

RoadMap Phase 2: open an existing supported project, edit, save, quit and reopen offline in Electron. Source stays canonical; the same `SourceEditWorkspace` contract and `EditorShell` must be used. Phases 0 and 1 are founder PASS, reconfirmed in the implementation chat on 2026-10-25. Phase 2 is started, not PASS.

REA: not applicable to this initial runtime/tooling comparison. Public Electron/Next.js docs and licensed Onlook source are sufficient; no competitor runtime, private internals, or decompiled code inspected. No REA call performed.

## Verified OSS eligibility

Canonical GitHub REST repository metadata and npm registry package metadata fetched directly on 2026-10-25. Counts are observations, not quality endorsements. All repositories below were non-archived when checked. No fit-test installation has run; versions below are candidates, not approvals.

| Candidate | Canonical repository | Stars | License | Evaluated version or commit | Last push (UTC) |
|---|---|---:|---|---|---|
| Electron | https://github.com/electron/electron | 123544 | MIT | 45.0.0, npm latest, published 2026-10-21 | 2026-10-25 |
| electron-vite | https://github.com/alex8088/electron-vite | 5636 | MIT | 6.0.0 / `23d7bfc8ba4a0f877ed4ef8ab193f2baedea50c2` | 2026-10-14 |
| Electron Forge CLI | https://github.com/electron/forge | 7163 | MIT | 8.0.1 / `48f38bb11debbd16737071f20784ff9c09ec502c` | 2026-10-22 |
| electron-builder | https://github.com/electron-userland/electron-builder | 14685 | MIT | 26.18.0 | 2026-10-25 |
| Playwright | https://github.com/microsoft/playwright | 98487 | Apache-2.0 | @playwright/test 1.64.1 / `cfe490d941f992655948eee8fd4fd94e1c4234bf` | 2026-10-25 |
| esbuild | https://github.com/evanw/esbuild | 40108 | MIT | 0.28.2 / `609683d892977362a0f99026cb74b96263d728a9` | 2026-08-09 |
| Onlook (existing approved baseline) | https://github.com/onlook-dev/onlook | 27002 | Apache-2.0 | local baseline verified at `423e2e924366419e418ee049093872d535eea41a` | 2026-10-21 |

GitHub endpoint for each row: `https://api.github.com/repos/<owner>/<repo>`; npm endpoint: `https://registry.npmjs.org/<package>`. Preserve MIT/Apache notices when distributing. Transitive license/security inventory, package contents, Electron 45 / Playwright compatibility and packaged runtime behavior are NOT YET VERIFIED. Recent commits do not establish security fitness. All proposed toolchains execute build code and download dependencies; install permission remains explicit.

## D1–D4: runtime, build, packaging, tests

- Electron 45.0.0 requires Node >=22.12.0 according to npm metadata; host Node 22.22.3 satisfies it. This is the S0 candidate, not a completed feasibility spike.
- Recommend electron-vite 6.0.0 for separate main/preload/renderer builds, with electron-builder 26.18.0 for early unpacked Mac .app proof. Node requirement is ^20.19.0 or >=22.12.0. One build configuration avoids writing our own development supervisor. See [electron-vite guide](https://electron-vite.org/guide/) and [distribution](https://electron-vite.org/guide/distribution). The public guide still displays v5.0.0; verify v6 release behavior during the spike.
- Forge 8.0.1 is a credible integrated alternative; its Node requirement is >=22.13.0. [Forge's Vite plugin documentation](https://www.electronforge.io/config/plugins/vite) still labels that integration experimental and allows breaking changes in minor releases. Pinning limits accidental upgrades but does not prove compatibility.
- Plain esbuild/tsc plus the existing Vite renderer removes the Electron-specific build wrapper but requires original build/watch/launch wiring. Not recommended for this first slice when qualifying tools already cover it.
- Recommend Playwright 1.64.1 and a Linux xvfb CI job. Its [Electron automation API](https://playwright.dev/docs/api/class-electron) is experimental. Successful browser automation cannot substitute for an actual Mac packaged app run.
- D12 recommendation: unsigned/ad-hoc local packaging for the gate; Developer ID signing/notarization remains later distribution work. No claim that Gatekeeper accepts public distribution.

## D6: hostile preview surface

OBSERVED: `packages/editor/src/shell/use-preview-bridge.ts` targets an iframe window; `preview-bridge/protocol.ts` checks origin, source window, bounded message shape and a 24-byte nonce. The existing `SourceEditWorkspace` describes a validated IPC adapter and never grants raw filesystem access to the editor.

Recommend A: cross-origin sandboxed iframe, reusing this bridge. Electron [documents iframe sandboxing](https://www.electronjs.org/docs/latest/tutorial/web-embeds). This keeps the smallest existing editor integration. Alternative B: WebContentsView with a dedicated session provides separate session control, but requires view placement and a new communication integration; it is not a drop-in replacement for the current window-based bridge.

[Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security) requires isolation and sender validation; possession of a nonce does not authorize file writes. Main must check the exact trusted top-level frame and webContents, reject preview/subframe senders, validate every argument, reject untrusted navigation/windows, deny unexpected permissions and expose no generic IPC/command API. Child project code execution still needs explicit user consent; browser sandboxing alone does not isolate a Node dev server from the host.

Fit test: NOT RUN. S0 must attempt IPC from preview content and prove it is denied before this choice is retained.

## D7: source instrumentation

OBSERVED: the pinned Onlook parser uses in-source IDs; the existing allstudio `prepareWorkspace` instruments a disposable copy, copies the bridge and writes an instrumentation client file. Its reset/delete/copy path is development-only and must never run against user projects. The Onlook preload/parent sources use wildcard allowedOrigins; those are not suitable replacements for allstudio's hardened bridge. See existing provenance record for the licensed baseline.

Recommend B as a spike: inject IDs only into preview compilation. Keep a deterministic mapping to original source/hash and apply edits to uninstrumented source through the existing mapper; prove ID stability across refresh and stale selection rejection. This needs an extension/adaptation of current mapping behavior; no implementation is approved by this note.

A (persist IDs in source) is simpler and aligns with the Phase 1 editing representation but changes user source and leaves export stripping unresolved. C (shadow copy plus sync-back) reuses the fixture preparation concept but introduces another tree, synchronization conflicts and disk/process overhead.

[Next.js compiler docs](https://nextjs.org/docs/architecture/nextjs-compiler) expose experimental WASM SWC plugins and describe Babel fallback. Neither establishes a transparent transform for every existing Next.js configuration. The initial proof must use the repository's actual pinned fixtures and demonstrate no user config/source mutations from merely opening a project. If that proof needs a different preview build mode or config edits, bring the material choice back to the founder. No universal Next.js compatibility claim.

## Remaining founder choices

D5 recommend built-in recursive fs.watch first; treat events as invalidations and re-read hashes, including rename/replacement. Not adopted yet.

D8 recommend recovery journal in Electron userData, keyed by canonical project identity, to avoid silently adding recovery data to user repositories. D9 recommend session-only undo with hash preconditions; journal recovery remains durable independently. D10 recommend explicit consent before executing project code, showing project root and exact executable/arguments, with a separate opt-in to remember the grant. D11 recommend JSON in userData. These are proposals requiring founder answers, not defaults already approved.

Network installs/downloads and small additional dev-only dependencies remain unapproved. No blanket dependency exception assumed.

## Decision request

Decision needed: approve the S0 toolchain/installation scope and choose D6 and D7.
Why it matters: controls native privileges, project-source mutations and what can be validated in a packaged app.
What is known: official documentation and existing code support the alternatives above; installed runtime fit tests have not run.
Options: recommended toolchain + iframe + preview-only injection spike; Forge and/or separate view and/or persisted IDs or shadow copy, with the trade-offs above.
My recommendation: electron-vite + electron-builder, iframe and preview-only instrumentation feasibility spike, with exact pins and negative tests.
Blocked work: dependency installation, `apps/desktop` scaffolding, preview instrumentation and Electron S0 execution pending explicit answers. D5 and D8–D11 block their later feature slices.

## Founder approvals and executed S0 (2026-10-25)

Founder approved Electron 45.0.0, electron-vite 6.0.0, electron-builder 26.18.0 and Playwright 1.64.1, network installation/downloads, Linux xvfb CI and unsigned/ad-hoc local Mac packaging. D6=A (sandboxed cross-origin iframe) and D7=B (preview-only instrumentation feasibility) approved. Earlier pending-decision sections above preserve the original proposal; this approval section supersedes their status.

Also approved for subsequent slices: D5 built-in recursive fs.watch; D8 recovery journal in userData; D9 session-only undo/redo; D11 JSON recent projects and grants in userData; D10 the exact consent wording and remembered-grant invalidation from the decision cards. No blanket extra dependency exception was granted.

S0 fit test executed: `bun run build:desktop`, `bun run test:desktop`, `bun run package:desktop`, and `node scripts/e2e/desktop.e2e.mjs apps/desktop/dist/mac-arm64/allstudio.app/Contents/MacOS/allstudio`. Six checks passed in both development and the actual unsigned arm64 .app. This proves shell/IPC/isolation smoke behavior, not the Phase 2 offline-editing gate. Screenshots and traces are under ignored `apps/desktop/dist/evidence/{development,packaged}/`.

Independent S0 reviewer found no actionable issues in the bounded shell scope. Reviewer executed the two security unit tests, not the Electron runs. Linux CI currently uses `--no-sandbox`; its preference check is not evidence of an effective Linux OS sandbox. Cross-origin frame tests prove bridge absence and parent-access denial; direct subframe IPC rejection has only the exact-frame unit check so far. The editor-content smoke assertion was added following the review's evidence-limit note.
