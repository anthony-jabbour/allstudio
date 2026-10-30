# Phase 3.6 — bounded structural rearrange (sibling reorder)

Status: PROPOSED DESIGN — `BLOCKED — FOUNDER DECISION`. No production code changed.
Date: 2026-10-30. Base: `feat/phase-03-routes`.

## Scope boundary

Sibling reorder only: move one supported static element/component instance before or after an adjacent sibling inside the same JSX parent. **Not approved:** insert, remove, wrap, cross-parent move, reorder of dynamic/mapped children, fragments with expressions, reused component instances. Layer tree stays an observation of the rendered DOM; the source transform is the authority.

## Research (parent-performed)

- **OBSERVED:** [source-mapper](../../../packages/editor/src/source-mapper) already resolves a preview `data-oid` to a unique JSX element with ambiguity/dynamic/repeated-instance refusal (used by every edit). The edit pipeline is hash-checked, atomic, journaled with undo/redo and HMR confirmation.
- **Onlook pin (27,042 stars, Apache-2.0):** has move-by-index code operations tied to its MobX code editor; not extractable (same rationale as 3.4/3.5). Penpot/FigCraft are canvas-engine based, not JSX-transform sources.
- **No new dependency proposed.** Transform uses the TypeScript/Babel AST already used by the source mapper (to be confirmed by the implementing agent — if a new parser were needed it would require a founder exception).
- **REA:** not used.

## Proposed safe transform

1. Eligibility: both siblings are JSXElements with unique `data-oid` mappings, in the same `children` array, separated only by whitespace-only JSXText (no expression containers, comments, or text between them that would change meaning).
2. Operation: swap the two element source ranges plus preserve the original inter-element whitespace; output must reparse with identical element count and sibling set. Any mismatch → refuse, source untouched.
3. UI: layer-tree "Move up / Move down" buttons (keyboard-accessible) for eligible rows; no drag-and-drop in the first slice.
4. Confirmation: after HMR, the rendered order of the two DOM nodes changed (bounding-rect order along parent flow axis) — otherwise saved-but-unconfirmed.
5. Undo/redo/reopen through the existing journal; e2e proves persisted file diff on Harbor and reopen.

## RED tests

- Swap two static sibling `<p>`/section blocks: exact byte diff, reparse count equal.
- Refuse: mapped `{items.map}` children, conditional `&&` sibling, comment node between, first-item move up, cross-parent.
- Undo restores original bytes; offline packaged reopen shows the new order.

## Founder decisions needed

```text
Decision needed: Approve sibling reorder (Move up/down buttons, same-parent, static siblings only) as the entire 3.6 slice?
Why it matters: Any structural JSX rewrite risks source loss; the roadmap requires "rearrange a supported component" but the approved boundary excludes insert/remove/wrap.
What is known: The source mapper and hash/journal pipeline already exist; safe swap is provable by reparse equivalence; drag-and-drop adds hit-testing and indicator complexity without adding safety.
Options:
  A. Buttons only (Move up / Move down in Layers), adjacent static siblings, reparse-verified swap.
  B. Buttons plus drag-and-drop reorder in the layer tree (same transform underneath).
My recommendation: A first; B as a later UI-only increment on the same transform.
Blocked work: implementation of 3.6 (site/reorder.ts, layer-tree actions, requests, e2e).
Secondary: whether reuse of a component instance (e.g. same card used in two places) must always be refused (recommended: yes).
```
