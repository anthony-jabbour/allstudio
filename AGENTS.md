# allstudio — Agent Engineering Policy

> **Repository:** public Apache-2.0 editor (`allstudio/`). Private cloud instructions belong in the separate `cloud/` repository.  
> **Status:** Review draft v0.2 · 2026-10-24  
> **Scope:** Claude Code, Cursor, Codex, other coding agents, and human contributors in the public editor and private cloud repositories.  
> **Owner:** The founder retains final authority over product behavior and direction.  
> **Companion:** `CLAUDE.md` (Claude-specific execution), `RoadMap.md` (phase gates).

## 1. Mission: research first, build small, prove it works

Build allstudio as an **open-core, local-first, web-native design studio** with a professional Paper-inspired canvas and live editing of real supported React/Next.js codebases using selectively reused Onlook technology. The public editor must be useful without allstudio's cloud. The commercial cloud runs on Railway with Clerk, PostgreSQL/Drizzle and an OpenRouter-backed premium generation engine.

**Operating principle: Founder-directed decisions → research existing solutions → implement the smallest working slice → execute real tests → independent review → founder-approved phase gate.**

Do not equate generated code, clean lint output, a high review score, or an agent's statement of completion with a functioning feature.

## 2. Product ownership: ask, do not invent

**The founder owns the product. Agents implement and advise; they do not invent product requirements or settle material trade-offs on the founder's behalf.**

**STOP and ASK** when a decision is not explicitly settled by the request, approved specifications, or demonstrated existing behavior and affects any of the following:

- UX, product functionality, interactions, user-visible defaults, design language, or feature scope;
- architecture, source-of-truth, project portability, local/cloud boundaries, or major dependencies;
- build-vs-reuse decisions, licenses, redistribution, or use of another company's implementation;
- privacy, permissions, security, model/provider integrations, costs, credits, or data retention;
- changing previously agreed requirements, removing features, or defining ambiguous acceptance criteria.

When unclear, **do not silently infer what the founder would prefer**. Ask a precise decision question with a recommended option and its trade-offs. The founder can override the recommendation. Record the answer in the relevant task/decision record; do not treat prior guesses as approvals.

For **technical uncertainty that has a factual answer** (e.g., which API exists, how a source mapper behaves), investigate source, documentation, reproducible tests, and authorized tools **before asking**. If the outcome is still unclear or a product choice remains, ask. Do not flood the founder with trivial implementation questions already resolved by specifications or tests.

When no interactive reply is available, mark the affected work `BLOCKED — FOUNDER DECISION`, describe the options, and stop changes that depend on the answer. Unrelated, already-approved tasks may continue. Never manufacture permission through silence.

**Question format:**

```text
Decision needed: [one concrete product/engineering choice]
Why it matters: [impact on behavior, cost, security, or roadmap]
What is known: [evidence and relevant existing decision]
Options: A [trade-off] / B [trade-off]
My recommendation: [option and reason]
Blocked work: [exact task or files waiting for the answer]
```

## 3. Reuse-first research: mandatory before building a substantive feature

**Before implementing a nontrivial feature or selecting a new third-party open-source tool, search for an existing open-source implementation. Never build a complex substitute blindly.** Search GitHub, official docs, existing dependencies, Onlook's source, and credible related repositories.

### 3.1 Hard eligibility rule for newly selected open-source tools

A **new external open-source project proposed for adoption must have at least 1,000 GitHub stars at the time it is evaluated.** Verify the count from the canonical GitHub repository, and record the repository URL, observation date, version/commit and license. **Do not assume a claimed count is current or invent one.**

- Under 1,000 stars, missing GitHub evidence, or no GitHub repository: **do not select or install it without explicit founder approval of an exception**.
- The rule applies to **new open-source tool/library/framework selections**. It does not require 1,000 stars for allstudio's own original modules, standard-library functionality, project code already approved, or upstream dependencies already present in the pinned Onlook baseline. Any newly proposed substitution still requires review.
- **Stars are an entry threshold, not a security or quality endorsement.** Examine maintenance, issue activity, supported environments, license obligations, performance, interoperability, accessibility, security history, transitive dependencies and actual feature fit.
- Prefer a cohesive existing implementation or adaptation over a new dependency if it reduces risk. Do not add software just because it is popular.
- If no eligible option actually solves the problem, document the gap, investigate comparable behavior using REA where appropriate and authorized, and **ask the founder before choosing a custom implementation**.

