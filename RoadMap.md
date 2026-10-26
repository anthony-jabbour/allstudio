# allstudio — Development Roadmap

> **Status:** DRAFT for founder/engineering review; not an implementation report  
> **Version:** 0.1 · **Prepared:** 2026-10-24  
> **Scheduling:** **No deadlines, dates, or time estimates.** Progress is measured by verified working capabilities.  
> **Repositories:** `allstudio/allstudio` (public, Apache-2.0) and `allstudio/cloud` (private, proprietary) are *planned repository names*, not evidence of created repositories.  
> **Related files:** `PRD.md`, `ARCHITECTURE.md`, `ONLOOK_INTEGRATION.md`, `Techstack.md`, `CODEBASE_ARCHITECTURE.md`, `REPOSITORY_ARCHITECTURE.md`, `AGENTS.md`, `CLAUDE.md`.

## 0. Purpose and governing philosophy

Build allstudio **as a sequence of demonstrated, shippable capabilities**, not a sequence of AI-generated phases that appear finished until the entire project is integrated. Claude Code, Cursor, and Codex may generate and review code, but **observed behavior and reproducible evidence—not an agent's confidence—determine completion**.

**Operating principle: _small change → fast local feedback → realistic integration test → independent review → controlled release_.** Every phase must improve a running application, not merely add scaffolding. Keep integration continuous; do not save the hard parts for the end.

This philosophy is influenced by Stripe's public writing on Minions and its engineering benchmarks: agents perform bounded implementation tasks; deterministic programs perform repeatable checks; environments are isolated; humans review; real browser/API outcomes are tested. This is **our adaptation**, not an assertion that we verified the content of the specific YouTube video shared in planning.

**Source basis:**
- https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents
- https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2
- https://stripe.com/blog/can-ai-agents-build-real-stripe-integrations

### 0.1 Product boundaries that the roadmap must honor

- **Product:** local-first, web-native design studio with a Paper-inspired creative canvas and an Onlook-derived code-aware site editor. Not limited to a static website builder.
- **Website/site surface:** supported Next.js + React + Tailwind CSS source remains canonical; visual edits must affect actual source files.
- **Creative board surface:** deliberately bounded artboards persisted as portable `.allstudio/boards/*` documents; conversion to code is explicit and is **not** presumed lossless.
- **Desktop:** Electron, with privileged main process, narrow preload bridge, unprivileged renderer, and separate untrusted preview context.
- **Open-core boundary:** public `allstudio/allstudio` is Apache-2.0 and builds without cloud dependencies; private `allstudio/cloud` contains hosted Next.js app, Railway services, Clerk, PostgreSQL/Drizzle, metering, billing, and premium agents.
- **Shared editor:** private hosted app consumes a pinned public `@allstudio/editor` release; never maintains a second fork of the editor.
- **Cloud AI:** OpenRouter behind private worker/service; cloud user code runs in isolation, never inside the main API or agent process.
- **Local AI:** supported BYOK and approved local integrations, with scoped capabilities; consumer ChatGPT/Claude subscriptions are not assumed to grant API usage.
- **Portability:** complete local ↔ cloud project transfer is **P0**; automatic multiplayer synchronization is not.
- **Source reuse:** reproduce and study a pinned Onlook revision **before** extracting components; preserve upstream provenance and licenses. OpenDesign is an optional reference, not a second mandatory runtime.

**Planning reconciliation:** the original v0.1 `PRD.md`, `ARCHITECTURE.md`, `ONLOOK_INTEGRATION.md`, and `Techstack.md` contain older language (for example, website-only scope, Electron not yet locked, transfer marked P1, or a single public/private repository assumption). The agreed **v0.2** `CODEBASE_ARCHITECTURE.md` and `REPOSITORY_ARCHITECTURE.md` and the decisions above take precedence **for this draft**. Reconcile the older files in a separately reviewed documentation change; never silently rewrite product requirements.

## 1. Rules of execution (apply to every phase)

