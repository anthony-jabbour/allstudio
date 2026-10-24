# allstudio — Product Requirements Document (PRD)

> **Status:** Draft for implementation planning (not shipped)  
> **Version:** 0.1 · **Updated:** 2026-10-24  
> **Product:** allstudio · **Domain:** allstudio.dev  
> **Audience:** founders, design, product, engineering, contributors  
> **Companion documents:** [ARCHITECTURE.md](./ARCHITECTURE.md), [ONLOOK_INTEGRATION.md](./ONLOOK_INTEGRATION.md), [Techstack.md](./Techstack.md), [CODEBASE_ARCHITECTURE.md](./CODEBASE_ARCHITECTURE.md), [REPOSITORY_ARCHITECTURE.md](./REPOSITORY_ARCHITECTURE.md)

## 1. Executive summary

allstudio is an **open-source, local-first visual website design studio** with an optional paid cloud experience. It combines a professional, Paper-inspired visual workspace with a code-aware editor and a premium chat-driven agent that creates **real, editable websites**. Designers can work locally without an account or mandatory subscription. Cloud users can sign in, host projects, access a higher-quality autonomous design-generation workflow, and consume credits with enforced limits.

**Positioning:** the editor is a serious daily tool even without AI; AI is an optional accelerator, not the sole interface. **V1 focuses on Next.js + React + Tailwind CSS website projects**, not general-purpose Figma/Penpot vector design.

**Source strategy:** selectively extract Onlook's open-source DOM-to-code editing systems, retain provenance and license notices, adapt the runtime to genuine local filesystem projects, and create allstudio-specific UI, cloud services, and design-quality orchestration. OpenDesign supplies reference implementations and potentially licensed design-system/agent assets only after separate evaluation. Do **not** merge three full applications.

**Locked decisions:** product name/domain; Railway for cloud deployment infrastructure; Clerk for cloud authentication; PostgreSQL on Railway; OpenRouter for cloud model access; GitHub as the initial third-party integration; local mode without a mandatory account; hard enforced cloud MCP/credit limits.

## 2. Problem and opportunity

Current design-to-code products can produce generic results, make generated markup hard to edit, or require cloud access for everyday work. Advanced users need a durable editor with ownership of files, while beginners need a guided experience that outputs polished, responsive designs without learning a full editor first.

The opportunity is to connect **brief → high-quality generated design → editable real code → developer handoff**, with a clean switch between local and hosted execution.

## 3. Users and jobs to be done

| Persona | Needs | Primary workflow |
|---|---|---|
| Independent designer | Fine visual control, predictable export, offline capability | Open local project → design → save/export |
| Frontend developer | Edit existing React/Tailwind code visually without code drift | Import repo → inspect DOM → modify → commit |
| Founder / non-designer | High-quality production-feeling site from a plain-language brief | Chat → generate → inspect → edit/publish |
| Small creative team | Shared cloud projects and predictable costs | Cloud workspace → collaborate asynchronously → deploy |
| Open-source power user | Self-controlled files and models, no cloud account | Install → open folder → configure BYOK/MCP |

## 4. Product principles

1. **Local-first means operationally offline:** local editing, reopening, preview, undo/redo and export must work with network disconnected, using installed project dependencies. No login wall.
2. **Real code is canonical:** JSX/TSX, CSS, images and project files remain the authoritative representation of a website. The canvas and AI must not maintain an independent, lossy design document.
3. **Visual quality is measured:** typography, composition, responsive layout, semantics, assets and rendering must be reviewed rather than assumed from a model response.
4. **Local and cloud are execution modes, not two editors:** same project format, editor commands, source mapping, and export outcomes.
5. **Cost transparency:** cloud operations have estimates, hard credit caps, ledger entries and clear errors. No hidden unlimited inference promises.
6. **Safe boundaries:** generated code executes in isolation in cloud; scoped filesystem access locally; no secret exposure to preview processes.
7. **Original identity:** Paper-inspired restraint, not a copy; distinctive original illustrated agent characters.

