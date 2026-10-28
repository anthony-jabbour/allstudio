# Phase 3.2 — rendered layers and selection design

Status: PROPOSED for founder review before implementation. Initial draft: 2026-10-27; updated 2026-10-28.
Base: `92ac26dcf08a5ea9c4e6fb8412ba78d732fb8df2` (draft PR #16, both quality/Electron CI checks successful).
Branch: `feat/phase-03-layers`, stacked on #16 in the same active checkout; no merge/worktree/clone.

## Outcome and existing guarantees

A user expands a real preview hierarchy and selects a heading, button or supported container. The canvas outline, active layer and existing source inspector identify the same rendered instance. Existing static text/class edits still persist via the same mapper, expected-hash/native journal/history and preview confirmation. The tree is a transient observation of the preview DOM, never a second site document.

The original request explicitly requires this behavior. No native API, file permission, dependency, model, cloud code or board model is introduced. Pages discovery/navigation is separate Slice 3.2b. Precise property controls/structural edits/assets remain later slices.

## Approaches and recommendation

1. **Recommended: extend the existing bridge with bounded DOM snapshots and instance-targeted selection.** Retains current isolation, source mapping and host neutrality. Original small React tree and browser collector, informed by inspected Onlook behavior; no copied engine/service runtime.
2. Extract Onlook layer manager/tree/UI wholesale: rejected for engine/frame/MobX/state/UI dependencies and its DOM-attribute mutation assumptions. More code and trust surface than this slice needs.
3. Build the navigator from source AST only: rejected for this outcome because conditionals, reused components and rendered lists cannot be assumed to have one DOM instance per JSX node. Source remains authority for edits, DOM remains evidence for rendered hierarchy.

## Reuse evidence

Onlook pin remains `423e2e924366419e418ee049093872d535eea41a` (27,020 stars observed 2026-10-27 in the existing upstream evidence snapshot; Apache-2.0). Source inspected for this slice: `apps/web/preload/script/api/dom.ts`, `packages/models/src/element/layers.ts`, earlier `apps/web/client/src/components/store/editor/{ast/layers,element/index}.ts` and tree UI inventory. Exact path correction: manager source is `ast/layers.ts` and `element/index.ts`, not directory wildcards as production modules.

Onlook uses a DOM TreeWalker, per-instance DOM identity, parent/child metadata and direct child text labels; it filters runtime portal/announcer nodes. It also assigns DOM attributes, reads computed styles, carries frame globals and publishes through its own event system. Reuse the identity/hierarchy concepts, not that transport/state or code. allstudio can use WeakMap identity without modifying DOM/source attributes. No extraction or license change is required for an original collector/tree over existing contracts. Penpot/FigCraft remain references per the Phase 3 audit. REA is not needed to infer a competitor runtime: this feature is specified and existing source/own-app observations are available.

Read-only live fixture inventory before implementation: Aurora 7 rendered/source IDs, maximum DOM depth 4; Lumen 28 rendered elements / 21 source IDs, depth 7; Harbor 19 rendered elements / 18 source IDs, depth 7. These observations validate repeated-OID coverage in existing fixtures and a large margin under the proposed transport limits; they do not benchmark large projects. No source edits occurred during this inventory.

## Exact behavior

- Show **instrumented, source-identified rendered elements**, nested under their nearest included DOM ancestor. Uninstrumented wrapper nodes are not fabricated into editable source targets; UI explains this supported subset. Skip runtime script/style/template/noscript content and framework portal/announcer subtrees.
- Labels use tag plus bounded direct text or aria-label/alt when available. Never render label text as HTML. Selected source context continues to come from trusted workspace locate; show its file/line/component in the inspector and selected row tooltip when resolved.
- Give each DOM Element a WeakMap-held node ID for this frame lifecycle. Keep this rendered ID distinct from source OID. Reused components/list items therefore have separate rows/rectangles even when their OID matches.
- Canvas and navigator use the same selection handler. A repeated source target can be inspected at its own rectangle but retains the existing **editing-one-instance unsupported** refusal. This slice does not authorize editing all instances or silently pick the first.
- Expand/collapse preserves source and drafts. Clicking a different layer follows current canvas-selection draft behavior (unapplied drafts are discarded on selection); no new autosave. Failed stale layer selection preserves the existing selection/drafts and reports that the tree changed.
- Keyboard tree navigation: one tab stop, Up/Down visible rows, Right expand/first child, Left collapse/parent, Home/End, Enter/Space select. Selection reveals ancestors but does not steal keyboard focus from the canvas/inspector. Disclosure clicks do not select or discard drafts.
- If a canvas selection is outside a truncated displayed tree, preserve its canvas/inspector state and show “Selected element is outside the displayed layer tree.” Do not highlight an ancestor or another instance, append a fabricated hierarchy row, or imply complete coverage. Full bidirectional synchronization acceptance applies within the declared displayed subset.
- A missing selected DOM target clears its rectangle and disables source editing. HMR can reconcile a unique source OID to the new rendered instance; repeated/ambiguous matches remain refused. Do not reuse a row index after HMR.

## Bounded transport and security

Extend the versioned existing origin/exact-frame/nonce-checked protocol. Increment the bridge version for the new snapshot identity contract and update every producer/consumer/test/harness together. Old/incompatible frames fail validation; no fallback to permissive messages.

Proposed payloads:

- `layers`: nonce, generation (safe positive integer), nodes in parent-before-child order, truncated flag.
- Node: `{ id, parentId: string | null, oid, tagName, label }`. IDs and OIDs have bounded validated alphabets; no filesystem path or command is accepted from the preview.
- Existing element snapshot gains a required rendered `nodeId`; existing source OID/count/geometry stay available. Tracking a saved OID resolves a unique target and never enables editing on repeated instances.
- `select-layer`: nonce, snapshot generation and rendered node ID. The preview checks exact current generation, connected target and current source identity before responding with the normal selection snapshot. Stale/missing targets return a fixed layer-selection error, not guessed source.

Initial engineering bounds (builder choices; test their exact boundaries): 1,000 transmitted nodes, 10,000 visited DOM elements, 64 levels of actual DOM depth, 80-character labels, 64-character identities, parent-before-child order with no duplicates/cycles, safe-integer generation. Collector stops at limits and reports truncation visibly; never silently pretends the tree is complete. Parser validates limits before rendering and constructs a clean typed payload. Parent ordering makes cycle validation linear. Element source-instance counts remain checked against actual DOM matches when selecting, independent of any truncated tree. Preserve the existing selected-element whole-document querySelectorAll count; it is explicitly outside the **new layer-collector traversal budget**. Never reuse a partial tree count as proof of source uniqueness or disable previously supported source editing just because the tree was truncated. This slice does not claim a hard runtime bound for that pre-existing native selector query; its existing count/payload limits remain enforced.

Collect only after a valid handshake. Coalesce mutation events, publish only changed hierarchy/labels and remeasure tracked geometry on the existing scroll/resize path. New layer-collection work/DOM traversal is bounded; do not collect layout/computed styles or source-instance querySelectorAll counts for every row. Track element IDs locally, not as persisted source markers. Source write IPC remains exactly unchanged.

## Scope and integration

Change only `packages/editor/src/{preview-bridge,shell}` and public exports if required, targeted protocol/tree/shell tests and browser/Electron harnesses; update validation/provenance research notes. Move navigator presentation inside the existing source-editor state boundary so it can share one selection state; keep host project controls and fixed viewport behavior unchanged. Both desktop and playground consume the same tree.

No drag handles, route enumeration, source AST mutation, broad command registry, generic RPC, native IPC or new dependency in this slice.

## Verification and acceptance

Write failing tests before implementation:

1. Parser accepts a bounded valid tree and rejects wrong origin/window/nonce/version, unknown fields/actions where applicable, oversized count/strings/depth, duplicate/cyclic/out-of-order parents, malformed IDs and invalid generation.
2. Real DOM collector handles nested instrumented nodes, skipped wrappers, repeated OIDs with distinct rendered IDs, truncation and mutation/HMR generation invalidation. No source/DOM marker writes.
3. Real browser/Electron: heading/button/container selected from both surfaces yields same source and rendered-instance rectangle; keyboard/expand/collapse; nested component and repeated list/component refusal; stale request cannot select or save the wrong element.
4. Apply an existing text/class edit after tree selection; verify minimal actual source diff, refreshed preview, saved-file hashes, undo/redo, external conflicts and packaged offline reopen. Earlier shell/theme/history/recovery/security scenarios remain green.
5. On a DOM exceeding the tree limits, a unique canvas target outside the displayed subset retains its own inspector/rectangle and explicit outside-tree message; another matching OID beyond the truncated scan still triggers the existing repeated-instance edit refusal through the complete selected-element count.
6. Hostile malformed/oversized tree and select-layer requests neither expose native bridge nor enable filesystem writes. Test truncation without freezing or claiming completeness.

Record commands, actual screenshots/traces/source diffs and limits in PHASE-03. Independent read-only review after implementation. Human observations and full Phase 3 approval remain pending; agents cannot mark PASS.

## Decisions and approval boundary

No new engine/dependency/source-of-truth or native permission is proposed. The only behavior choice made explicit here is the source-backed rendered-element subset and inspection-only treatment of repeated instances, preserving existing safety. Founder approval of this design allows the bounded Slice 3.2 implementation; it does not approve merge, phase completion, later structural editing or asset permissions.

## Independent design review

A fresh read-only builder reviewer identified two gaps: exact source uniqueness versus bounded tree traversal, and canvas selections omitted by truncation. Resolved above by explicitly retaining the existing whole-document selected-element count outside the new collector budget, and preserving outside-tree selection with a truthful visible state. No partial count can authorize an edit. Review did not execute runtime tests.