1. **Build vertical slices.** A completed feature includes the UI, runtime/persistence, error handling, and end-to-end proof necessary for a real user action. Interfaces and stubs are not a deliverable on their own.
2. **Define evidence before implementation.** Each task begins with a user-observable result, fixtures, test plan, edge cases, and allowed code boundaries.
3. **Use real environments.** Fixtures are real runnable projects; tests inspect source diffs, browser behavior, files on disk, and/or persistent database state. Mocks may support unit tests but cannot substitute for integration proof.
4. **Fail closed.** Unsupported edits, authorization failures, unsafe paths, untrusted code, and exhausted budgets must not silently succeed or corrupt user state.
5. **Preserve earlier guarantees.** Every phase reruns a smoke suite for all previously accepted capabilities. Regression failures reopen the affected gate.
6. **Review independently.** Implementation agent self-assessment does not count as independent review. A separate reviewer (for example Codex) identifies risks, while a human checks the actual user workflow and authorizes promotion where appropriate.
7. **Make releases small and reversible.** Expose validated increments behind alpha/beta channels or flags; rollback and recovery are part of a feature, not a later luxury.
8. **Do not confuse CI with quality.** Build, lint and typecheck are baseline checks. Reliability, usability, visual quality, data integrity and cost require distinct evaluation.
9. **Do not mark unrun tests as passed.** A blocked or unavailable environment is `BLOCKED`/`NOT RUN`, never `PASS`.
10. **No premature platform.** Add packages, queues, workers, abstractions, and services only when a working capability requires them. No 21-package scaffolding or speculative infrastructure.

### 1.1 Definition of done: task, phase, release

**Task is done** when the scoped implementation works, relevant fast tests pass, a targeted integration/behavior check is observed, risks are documented, and the PR receives review.

**Phase is done** when all *mandatory* gate scenarios pass against the integrated product; a human can reproduce the headline workflow; negative/failure paths are exercised; prior phase smoke tests pass; and the phase evidence record is approved. Partial tasks may merge behind inactive feature flags but **do not close the phase**.

**Release is ready** only when the relevant phase gates, packaging, privacy, security, documentation, recovery and rollout checks all pass for the features actually exposed. A public demo may be labeled experimental, but it may not be advertised as reliable or secure without evidence.

### 1.2 Standard validation record (required for every gate)

Store a gate report in `docs/validation/PHASE-XX.md` **when a repository exists**. Do not create blank reports merely to appear complete. The report must record:

```md
# Phase XX — Validation report
Status: NOT STARTED | IN PROGRESS | BLOCKED | PASS | FAIL
Scope / commit SHA / environment / reviewer:
User-observable outcome:
Fixtures and manual reproduction steps:
Automated checks: command, exit code, results, artifact links:
Integration/E2E evidence: screenshots, traces, file diffs, logs (redacted):
Negative and recovery cases tested:
Regression checks from previous phases:
Security, privacy, performance, accessibility observations:
Known limitations and unresolved defects:
Decision: PASS / FAIL / BLOCKED — approved by human reviewer:
```

Never fabricate logs, screenshots, tests, performance numbers, reviewer approvals, or deployed URLs. Sensitive inputs must be redacted. A failing test blocks the gate until fixed or a consciously **re-scoped and documented** acceptance criterion is approved; it is not silently waived.

### 1.3 Implementation/review rhythm

```text
Select next unblocked acceptance criterion
  → create small issue + test fixture / clear manual reproduction
  → one agent implements in isolated branch/worktree
  → run fast targeted local checks (format/lint/types/unit)
  → run integration/E2E proof and negative cases
  → independent code/security review + human workflow demo
  → selective CI (limit automatic CI repair attempts; escalate repeated failures)
  → merge behind flag or promote to alpha/beta when permitted
  → record evidence and regression coverage
```

Claude Code is a primary implementer, Cursor assists with UI and focused debugging, and Codex may provide independent review or tests. Tool roles are flexible, but **never have multiple agents concurrently edit the same files without explicit ownership**. Automatic repair loops should be bounded; if repeated attempts fail, stop, diagnose, and revise the task rather than burn credits.

## 2. Phase overview (dependency order, NOT schedule)

| Phase | Capability unlocked | Primary repo | Earliest release checkpoint |
|---|---|---|---|
| 0 | Reproduced Onlook baseline + trustworthy engineering harness | Public/evaluation fork | Internal proof |
| 1 | Real JSX/DOM code-aware editing | Public | Internal functional demo |
| 2 | Electron-native, offline, persistent editing | Public | Internal desktop preview |
| 3 | Usable professional visual workspace | Public | Editor alpha |
| 4 | Portable creative boards | Public | Design-studio alpha |
| 5 | Local BYOK agent + scoped MCP | Public | Local-first beta |
| 6 | Hosted workspace on Railway + Clerk | Private | Cloud internal alpha |
| 7 | Local/cloud transfer + scoped GitHub | Both | Portability beta |
| 8 | Bounded premium generation of editable projects | Private | Invite-only agent alpha |
| 9 | Visual-quality evaluation and refinement | Private | Premium quality beta |
| 10 | Reliable billing/credits + hosted MCP | Private | Paid-beta eligibility |
| 11 | Release readiness and observed user success | Both | Broader V1 release |

