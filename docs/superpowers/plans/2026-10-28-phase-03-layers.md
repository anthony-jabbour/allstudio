# Phase 3.2 Layers Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; no implementer delegation. Review the final diff independently.

**Goal:** Real bounded rendered layer hierarchy and instance-aware selection through the current source-backed editor.
**Architecture:** Extend the existing validated preview transport; original bounded DOM collector, WeakMap instance identity, and one shared React tree. No source transform/native API/dependency changes.
**Tech Stack:** Existing TypeScript, React19, Electron, Vitest, Playwright.
**Spec:** ../specs/2026-10-27-phase-03-layers-design.md (founder approved).

## Global Constraints

- Active checkout only; branch feat/phase-03-layers stacked on92ac26d. Do not merge #16 or create another worktree.
- Source OID differs from rendered node ID. Repeated OIDs stay inspection-only.
- New collector limits:1000 nodes/10000 visited elements/64 DOM levels/80 label characters/64 identity characters. Current selected-element whole-document count remains outside collector budget; never use partial counts to permit edits.
- Origin/frame/nonce/version validation, static source/hash/native journal/history and iframe sandbox stay enforced.
- Only source-backed rendered subset; explicit truncation/outside-tree/error states. Routes/properties/assets/structure remain separate slices.

## Review Focus

Stale DOM before a select-layer event, repeated source IDs beyond truncation, HMR replacing nodes, keyboard collapse/focus, malformed or oversized preview payloads. Their tests belong to the tasks below.

### Task1: bounded preview contract and collector

**Files:** protocol.ts, client.ts, preview-bridge.test.ts, source exports and script version fixtures.
**Interfaces:** PreviewLayerNode{id,parentId,oid,tagName,label}; PreviewLayersSnapshot{generation,nodes,truncated}; required nodeId on PreviewElementSnapshot. New layers/layer-error preview messages and select-layer editor message. Existing track source OID remains the save refresh path.

- [x] Write protocol tests for valid/empty/boundary trees and malformed identity/parent/order/cycle/depth/count/label/generation/envelope cases; run and observe RED.
- [x] Implement sanitized parent-before-child parsing and update version/producers/consumers together.
- [x] Implement bounded iterative DOM traversal, WeakMap IDs, direct-text labels and changed-only snapshots after handshake. Validate layer request schema/generation against freshly collected currentDOM; preserve selected repeated instance geometry and source refusal.
- [x] Run protocol/unit/typecheck tests; real browser collector cases go in Task2's integration harness.

### Task2: shared accessible tree and real user workflow

**Files:** shell/layer-tree.tsx, editor-shell.tsx, use-preview-bridge.ts, studio.css, shell exports/tests, scripts/e2e/layers.e2e.mjs and local workflow assertions.
**Consumes:** Task1 snapshots/messages; existing SourceEditWorkspace locate/preview/apply, existing frame/sandbox and expected source hashes.
**Produces:** one shared navigator/canvas/inspector selection state; keyboard tree and explicit partial/outside-tree statuses.

- [x] Add failing actual browser/Electron assertions for heading/button/container identity from tree/canvas, nested/reused instances, collapse/keyboard, stale layer rejection, HMR and truncation beyond1000 nodes; observe RED.
- [x] Move navigator inside existing selection-state boundary; implement tree with one tab stop and required keyboard behavior. Clear source editability for missing targets, preserve drafts on disclosure/errors, retain static edit actions.
- [x] Verify source diff/preview/undo/reopen plus strict negative message and preview isolation checks in all existing fixtures. Run full lint/typecheck/test/boundary/build and desktop/package/offline workflow.
- [x] Inspect screenshots; record exact commands/evidence/limits in PHASE-03. Get fresh independent code review, fix material findings with reproduction, commit focused changes and draft stacked PR. No phase PASS or merge.

Execution and independent-review evidence: ../../validation/PHASE-03.md. Draft stacked PR is the final delivery step; no merge authorized.