## 5. V1 scope and feature requirements

`P0` = launch-blocking; `P1` = desirable beta; `P2` = post-V1.

| ID | Priority | Requirement | Acceptance condition |
|---|---|---|---|
| P-001 | P0 | Local desktop workspace | Create/open named project folders without sign-in; survives app restart and offline session |
| P-002 | P0 | Real code editor canvas | Render supported Next.js/Tailwind app, select DOM elements and map selection back to source reliably |
| P-003 | P0 | Core visual tools | Select, edit text, change spacing/color/type/layout, add basic sections, inspect layers; consistent undo/redo |
| P-004 | P0 | Save and export | File edits persist atomically and yield runnable project; export as folder/ZIP without cloud |
| P-005 | P0 | Cloud account/project workspace | Clerk login; owned project list; authorized upload/download; hosted project storage |
| P-006 | P0 | Cloud autonomous generation | Prompt → safe job → progress → preview → editable code/project in same editor |
| P-007 | P0 | Premium art-direction pipeline | Design brief, selected system, implementation, screenshot critique and bounded repair loop |
| P-008 | P0 | AI usage metering | Server-authoritative reservation, usage and credit ledger; concurrency protection; hard stop |
| P-009 | P0 | BYOK local AI | Provide supported API key or explicitly supported local agent integration; no subscription bypass |
| P-010 | P0 | MCP | Narrow permissioned tools for project inspection/editing, with server-enforced caps in cloud |
| P-011 | P0 | GitHub basic integration | Explicit connection, import repository and export/commit changes with scoped permissions |
| P-012 | P0 | Hosted preview | Temporary safe preview of generated site; no direct access to service credentials |
| P-013 | P1 | Cloud-to-local handoff | Download cloud project, edit offline, upload as new revision with conflict detection |
| P-014 | P1 | Responsive frames | Desktop/tablet/mobile viewports and project-level responsive inspection |
| P-015 | P1 | Reusable design systems | Store type/color/spacing systems, optional `DESIGN.md` and token files |
| P-016 | P1 | Version history | Recover project-level checkpoints; revisions represented by immutable snapshot IDs |
| P-017 | P1 | Illustrated agent UI | Recognizable Planner / Art Director / Builder / Reviewer personalities with useful state |
| P-018 | P2 | Multiplayer live collaboration | Deferred; do not implement CRDT or concurrent multi-writer editing in V1 |
| P-019 | P2 | Full vector graphics / arbitrary non-web canvases | Deferred; Penpot extraction not required for V1 |
| P-020 | P2 | Custom domain publishing / advanced CMS | Post-beta once previews and output quality are validated |

### 5.1 Local mode

- Desktop app (initially macOS-first; broader platform packaging after validated builds) uses local project folders as canonical source and a small local metadata index.
- Open, edit, preview, and export existing supported projects without contacting allstudio's servers.
- No local editing/AI credits charged. BYOK inference, when invoked, still sends data to the user-selected provider; clearly disclose this distinction.
- Local agent integration can invoke supported installed tooling **only with user-granted permissions**. ChatGPT/Claude subscriptions are **not** equivalent to provider APIs; supported official integrations must be individually verified.
- Use a native filesystem adapter and local dev server; browser-only IndexedDB is not sufficient for the desktop local-first claim.

### 5.2 Cloud mode

- Free cloud tier and paid tiers share an editor; paid capability is primarily autonomous agent run budget, storage, preview, and execution priority.
- Cloud generation launches a bounded job, stores checkpoints, streams meaningful statuses, renders screenshots, and delivers editable React/Tailwind source.
- Cloud preview and code-run workers are isolated from the main API, users, and production databases.
- Users can stop jobs; cancellation terminates active execution and releases unused reservations after actual usage reconciliation.

### 5.3 Design-quality engine