**Release hardening is continuous from Phase 0.** Phase 11 is a final accumulation of launch requirements, not the first time anyone installs, tests, or ships the app. Independent, non-blocking tasks may run in parallel, but no dependent gate can be marked passed until its prerequisites pass.

## 3. Public editor: verified vertical slices

### Phase 0 — Foundation, provenance, and Onlook baseline

**Outcome:** a contributor or coding agent can reproduce a known-good starting point and demonstrate what Onlook actually does.

**Build only:** minimal public repo, developer setup, lockfile/tool versions, sample runnable Next.js/Tailwind fixture, targeted CI, upstream commit pin/provenance record, initial agent instructions. Maintain an external Onlook fork/worktree for the initial spike; do not copy an entire unexamined upstream repo into the production tree.

**Gate tests (real evidence):**
- Clean checkout/install/build using a pinned toolchain; record successes and failures.
- Run sample project and trace **DOM selection → source location → style/text mutation → JSX/CSS diff → browser refresh** in Onlook.
- Review included module licenses/assets and document source paths, commit SHA, and dependencies.
- Verify the proposed public project has no private credentials or `allstudio/cloud` dependency.

**Exit:** reproducible source baseline, documented limitations, and at least one observed end-to-end editing flow **or** a documented upstream blocker plus a successful isolated parser/source-edit spike that enables Phase 1. An unverified claim that Onlook works is **not** a pass.

### Phase 1 — Code-aware editing engine

**Outcome:** the browser playground edits real source files from supported Next.js/React/Tailwind projects.

**Build:** smallest coherent Onlook-derived parser/preview/selection/editor command slice; source mapping, safe AST/style/text patches, live refresh, unsupported-edit errors, regression fixtures. Keep actual code canonical.

**Gate tests:**
- Test **at least three** representative runnable fixtures with nested React components, Tailwind variants, and realistic project structure.
- Select heading/button/layout elements and verify the expected **source file and lines** change; build/preview reflects the change.
- Edit dynamic/conditional markup: either preserve semantics or return a clear unsupported result **without source corruption**.
- Test no-op transformations, changed-source/hash conflicts, and edits affecting unrelated nodes.
- Independent source diff review, plus a screen recording or Playwright trace of one complete interaction.

**Exit:** real source mapping and round-trip editing are repeatable; failures are safe and diagnosable. This is the first **critical feasibility gate**.

### Phase 2 — Electron and real local-first behavior

**Status:** PASS — founder validated on 2026-10-26: “Phase 2 has my validation.” Implementation merged through PRs #11–#14 at `91fd9d8`; evidence: [Phase 2 validation](docs/validation/PHASE-02.md).

**Outcome:** a user opens an existing project, edits, saves, and reopens it offline in an actual Electron application.

