# allstudio — Claude Code Operating Instructions

> **Repository:** public Apache-2.0 editor. Start here: `HANDOFF_FOR_CLAUDE.md`.  
> **Status:** Review draft v0.2 · 2026-10-24  
> **Applies to:** Claude Code in this public repository and, with private scoped addenda, the separate private `cloud` repository.  
> **Authority:** Read and obey `AGENTS.md` first. This file specializes the workflow; it does not replace founder decisions, security controls or roadmap gates.

## At the start of EVERY task

1. Read `AGENTS.md` and the active part of `RoadMap.md`. Read only relevant architecture/Onlook files; identify stale or contradictory requirements and **ask rather than silently choosing**.
2. Inspect real source code, tests, fixtures and scripts before proposing implementation. Do not assume planned packages, REA integrations or a working Onlook local runtime exist.
3. Define **one user-observable outcome** and a concrete test that would prove it in the actual app.
4. **Run the reuse-first gate:** search existing Onlook code, repository dependencies, official docs, and credible OSS solutions **before** designing a new subsystem. For any new open-source tool proposed for adoption, verify **at least 1,000 GitHub stars** on its canonical repository and record the count/date/license. Anything below the threshold requires founder approval before adoption.
5. For behaviors inspired by **Paper, Framer, Penpot, Figma**, assess whether an authorized **REA** investigation would resolve implementation questions. Public open-source code is a first-class source; for closed products, rely on authorized observable behavior, not assumptions about private internals.
6. List unresolved product decisions. **Ask the founder before making any material choice**. You may do read-only research while awaiting a decision, but do not implement the blocked choice.
7. Declare the smallest independently reviewable files/modules to change and the validation steps to run.
8. If Notion is available, fetch allstudio HQ → Start Here / Agent Map and the matching Feature/ADR/Board row (`docs/notion/NOTION_MAP.md`). If Notion is not available, continue from this repository; do not block the task.

## Founder-first decision protocol (mandatory)

When something is not clearly specified, do not fill in gaps with a plausible assumption. Ask for the desired behavior and show options, implications, and your preferred choice. Use:

```text
I need your decision on [feature/behavior].
A: [behavior and trade-offs]
B: [behavior and trade-offs]
I recommend [A/B] because [specific reasoning].
Which should allstudio use?
```

If this is an unattended session, create a visible **BLOCKED — FOUNDER DECISION** report. Do not approve the choice yourself, edit the spec to legitimize your guess, or continue dependent implementation. Continue only independent approved work. Technical unknowns that can be verified from docs/source/tests should be investigated first; if still unresolved, escalate.

## Reuse-first / build-vs-buy decision procedure

For each substantive new feature:

```text
1. Inspect existing allstudio and Onlook code.
2. Search official docs and comparable OSS implementations.
3. Verify candidate repo link, current stars (>= 1,000), license, last maintenance,
   security posture, compatibility, and real feature coverage.
4. Run a minimal isolated proof-of-concept when reasonable.
5. Compare reuse/adaptation with custom implementation.
6. Explain trade-offs and ask founder to approve a material selection.
7. Implement only the approved smallest slice; add regression tests.
```

**Do not adopt an OSS library solely because it has 1,000+ stars.** Do not quietly replace an approved dependency or add another editor/agent framework. If no qualifying option works, explicitly say "No suitable qualifying OSS solution found" and ask for a deliberate custom-build decision; do not improvise one.

## REA workflow for competitor-inspired features

Official project: **https://github.com/morluto/rea** (Reverse Engineer Anything; MIT). Its own docs describe MCP integrations for Claude Code, Cursor, and Codex, as well as analysis of websites and permitted application artifacts. Check tool readiness instead of assuming it is already installed.

**Use REA when its availability, authorization and capabilities match the feature question** (e.g., how a user's drag-resize handles behave across breakpoints):

1. Specify exact reference behavior; ask the founder if interpretation is ambiguous.
2. Consult available public sources and qualifying OSS implementations first.
3. Confirm the target and method are permitted; for proprietary products use public docs/demos and authorized observation. Do not evade paywalls, technical protection measures, access controls, or license restrictions.
4. If installed, use REA's appropriate documented MCP/CLI analysis only within approved scope. If not installed, **propose** installation/configuration rather than silently changing machine or agent settings. Official setup is `npx rea-agents setup` (verify the official release/version and review changes before running); no automatic installs just to finish a task.
5. Produce a short evidence note: what was **OBSERVED**, what is **INFERRED**, what remains **UNKNOWN**, and what could not lawfully or technically be inspected.
6. Recommend an original implementation or lawfully licensed OSS adaptation. Do not transplant proprietary decompiled code, protected artwork or branding.
7. Validate the resulting allstudio interaction with actual app tasks and screenshots/diffs; include failures and limits.

If REA cannot answer the question, say so; do not assert you discovered the target's internal architecture from visuals. Ask for founder direction if the uncertainty affects behavior or technical choices.

## Execution loop — no phase-wide blind builds

```text
Read → Research OSS → REA if authorized/useful → Founder decision as needed
→ Smallest end-to-end test/reproduction → Implement → Targeted checks
→ Real editor/desktop/cloud demonstration → Regression + negative checks
→ Independent review → Report evidence → Founder gate approval
```

Use separate branches/worktrees when parallelizing Claude Code, Cursor, and Codex. Assign non-overlapping file ownership and one integration owner. A second model review is helpful but not a substitute for executed behavioral tests or founder sign-off.

Default to at most one diagnosis-driven automatic full-CI repair rerun; recurring failures must be reported with logs and hypotheses.

## What counts as real validation

- **Source editor:** select a real rendered element; identify the intended JSX/TSX; apply and inspect source diff; refresh UI; undo/redo safely.
- **Electron:** verify real local files survive save/restart offline; preview cannot access privileged IPC; unknown scripts require explicit permission.
- **Paper-style boards:** actual frame/text/image edits survive reload to portable board documents; conversion limitations are explicit.
- **Cloud:** authenticated project authorization, same pinned public editor, actual local → cloud → local archive round trip.
- **Premium agent:** bounded isolated model/tool runs generate executable, editable projects; rendering and quality are evaluated against evidence, not only model self-scores.
- **Credits and MCP:** enforce quotas and idempotent accounting on the server; test failure/cancellation and unauthorized actions.

Do not claim phase completion from TypeScript success, a unit-test mock, a screenshot without persisted code, a self-review, or results you did not execute.

## Locked project/repository constraints

- Public `allstudio/allstudio` is Apache-2.0. Private `allstudio/cloud` contains Railway + Clerk + PostgreSQL/Drizzle + managed OpenRouter premium generation and billing. Public source must never import or publish private code/secrets.
- Electron main/preload/renderer are separate; untrusted previews receive no privileged bridge.
- Code-backed websites have canonical JSX/TSX/CSS; exploratory boards have portable JSON. Do not imply universal reversible conversion.
- Fork and validate Onlook before extracting coherent editor slices, tracking upstream paths, commit and license obligations.
- Local editor runs without network/login; cloud project transfer is P0; full multiplayer sync is not V1.
- Use only officially authorized provider API/subscription integration paths; do not bypass accounts or model-provider access rules.
- Do not run paid external calls, deploy, change licenses, add substantial third-party dependencies, or perform destructive operations without authorization.

## Every delivery must include

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

Only the founder or authorized maintainer can mark a phase gate `PASS`. Keep this root document focused; use narrowly scoped `CLAUDE.md` files next to implemented modules for additional detail, never for contradictory rules.
