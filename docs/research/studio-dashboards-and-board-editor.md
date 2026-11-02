# Studio dashboards and board editor — reuse research

Status: IMPLEMENTED FOR REVIEW (founder request, 2026-11-02). Not a phase gate PASS.
Roadmap: Phase 3 shell direction (Home/Studio chrome) and Phase 4 creative board (frames, text, images, shapes, portable JSON). Phase 4 gate tests remain open.

## Founder request (this session)

Build, in a separate worktree/PR, (1) a Paper-style file dashboard, (2) a Framer-style inner Studio dashboard, and (3) a functional Framer/Paper-style design editor, using the founder's `onlook-baseline` fork, Penpot, and other ≥1,000-star repositories as references. Screenshots were supplied of Paper's Recents home and of the founder's own allstudio "Workspace dashboard" mockup open in a Framer-style canvas.

## Decisions taken in this delivery (for founder review)

| Decision | Choice made | Alternative | Why |
|---|---|---|---|
| Where the surfaces live | New web host `apps/studio` (Vite, port 5180); board model in `@allstudio/project`, renderer/editor in `@allstudio/editor/board` | Put routes into `apps/playground` or the Electron renderer | Playground E2E harnesses expect the code editor at `/`; desktop integration needs native-grant design. Package placement follows CODEBASE_ARCHITECTURE §4 |
| Persistence | Versioned `BoardDocumentV1` JSON in browser localStorage; export/import `.board.json` | `.allstudio/boards/*.json` on disk via Electron | Web host has no filesystem grant. Same JSON is the intended on-disk format; desktop wiring is a follow-up |
| New dependencies | **None** | Adopt Moveable / react-zoom-pan-pinch | Handles, pan/zoom and snapping are small; adapted Onlook code (Apache-2.0) covers snapping and wheel math without new supply-chain surface |
| AI ("Agent" tab, "Chat") | Shown as *not connected* with deterministic local quick actions | Fake chat | Local AI/BYOK is Phase 5; no paid calls or provider integration authorized |
| Accounts/teams/invite | Replaced with "Local studio" + local display name | Mock team UI | Local-first; cloud identity is Phase 6 in the private repo |

## Open-source candidates (canonical GitHub, checked 2026-11-02 via `gh api search/repositories`)

| Repository | Stars | License | Last push | Use |
|---|---:|---|---|---|
| [anthony-jabbour/onlook-baseline](https://github.com/anthony-jabbour/onlook-baseline) → [onlook-dev/onlook](https://github.com/onlook-dev/onlook) @ `423e2e9` | 27,075 | Apache-2.0 | 2026-10-21 | **Adapted**: `store/editor/snap/index.ts` edge/center snapping and `canvas/index.tsx` wheel pan / cursor-anchored zoom constants, rewritten as pure functions with provenance headers (editor PR) |
| [penpot/penpot](https://github.com/penpot/penpot) | 61,965 | MPL-2.0 | 2026-11-01 | **Reference only**: layer-tree interactions, shortcuts and undo grouping semantics. No MPL source copied |
| [daybrush/moveable](https://github.com/daybrush/moveable) | 10,765 | MIT | 2024-06-03 | Evaluated, not adopted: inactive since 2024; single-selection resize/move handles were simpler to own |
| [BetterTyped/react-zoom-pan-pinch](https://github.com/BetterTyped/react-zoom-pan-pinch) | 1,957 | MIT | 2026-10-30 | Evaluated, not adopted: CSS-transform wrapper conflicts with screen↔world math needed for marquee/snap |
| [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | 134,984 | MIT | 2026-11-01 | Reference for keyboard conventions; canvas-2D whiteboard model does not fit DOM frames |
| [tldraw/tldraw](https://github.com/tldraw/tldraw) | 51,184 | custom (NOASSERTION) | 2026-10-30 | Excluded: SDK license is not OSI open source for production use |
| [konvajs/konva](https://github.com/konvajs/konva) | 14,915 | NOASSERTION in API (MIT upstream) | 2026-10-31 | Excluded: canvas rendering would diverge from the DOM/CSS model the site surface uses |

Stars are an entry threshold, not an endorsement. No package from this table was installed.

## REA

Not used. No authorized target/CDP session was supplied, and Paper/Framer behavior was taken only from the founder's screenshots. OBSERVED: layout, density, colors and component placement in the screenshots. INFERRED: interaction details (hover menus, ⌘F search, grid/list toggle). UNKNOWN: exact tokens, fonts, motion and competitor internals. No competitor assets, icons or code were copied; icons are original SVG.

## Security notes

- Board JSON is untrusted input: strict schema (bounded pages/nodes/depth/text), finite numbers, color allow-list (blocks `url(...)`/CSS injection), image `src` limited to inline `data:image/(png|jpeg|gif|webp);base64` (no remote fetches, no SVG).
- Rendering uses React text children and inline styles only; no `dangerouslySetInnerHTML`.
- Storage quota failures are surfaced; damaged entries refuse to open instead of rendering partially.

## Board editor (editor PR)

Code: `packages/editor/src/board/{model,geometry,history}.ts` (pure, unit tested) and `packages/editor/src/board/editor/*` (React UI), hosted at `#/file/:id` in `apps/studio`.

Implemented: Pages/Layers/Assets panel (page add/rename/duplicate/delete; layer tree with expand/collapse, hide/lock, rename, drag to reorder or nest, keyboard arrows); infinite dotted canvas with wheel pan, Ctrl/Cmd-wheel zoom at cursor, space/hand/middle-button pan, zoom menu and fit; frame/rectangle/ellipse/text/image tools (drawn layers nest in the frame under the pointer); click/shift/marquee selection, drag-move with edge/center snapping guides, drop-to-reparent, 8 resize handles (Shift keeps aspect), arrow nudge; inline text editing; Style inspector (position, size, rotation, radius, opacity, fill/gradient, stroke, shadow, text family/size/weight/line/letter/align/color, frame clip and size presets, image fit/replace, alignment, multi-select with "Mixed"); label scrubbing; undo/redo with one step per gesture; copy/cut/paste (validated through the board schema), ⌘D, ⌘G / ⇧⌘G, ⌘[ ⌘], ⇧⌘H, ⇧⌘L; image upload/drop/paste; 350 ms autosave to the file store and flush on exit; `.board.json` export; light/dark chrome. The Agent tab states it is not connected and only offers local deterministic actions.

Known limits: rotation renders but selection/handles use the unrotated box; no multi-selection scaling; no vector paths, components, auto-layout, prototyping, comments, multiplayer or PNG/SVG export; text uses system font stacks (no font files); fonts/layout of exported JSON are not converted to site code. Board storage is browser-local in this host; Electron `.allstudio/boards/` persistence is not wired.

Evidence: `node scripts/e2e/board-editor.e2e.mjs` — 18 checks (template open, canvas selection ↔ layers, font-size edit, drag + single-step undo/redo, resize, nested draw, fill, inline text, image upload, duplicate/delete, frame selection, pages, agent quick actions, reload persistence, export JSON schema v1, back to files, no page errors). Screenshots in `docs/validation/evidence/board-editor/`.