Pipeline: `brief normalization → reference/style direction → design spec/tokens → code generation → browser render → visual/technical critique → bounded repairs → project handoff`.

V1 quality checks: usable responsive layout at 390px and 1440px widths; no horizontal overflow in supported page fixtures; no blocking build/runtime errors; coherent typography and spacing tokens; visible primary call to action; semantic heading structure; keyboard reachable primary navigation; reasonable image treatment and alt text. Track screenshot-based evaluations and human ratings; avoid unverifiable promises such as “never generates AI slop.”

Use original assets, licensed templates, or properly permitted references. Do **not** treat popular public websites as an automatically licensed training corpus. Initial premium offering uses orchestration and curated systems, **not** a newly trained foundation model.

### 5.4 MCP scope and limits

V1 tools: `projects.list`, `projects.get`, `files.read`, `design.inspect`, `design.apply_patch`, `preview.render`, `history.create_checkpoint`, `export.create`. Exclude arbitrary shell commands, cross-project filesystem paths, unrestricted network access, and silent destructive operations.

Cloud policy must enforce tenant/project scoping, requests per window, maximum patch size, tool calls per agent run, preview concurrency, budget per run, and per-user/workspace credit balances. Set exact numeric quotas **after** load and economics testing; local self-host operators may configure their own limits.

### 5.5 GitHub integration

Explicit GitHub OAuth/App authorization; least-privilege repository access; import pinned revision into workspace; compute diff; allow user-confirmed commit or export. No unattended writes to a repository by default.

## 6. UX and navigation

**First visit:** “Create with AI” (cloud path), “Open local project” (desktop path), “Explore workspace”. Avoid a task-manager-like experience. Central canvas is visually quiet; project/file/layer navigator left; contextual inspector right; agent composer collapsible, with illustrated characters indicating agent stage.

**Local workflow:** Open folder → detect compatible Next.js/Tailwind project → launch local preview → select/modify rendered element → write code → save → export/commit. 

**Cloud workflow:** Sign in → create workspace/project → enter brief → choose art direction or accept sensible default → see spend estimate and start → stage-by-stage streaming and preview → accept design → open editable canvas → refine → download/publish later.

**Switch modes:** local-to-cloud requires deliberate upload (never automatic silently); cloud-to-local requires explicit download. Use base revision + content hashes; on concurrent divergence, present fork/resolve choices rather than overwriting either side.

## 7. Plans and credit model (product proposal, NOT approved unit economics)

| Plan | Indicative price | AI allowance | Intended use |
|---|---:|---|---|
| Local / self-hosted | $0 | User-supplied provider bills / locally available tooling | Unlimited manual projects, editing, exports |
| Cloud Free | $0 | Suggested 500 **one-time** trial credits | Try premium generation in hosted workspace |
| Cloud Unlimited (name subject to change) | $7/mo | Suggested 1,000 credits/mo | Regular assisted website creation |
| Cloud Pro | $25/mo | Suggested 3,000 credits/mo | Heavy usage, larger jobs and priority |
| Enterprise | Custom | Contract/volume limits | Later, not V1 launch blocker |

“Unlimited” must never describe AI credits. Price and included credits are **draft targets**, not promises. Before launch: benchmark OpenRouter token rates, visual rendering, sandbox compute, assets/storage, transaction fees, failed/retried runs, and p95 cost per generated website. Define credit value from actual costs and reserve worst-case credits for each bounded run.

## 8. Reliability, security, performance and accessibility

