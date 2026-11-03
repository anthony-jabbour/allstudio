# PR #27 Chat surface in Electron

## Goal

Expose the PR #27 chat workspace in the Electron desktop app using the same `apps/studio` React implementation as the web build. Keep the experience local-first and preserve the existing Phase 3 website editor and Phase 4 board editor.

## Approaches

1. **Reuse PR #27's shared route and components — selected.** Merge the existing `ChatPage`, `ChatStore`, `LocalStudioAgent`, and `#/chat` route into the shared Studio app that Electron already hosts. This keeps web and desktop on one UI and one board model.
2. **Build a separate Electron chat screen.** Rejected because it duplicates the UI and would diverge from the web source the founder asked us to reuse.
3. **Leave chat inaccessible on desktop.** Rejected because it does not satisfy the active goal's PR #25–27 shared-UI requirement.

## Boundaries

- Preserve PR #27 behavior: local deterministic board generation, local conversation storage, the current free gate, and the locally labeled Pro preview.
- Do not add model/provider calls, cloud behavior, billing, filesystem access, or Electron IPC for chat. Chat stays in renderer `localStorage`; board documents use the existing `FileStore` and schema validation.
- Restrict new Chat storage growth to a 1,000,000-byte budget and retain PR #27's 200-conversation / 400-message limits as visible rejection thresholds. Preserve existing over-budget legacy history, permit shrink/delete operations, and never silently delete or truncate conversation history. Do not replace readable `localStorage` with memory storage just because a write fails.
- If a new board document is written but its index update fails, remove that newly written document and preserve the prior index.
- If an existing scratchpad document is unindexed, restore its index without rewriting its contents; preserve invalid collisions, show a marked recovery row, and surface a clear error when opened instead of crashing the Home view.
- Treat a corrupt or partially invalid board index as unavailable, never as an empty list to overwrite; show a recovery row with an ID outside the board-ID grammar, and block board mutations while preserving both the index bytes and all stored documents.
- New conversations persist their first user message as one storage write, so a quota failure cannot leave an empty chat behind.
- Clear the composer draft only after the first user-message write succeeds; a failed write leaves the prompt available to retry.
- Keep Electron's shared Studio app and website editor as separate surfaces. Hidden surfaces must not capture active keyboard input.
- Keep DiceBear/Open Peeps usage and attribution as declared by PR #27. `dicebear/dicebear` was observed at 10,004 GitHub stars on 2026-11-03, MIT, with the PR pinning 9.4.2; the PR `NOTICE` records Open Peeps artwork as CC0 1.0.

## Acceptance

- Electron can reach `#/chat` through the shared Studio navigation.
- A local prompt creates a schema-valid board, shows the real board preview, and opens that document in Studio.
- Chat history and generated board persist through renderer reload and app restart.
- A blocked chat write is surfaced to the user; an index-write failure leaves neither an orphan board document nor a changed board list.
- Browser and packaged Electron workflows produce no model/provider or external-network request.
- No new native capability is exposed to the renderer or preview.
- The desktop workflow is run only in GitHub Xvfb; no local Electron window is opened.

## Implementation

Add an Electron behavior test first, then merge the PR #27 shared implementation, reconcile it with the PR #26 board/editor props, and run browser/unit plus GitHub development and packaged desktop checks. Document any necessary host-specific adaptation separately from shared chat behavior.
