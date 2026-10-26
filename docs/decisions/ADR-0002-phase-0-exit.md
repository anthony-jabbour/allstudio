# ADR-0002 — Phase 0 exit via parser spike

- Status: **Accepted**
- Date: 2026-10-24
- Phase: Roadmap Phase 0 → Phase 1
- Founder: option A

## Decision

Phase 0 exits on the documented Onlook visual-editor blocker plus the isolated parser/source-edit spike in `docs/validation/PHASE-00.md`. Phase 1 may extract the smallest source mapper into `@allstudio/editor` without first running unmodified Onlook against CodeSandbox.

The full iframe select → preview loop remains optional later. It is not a Phase 1 prerequisite.

## Why

- Unmodified Onlook hardcodes CodeSandbox and requires paid/external API keys to boot.
- `NodeFsProvider` is a no-op; a local fixture cannot be edited through the original app as-is.
- RoadMap.md Phase 0 exit already allows a documented upstream blocker plus a successful isolated source-edit spike.
- The spike on `examples/nextjs-site-fixture` already exercises OID injection, heading location, text edit, and Tailwind class merge.

## Phase 1 default (not a separate lock)

In-source `data-oid` attributes are written during editing, matching Onlook. Stripping them on production export is deferred. Revisit if export cleanliness becomes a gate.

## Consequences

- Founder marked Phase 0 **PASS** on 2026-10-25 via option A, reconfirmed in the local Phase 2 implementation chat. This records human approval, not new test execution.
- Claude Code may extract parser code into `@allstudio/editor` with provenance.
- The original hold on Electron is superseded by founder Phase 0 and Phase 1 PASS (2026-10-25) and authorization to start Phase 2. Explicit Phase 2 tooling and behavior approvals remain required. Do not copy the Onlook application tree.