### 3.2 Required research record

Before a substantive build-or-adopt decision, attach a concise research note to the issue/PR (or `docs/research/<feature>.md` when warranted):

| Field | Evidence required |
|---|---|
| Feature | Desired behavior and relevant roadmap gate |
| Candidates | At least two credible options when available; otherwise say why fewer exist |
| GitHub eligibility | Canonical URL, verified star count and date for **each proposed adopted project** |
| Legal/operational | License, provenance, maintenance, known risks, compatibility and attack surface |
| Fit test | A minimal executed proof where practical; otherwise state not tested |
| Recommendation | Reuse / adapt / build original, with rationale |
| Founder approval | Approval or recorded blocker for material decisions and exceptions |

Do not copy a reference product's branding, illustrations, proprietary assets, or protected source.

## 4. REA (Reverse Engineer Anything): required research path for reference-product features

**Approved research tool to evaluate:** [morluto/rea](https://github.com/morluto/rea), known as **Reverse Engineer Anything (REA)**. Official documentation describes MCP integration with Claude Code, Cursor and Codex, and local analysis of permitted website behavior, JavaScript/Electron artifacts and other authorized software.

**When a task asks for a feature comparable to Paper, Framer, Penpot, Figma, or another reference product, use this sequence BEFORE building a new implementation:**

1. **Define the behavior.** Identify the exact interaction and user outcome, not a vague instruction such as "make it like Figma." Ask the founder where behavior or fidelity requirements are ambiguous.
2. **Search open source first.** Inspect the pinned Onlook baseline and suitable public sources (e.g., Penpot's publicly licensed components). Apply the 1,000-star new-selection rule and evaluate actual fit and licenses.
3. **Check authorization and REA availability.** Use REA only for targets, accounts, software and data that can lawfully be examined under applicable rights and terms. For commercial applications, start with official documentation, public demos, allowed browser observation and the founder's authorized use. Do not bypass paywalls, DRM, authentication, rate controls, permissions or technical protections.
4. **Collect bounded evidence with REA when available and permitted.** Observe the target interaction, including UI states, DOM/accessibility structure, permitted network/render behavior or other authorized artifacts. Prefer passive observation before invasive analysis. Only install/configure REA or other tooling after the founder approves relevant changes and any required permissions.
5. **Label knowledge correctly.** Separate `OBSERVED`, `INFERRED`, and `UNKNOWN`. A screenshot, minified web bundle, or network trace does **not** prove the competitor's private backend architecture. REA reports can be incomplete or wrong.
6. **Compare implementation paths.** Show the founder an eligible OSS adaptation and/or an original clean implementation informed by behavior, with costs and constraints. Ask the founder to choose if a material trade-off remains.
7. **Implement original or lawfully licensed code.** Do not paste proprietary decompiled code, reproduce protected assets, or use REA to evade another product's restrictions. Preserve attribution for any licensed OSS code incorporated.
8. **Validate with reproducible tasks.** Compare the allstudio behavior with the stated interaction contract; test persistence, usability, undo/redo, responsiveness, accessibility and regressions relevant to the feature.

**If REA is absent, incompatible, unauthorized or inconclusive:** Say so. Use public docs, permitted observations, open-source code and tests; record limitations. Ask the founder before committing to an architecture/behavior choice that depended on unknown internals. **Do not claim to have used REA when you have not.**

Suggested feature research report:

```text
Feature: [e.g., multi-select resize handles]
Reference: [Paper / Framer / Figma / Penpot; observed version/date]
Founder-approved target behavior: [...]
Open-source candidates: [link, stars+date, license, fit, decision]
REA scope and authorization: [what could be observed; whether tool actually ran]
Evidence: OBSERVED [...]; INFERRED [...]; UNKNOWN [...]
Proposed allstudio behavior: [...]
Decision requested: [only if needed]
Validation: [specific running-app steps and expected results]
```

Reference: REA's own [README](https://github.com/morluto/rea#readme) and [responsible-use disclaimer](https://github.com/morluto/rea/blob/main/DISCLAIMER.md). REA is an analysis aid, **not** evidence that copying a competitor's implementation is permitted.

## 5. Authoritative context and architecture

Read before coding: `RoadMap.md` → applicable v0.2 `CODEBASE_ARCHITECTURE.md` and `REPOSITORY_ARCHITECTURE.md` → relevant `PRD.md`, `ARCHITECTURE.md`, `ONLOOK_INTEGRATION.md`, `Techstack.md` → actual source, fixtures and scripts. Flag contradictions instead of silently resolving them. Where files are absent, disclose the gap.

- **Public `allstudio/allstudio`:** Apache-2.0 Electron editor, creative board, Onlook-derived code-aware editing, portable local project format, local BYOK/MCP and public API protocol. Local operation requires no cloud account.
- **Private `allstudio/cloud`:** Railway-hosted Next.js application, Clerk authentication, PostgreSQL/Drizzle, managed assets, Stripe/credits, premium OpenRouter agent and isolated execution. Public source never imports proprietary private code; private cloud consumes pinned public package releases.
- **Artifacts:** Source files are canonical for supported site editing; portable board documents are canonical for exploratory boards. No promised lossless arbitrary board-to-code transformation.
- **Untrusted boundaries:** Imported websites are untrusted in Electron; generated projects are untrusted in cloud sandboxes. No secret access, native IPC bridges, or unrestricted command tools for previews.
- **Integrations:** Consumer Claude/ChatGPT subscriptions are not general third-party APIs. Use authorized provider APIs/approved integrations only.

## 6. Small vertical slices and real validation

Before implementation, record:

```text
Phase and specific acceptance criterion:
User-visible behavior:
Founder decisions still needed (if any):
Reuse research / verified star count / REA evidence (or reason not applicable):
Modules allowed to change:
Exact reproducer and fixtures:
Tests (positive, negative, regression, security):
Dependencies and blockers:
```

Implementation loop: **research → founder decision where needed → isolated branch/worktree → failing behavioral test/reproducer → minimal change → targeted checks → real integration/UI proof → independent review → founder gate approval**.

- Validate **real side effects**: JSX/CSS diffs, editor rendering, persisted disk files after restart, DB rows/revisions, exported artifacts, sandbox isolation and actual model/cost receipts as applicable.
- Run available formatting, lint, typecheck and targeted unit tests before integration/E2E. Never invent package scripts or fake test results.
- An unrun test is `NOT RUN`, not `PASS`. CI passing with no functional demonstration does not clear a gate.
- Default to one diagnosis-driven automated CI repair iteration after a failed full run. Persistent failures require reporting and review, not infinite blind retries.
- Agents may recommend `READY FOR HUMAN VALIDATION`; **only the founder or authorized maintainer can mark a phase gate PASS**.
- Previously validated functionality is protected by smoke tests; regressions reopen the gate. Ship small validated changes, not unchecked batches.

## 7. Approval, integrity, and security rules

Do not, without explicit authorization: change product requirements, introduce architecture-affecting dependencies, approve OSS threshold exceptions, install invasive reverse-engineering tools, inspect unauthorized software/accounts, perform paid API runs, deploy to production, modify customer data, run destructive Git operations, delete substantial files, or change licenses.

Use scoped filesystem grants, secure credential storage, validated IPC, tenant/project authorization, private sandbox isolation, idempotent billing events, bounded agent budgets and minimal telemetry. Redact secrets and private content from research artifacts, logs, PRs and public screenshots.

## 8. Required task handoff

```text
Feature / roadmap gate:
Founder choices / approvals:
Open-source research (GitHub stars, date, license, fit):
REA investigation (performed / unavailable / not applicable; evidence limits):
Changed and actual behavior:
Tests executed (exact commands and observed results):
UI / file / browser / database proof:
Negative, security and regression checks:
Unknowns and blocked decisions:
Recommendation: READY FOR REVIEW | BLOCKED | INCOMPLETE
```

**No evidence = not done. No founder decision = no invented product decision. No eligible reusable solution = research, ask, then build deliberately.**
