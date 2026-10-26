# Phase 2 — preview-only instrumentation spike

Date: 2026-10-25. Founder approved D7=B as a feasibility spike, not an undocumented Next.js integration or permission to mutate real-project configuration.

## Actual result

`preparePreviewSource` reuses the existing mapper's format-preserving instrumentation in memory. Newly inserted IDs become deterministic path-plus-element-order hashes; original user IDs remain unchanged. Removing only the newly inserted attributes must recover the original bytes exactly, or the spike refuses the source. Existing text/class mapper edits can be projected back without persisting preview attributes. No editor fork or new dependency was introduced.

`bun run test apps/desktop/tests/preview-source.test.ts`: three checks passed. The independent reviewer reran them and checked single-quoted IDs, fragments, spreads, custom components, escaped text and Unicode; no confirmed projection bug in this bounded scope. Multiline text remains refused by the existing mapper.

`NEXT_TELEMETRY_DISABLED=1 node scripts/spikes/preview-next.mjs`: actual Next.js 16.4.3 compilation produced seven stable rendered IDs across two requests. The loader ran on layout.tsx and page.tsx. Original source/config and copied source hashes stayed unchanged. The proof modifies only a fresh repository-owned disposable fixture copy's config, never a real user project. The copied source hash map must equal the current original map before startup and after rendering.

The first custom-server `conf` attempt did not invoke the loader, despite HTTP 200. Installed Next source showed that its public custom-server path does not forward this config. The successful proof explicitly adds the supported loader configuration to the disposable copy. That is not evidence of transparent integration with arbitrary Next.js projects.

## Harness review and repair

Independent review found fixed scratch reuse could retain deleted source or stale .next output. A stale source file was added to the old scratch tree, and the new copied-source assertion failed as expected. The harness now uses mkdtemp under ignored `apps/desktop/dist/spikes/` for every run. The corrected proof passed from a fresh directory. Each proof retains page.html in its own evidence directory. Packaging separately allowlists only out/main, out/preload and out/renderer.

The custom Next server retains process resources after close. The isolated proof logs this and exits its own process after a three-second deadline. It does not establish production preview lifecycle, cancellation or restart behavior.

## Remaining decision and limits

Production integration is BLOCKED — FOUNDER DECISION: approve an explicit reviewed, consented and backed-up Next.js config integration, or continue investigating a transparent approach. This question is pending in the implementation chat. No undocumented loader monkey-patch has been selected.

The source-mapping strategy is stable for unchanged element order, text edits and class edits; structural changes may reassign generated IDs. The eventual adapter must reject stale hashes and invalidate selections rather than assuming identity survives structural edits. Cross-file duplicate original IDs must be refused by workspace lookup. Compiler/config compatibility outside the demonstrated fixture, the actual DOM-selection-to-original-source write, IPC, file watching, recovery and packaged integration remain unproven.

Recommendation: feasibility proof is READY FOR REVIEW; production integration and Phase 2 remain INCOMPLETE.

Founder decision (2026-10-25): explicit, reviewable Next.js config integration with consent and backup APPROVED. Proceed with the connected local workflow. Earlier BLOCKED wording records the prior state and is superseded by this decision.
