# Phase 3 workspace finishing

Founder instruction: Home follows the supplied Paper screenshots; Studio follows the supplied Figma screenshots. Support light/dark. All remaining Phase 3 behavior is preapproved. Work directly in the current checkout. Finish functional controls and source integrity before claiming implementation readiness; human usability sessions and founder PASS remain human gates.

## Observed gaps

The actual asset browser screenshot (2026-11-01) shows excessive inspector explanatory text, stacked technical controls, a clipped 1440px preview at 100%, and no compact tool hierarchy. Desktop Home uses a decorative glyph instead of a project preview. Existing controls and source pipeline work but visual gate is not met.

## Implementation order

1. Finish and independently review Slice 3.7 with source/render/restart evidence; commit and prepare its focused draft PR.
2. Bound the desktop to the window with internal panel scroll. Use a compact shared toolbar, source layers at left and contextual inspector at right. Keep source details and raw text/classes available in a collapsed disclosure. Keep useful property controls visible, with concise labels and grouped fields. Source diff/error feedback remains explicit and reachable.
3. Put functional select/hand navigation and viewport/zoom controls in a compact canvas toolbar. Hand dragging scrolls the canvas only; select mode preserves source-backed click selection. Escape resets transient selection/navigation state. Preserve source scope controls and draft guards.
4. Refine Home into a workspace sidebar and generous recent-project card grid with search/open actions. Use local screenshots of actual granted projects when safely captured; any cache is bounded, on-device, and only exposed as encoded image data for the current remembered project. No arbitrary paths or preview-native capabilities.
5. Verify light/dark Home and Studio at representative desktop/narrow window sizes, keyboard access, no root overflow, correct scaled selection geometry and all existing edit operations. Record screenshots and observed issues; fix substantive mismatches.
6. Run required regression/build/package/native/offline proof, independent review, documented supported operations and gate matrix. Prepare reviewable PRs; leave Phase 3 IN PROGRESS until founder validation.

## Reuse and boundaries

Reuse the existing shared editor, tokens, native project grants, screenshot capability in Electron, browser scroll/pointer APIs and source commands. Existing Onlook/Penpot research informs interaction hierarchy; no new editor engine or dependency. No competitor branding/assets. No fictional cloud/team/publish/AI controls. Preview remains untrusted and has no native bridge. Capture, if implemented, belongs to trusted Electron main and the already trusted renderer; preview never requests it.

## Verification contract

Every supported edit: selection → inspector value → exact source diff → refreshed render → undo/redo → restart. Visual checks compare actual captures with founder screenshots for hierarchy, panel proportions, typography, density and chrome; fixture content remains original. Human sessions with unfamiliar users cannot be fabricated and remain pending for founder coordination.