| Category | V1 target / guardrail |
|---|---|
| Offline reliability | Complete local smoke-test with network disabled after dependencies are installed |
| Source round trip | Source compiles after edits; AST mapping tests for nested components, formatting and Tailwind utilities |
| Cloud auth | Clerk token verified by API; independent project/member authorization on every project-scoped operation |
| Isolation | One user-generated run cannot see another's files or credentials; sandbox cleanup on timeout |
| Billing | No negative spendable balance; webhook/event idempotency; reservation/settlement transactions |
| Secrets | Server-side only; encrypt stored user keys; never inject provider or cloud secrets into previews |
| Observability | Request IDs, project/run IDs, structured logs, error tracing; exclude raw project contents by default |
| Accessibility | Keyboard access to primary workspace interactions; color contrast and focus states |
| Latency (targets to benchmark) | Responsive editor interaction; stream first status promptly; benchmark p95 across core flows |
| Data integrity | Immutable revisions and hashed artifacts; backup/restore test before public cloud beta |

## 9. Success metrics

- **Activation:** percent of new users who create/import a project and perform a successful edit.
- **Editor integrity:** percent of visual operations yielding compiling, expected code; rollback incidence.
- **Quality:** blind human design rating vs a generic single-prompt baseline; rendered defect count per project.
- **Conversion:** first cloud generation accepted and opened in editor; free-to-paid rate.
- **Economics:** actual compute/inference cost per successful generation, gross margin per plan, reserved vs settled credits.
- **Local-first trust:** offline-mode test pass rate; unauthorized network calls in offline tests = 0.

Initial thresholds are TBD until representative baselines are collected. Report denominators and sample sizes; never optimize only for “AI prompts issued.”

## 10. Explicit V1 exclusions

Real-time shared-cursor collaboration; a Penpot-comparable vector/illustration suite; cross-framework support beyond validated React/Next.js/Tailwind fixtures; general media generation; autonomous production deployments; training an original foundation model; unrestricted access to paid Claude/ChatGPT subscriptions; enterprise SCIM/SSO; complex CMS/A-B testing.

## 11. Risks and decisions requiring validation

1. **Onlook extraction risk:** editor engine imports app-specific state and sandbox managers; validate with a narrow proof of concept first.
2. **Offline runtime:** Onlook's current `NodeFsProvider` contains placeholder implementations; implement/retest real local files and commands.
3. **Desktop packaging:** Electron is recommended for reuse; validate Clerk Electron sign-in and macOS signing/notarization before locking packaging.
4. **Credit sustainability:** $7/$25 targets may not support high-cost agents without hard caps; benchmark prior to selling plans.
5. **Design quality:** aesthetic ratings are subjective; pair visual benchmarks with reproducible quality checks.
6. **Licensing:** Onlook is Apache-2.0; document derivative changes and retain legal notices. allstudio's original-code license and premium-source strategy remain product/legal decisions.
7. **Scope creep:** treat arbitrary vector design, collaboration, and multi-framework support as deferred unless V1 proof is already stable.

## 12. Delivery gates

- **Gate A — Source spike:** Onlook baseline builds; selected DOM maps to JSX; change to Tailwind class writes through; no project corruption.
- **Gate B — True local:** New/open local folder, create/read/write/rename/watch, dev server, offline restart and export all pass.
- **Gate C — Cloud vertical slice:** Clerk sign-in → authorized project → sandbox → OpenRouter generation → streamed progress → editable preview → saved revision.
- **Gate D — Quality/billing:** Screenshot critiques, hard run budget, transactional ledger, idempotent Stripe webhooks, cancellation, isolation tests.
- **Gate E — Beta:** Recovery drill, basic accessibility pass, GitHub import/export, onboarding and end-to-end CI green.

**Go/no-go rule:** do not publicly market allstudio as a reliable offline-first editor before Gate B, or sell credits before Gate D.

## 13. References

- Onlook repository and architecture overview: https://github.com/onlook-dev/onlook
- Onlook license: https://github.com/onlook-dev/onlook/blob/main/LICENSE.md
- OpenDesign repository: https://github.com/nexu-io/open-design
- Railway PostgreSQL: https://docs.railway.com/databases/postgresql
- Clerk session verification: https://clerk.com/docs/guides/sessions/manual-jwt-verification
- Railway storage buckets: https://docs.railway.com/storage-buckets