**Build:** Electron main/preload/renderer; minimal validated IPC surface; project-folder grants; actual Node file adapter (not Onlook's placeholder `NodeFsProvider`); file watcher; preview process lifecycle; atomic save/undo; permissioned script execution.

**Gate tests:**
- With dependencies preinstalled and network disabled: launch, open, preview, edit, save, quit, reopen, and inspect source changes on disk.
- Verify file watching, external edit/hash conflicts, data restoration after interrupted save, and non-destructive failure handling.
- Attempt `..` traversal, symlink escapes, unauthorized paths, untrusted navigation, and IPC calls from preview content; deny access.
- Verify a locally opened project neither requires nor silently contacts Clerk/Railway; explicitly distinguish online BYOK requests.
- Test from a packaged app as soon as packaging supports it, not only a developer run.

**Exit:** a trusted local workflow survives restarts and disconnection; no known privileged-preview access. Do not advertise “offline-first” before this gate.

### Phase 3 — Professional code-aware design workspace

**Outcome:** a user can perform everyday website/UI edits through the actual canvas without opening code manually.

**Build:** original Paper-inspired shell; layers, selection, typography, spacing, color, supported layout controls, responsive frames, assets, relevant keyboard interactions, meaningful undo/redo, clear unsupported-action feedback.

**Gate tests:**
- Task-based walkthroughs: modify a hero, adjust a responsive section, change typography/tokens, rearrange a supported component, save/export.
- For every operation, compare UI result, real source diff, and refreshed preview; test undo/redo and restart.
- Check keyboard navigation/focus, relevant accessibility properties, common viewport sizes, and basic interaction responsiveness.
- Observe several people unfamiliar with implementation attempting defined tasks; record friction and corrections, not just opinions.

**Exit:** the editor is useful for defined workflows without an AI agent. **Candidate for an explicitly labeled editor alpha** once security and packaging gates for that distribution pass.

### Phase 4 — Creative board / artboard editing

**Outcome:** allstudio supports bounded Paper-style visual exploration without pretending Onlook is a universal freeform editor.

**Build:** boards with frames, text, images, basic shapes/blocks, basic grouping/positioning, portable assets, property inspector reuse, versioned `.allstudio/boards/*.json` persistence; **explicit** limited board-to-site export.

**Gate tests:**
- Create, modify, close, reopen offline, and export a board; compare structure and rendered results at specified viewports.
- Migrate an older fixture board schema to the current version without losing data.
- Convert a supported board fixture into a runnable site scaffold and verify which properties map and which do not.
- Confirm board editing cannot unintentionally overwrite a separate code-backed site.

**Exit:** two distinct data surfaces share a coherent editor UI; portable boards work without cloud. Do not claim arbitrary lossless board ↔ JSX conversion.

### Phase 5 — Local AI, BYOK, and scoped MCP

**Outcome:** optional local AI safely operates on actual editable projects without an allstudio account.

**Build:** provider-key adapter(s), OS-protected credential storage, approved local agent connector(s), scoped MCP tools, previewed diffs/user approvals, cancellation, bounded tool calls. Prefer integrating one provider and one real edit task reliably before broad provider coverage.

**Gate tests:**
- A permitted agent reads a scoped project, proposes a change, applies it after any required approval, and leaves a valid/reopenable source tree.
- Invalid/expired credentials, denied edit permissions, out-of-root paths, prompt-injected tool responses, and cancellation fail safely.
- Offline manual editor remains completely usable when AI provider/network calls fail.
- Verify that no consumer subscription is used as an unofficial API credential.

**Exit:** local AI adds capability without becoming a requirement. **Candidate for a local-first beta**, after its distribution security checks pass.

## 4. Private cloud: verified vertical slices

### Phase 6 — Hosted app, identity, and project ownership

**Outcome:** signed-in users can open private cloud workspaces through the **same released editor** used locally.

**Build:** private Next.js modular backend on Railway, Clerk session validation, PostgreSQL/Drizzle, object storage, project/tenant ACL, hosted editor consuming exact pinned public packages; basic observability and recovery foundations.

**Gate tests:**
- Sign in, create workspace/project, persist a file-backed artifact, log out/in, reopen same authorized project.
- User A cannot enumerate/read/update user B's projects, previews, assets, or revision identifiers (IDOR/tenant tests).
- Private build resolves only versioned public packages; no duplicated editor implementation or private material in public output.
- Backup/recovery rehearsal of both database metadata **and** stored source artifacts before real customer data.

**Exit:** hosted editor has real project ownership and data persistence; no premium generation required yet.

### Phase 7 — P0 portability and GitHub handoff

**Outcome:** the same project moves **local → cloud → local**, maintaining source and asset integrity; GitHub transfers are explicit.

**Build:** versioned portable manifest, secure export/import archives, checksums, object storage transfer, revision compare-and-swap, conflict UI, scoped GitHub integration (import and user-approved export/commit).

**Gate tests:**
- Upload real edited project, open/edit hosted, download, and reopen offline in Electron; compare required source and assets using hashes.
- Reject unsafe archives, symlink/path escapes, secret-bearing files, oversized archives, unauthorized projects.
- Simulate diverged local/cloud heads: explicit conflict and fork/resolve behavior; **no silent overwrite**.
- GitHub read-only import and user-authorized write path using minimum permissions; denied/unapproved writes must not occur.

**Exit:** complete P0 portability exists. **Candidate for a cloud-workspace beta** even before premium generation is ready.

### Phase 8 — First autonomous cloud design agent

**Outcome:** cloud AI converts a brief into a **runnable, editable** website/project that opens in the public editor.

**Build:** durable job and event flow, private worker, OpenRouter adapter, bounded step orchestration (`brief → plan → edit/generate → build/preview → deliver`), sandboxed code/build execution, artifact promotion, cancellation and usage logging. The worker must not execute untrusted project code inside its own process.

**Gate tests:**
- Fixed brief suite spanning at least several distinct site types; produce compileable projects and inspect/edit them with the shared editor.
- Verify progress-event reconnect, idempotent retries, cancellation, timeouts, project permission checks, and resource/token/tool limits.
- Demonstrate sandbox isolation: no production credentials, no cross-project file access, restrictive process/network policy.
- Persist exact artifacts and actual model usage; no fabricated “credits spent” estimates presented as final invoices.

**Exit:** first true premium generation capability, **not yet a claim of industry-leading aesthetics**. Safe for a narrowly budgeted invite-only agent alpha after isolation review.

### Phase 9 — Quality engine and evidence-based design refinement

**Outcome:** users receive visibly stronger designs than a single-shot baseline, without sacrificing editability.

**Build:** curated design systems and original/licensed assets; deterministic layout/build/accessibility checks; responsive screenshot captures; model-assisted critique; capped repair passes; evaluations maintained as versioned fixtures. Do not train on or copy popular sites without rights.

**Gate tests:**
- Evaluate the **same frozen brief suite** against a documented single-pass baseline and the premium pipeline.
- Automated checks: site builds, key routes render, no material responsive overflow on agreed viewports, core controls function, basic accessibility checks pass.
- Human blind review: rate composition, hierarchy, typography, originality, coherence and usefulness; record raters/sample sizes and disagreement.
- Check that repairs do not regress functionality, source editability, cost caps, or prior successful cases.
- Require a **documented improvement criterion chosen before the evaluation run**, not a retrospective declaration of success.

**Exit:** measured quality improvement or a clearly identified blocker; agent-quality claims must match evidence. **Candidate for premium-generation beta** only when its quality target passes.

### Phase 10 — Credits, billing, and hosted MCP

**Outcome:** allstudio can charge for managed services without incorrect balances, unauthorized operations, or runaway spending.

**Build:** pricing from measured economics, durable credit ledger/reservations/settlement, Stripe subscription/webhook integration, credit history, enforced request and cost caps, hosted MCP authorization, rate/concurrency limits, refunds and crash recovery.

**Gate tests:**
- Concurrent spend requests never overdraw a credit account; retries and duplicate webhook deliveries never double-credit/debit.
- Worker failure, cancelled job, partial model usage, missing provider receipt, and budget exhaustion settle or reconcile predictably.
- MCP tools reject user/project-crossing access, forbidden operations, tool/byte/token/rate limits, and replay attempts.
- Run in payment test mode end to end and prove a real database outcome, not only a mocked HTTP `200`.
- Cost and failure-rate review before promising a free allowance or publishing pricing.

**Exit:** eligibility for **paid beta** only after finance/security checks pass; early invite beta may use strictly capped, non-purchasable trial allowance beforehand.

## 5. Phase 11 — Release readiness and real-user learning

**Outcome:** repeatable public/private releases with measured user success, recovery, and transparent limitations.

**Build:** signed/notarized macOS packaging, upgrades/rollback, crash diagnostics, privacy/telemetry defaults, tested backup restoration, performance baselines, accessibility fixes, public contribution guidance, status and support processes, staged rollout.

**Gate tests:**
- Clean-machine install → open local project → edit source → save → offline restart → export, using **shipped binaries**, not a dev build.
- Project transfer and premium generation replayed in staging with production-like limits; restoration from DB + object archives works.
- Test no confidential/private cloud source leaks into desktop/public packages, client bundles, logs or source maps.
- External users complete representative workflows; categorize failures and fix release blockers.
- Security, billing and project-data loss blockers are resolved; known limitations are in release notes.

**Exit:** approve only the feature set demonstrated by evidence. Phase 11 is not the first release; it is the broader V1 release readiness gate.

## 6. Release lanes (no calendar promises)

| Lane | Earliest gate | What may be shipped | Never claim |
|---|---|---|---|
| Internal prototype | Phases 0–2 | Demonstrable edit-to-source and Electron workflows | General reliability |
| Public editor alpha | Phase 3 | Manual code-aware editing with explicit supported fixtures | Arbitrary framework support |
| Local-first beta | Phases 4–5 | Bounded boards, local BYOK/MCP, offline editing | Unrestricted AI subscriptions or vector parity |
| Cloud workspace beta | Phases 6–7 | Authenticated hosting + reliable project portability | Real-time multiplayer sync |
| Invite-only agent alpha | Phase 8 | Capped generation that produces editable projects | Guaranteed beautiful results |
| Premium-quality beta | Phase 9 | Quality-measured agent pipeline | Quality superiority without evidence |
| Paid beta | Phase 10 | Credits, subscriptions, metered hosted tools | “Unlimited” inference |
| Broad V1 | Phase 11 | Only validated, released capabilities | Unimplemented items in planning docs |

A feature with its own accepted vertical slice may be shipped earlier behind a flag if its dependencies and security constraints permit. Release eligibility is not permission to skip **distribution-specific** packaging, privacy or security checks.

## 7. Standing test suites and fixtures

Develop the suites incrementally, never as empty green placeholders:

- **Source fixtures:** simple landing page; nested/conditional React components; responsive Tailwind layout; externally edited codebase; intentionally unsupported syntax.
- **Offline desktop smoke:** open/preview/edit/save/restart/export with network unavailable after installing dependencies.
- **Editor regression:** text/style/layout commands, accurate source diffs, undo/redo, conflicting edits, formatting preservation.
- **Board regression:** portable JSON, migrations, asset integrity, bounded export to new site scaffold.
- **Security:** native IPC caller validation, path/symlink traversal, project preview sandboxing, import/archive validation, tenant authorization, secret scans.
- **Project portability:** golden fixture hashes across local → cloud → local; schema compatibility and divergent heads.
- **Agent contract:** bounded token/tool budgets, cancellation, retries, isolated execution, idempotent result promotion, actual usage receipts.
- **Visual quality:** frozen briefs, screenshot fixtures, deterministic defects, blind human reviews with preregistered criteria.
- **Billing:** concurrency, duplicate webhooks, cancellation/partial settlement, test-mode purchase and recovery.

As tests become available, the root agent files should point to **real runnable commands**. Until then, agents must discover actual scripts rather than invent commands or treat placeholders as checks.

## 8. Agent operating contract (must be reflected in `AGENTS.md` and `CLAUDE.md`)

### 8.1 Coding agents

- Start by reading the roadmap, current phase/gate, relevant architecture, and actual source before modifying code.
- Define a small acceptance test **before** changing implementation; seek the shortest executable path to prove it.
- One agent owns a change set; separate agent performs independent review. Parallel work is permitted only with explicit file/contract boundaries.
- Run cheap deterministic checks first; then targeted integration/E2E; reserve full CI for a reviewable PR. At most one automated CI repair rerun after the initial run by default; further failures escalate to a human for diagnosis.
- Never declare success from code generation, static review, mocks alone, or the agent's confidence. Report actual results, omissions, and limitations.
- Do not auto-skip phase gates, silently alter roadmap/architecture, downgrade security, disable tests, or broaden scope to make a demo pass.
- Never leak private cloud implementation, secrets, credentials, or nonredistributable third-party assets into the Apache-2.0 repository.
- Completion response for every substantive task: **Changed / Tests run + results / Real-world proof / Risks or known failures / Gate status**.

### 8.2 Product agent (allstudio's cloud generation agent)

The same philosophy applies to the product we're building, not only to the tools building it:

1. Plan the user's design intent and source/project constraints.
2. Generate or edit code in an isolated, versioned workspace.
3. Run deterministic checks (parse/build, required routes, basic interaction, responsive overflow) before any aesthetic self-critique.
4. Render actual browser previews, then critique composition and repair defects within a **hard budget**.
5. Preserve an editable project revision and show remaining limitations; never claim a preview equals a complete runnable site.
6. Reconcile provider usage, cancel/timeout safely, and stop on caps. Production authorization and credit enforcement live outside the model's prompt.
7. Use curated, permitted assets and source references; never treat arbitrary popular sites as a free training/copying set.

The cloud agent's aesthetic judgment is probabilistic; tests, sandbox isolation, cost limits and project integrity are deterministic backend responsibilities.

## 9. Non-goals and changes to the roadmap

**Not V1:** multiplayer CRDT editing, Penpot-class vector engine, arbitrary framework import, automatic bidirectional sync, fine-tuning a foundation model, advanced CMS/publishing systems, unlimited inference, or unapproved consumer-subscription reuse.

**Roadmap change policy:** anyone may propose a change through an issue or ADR describing motivation, dependencies, impact on gate tests, and public/private boundaries. The founder/maintainer explicitly approves scope changes. A coding agent must **not** mark phases passed, change acceptance criteria after failure, or modify architectural decisions unilaterally.

**Current state:** all phases are **NOT STARTED / NOT VALIDATED** until real implementation and evidence exist. This draft intentionally contains **no delivery deadlines**.
