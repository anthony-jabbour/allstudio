# Board editor: Framer vs Onlook baseline vs allstudio, a gap analysis

Date: 2026-11-02. Founder request: compare our editor with Framer, see what the `onlook-baseline` fork offers, and port what is useful by rewriting it ("use their code as a reference and make it better"), not copying it.

## Method and limits

- **Onlook**: source inspected at [`anthony-jabbour/onlook-baseline`](https://github.com/anthony-jabbour/onlook-baseline) @ `423e2e924366419e418ee049093872d535eea41a` (Apache-2.0; upstream [onlook-dev/onlook](https://github.com/onlook-dev/onlook), 27,075★ on 2026-11-02). Paths: `apps/web/client/src/components/{hotkey.ts,store/editor/*}` and `apps/web/client/src/app/project/[id]/_components/{canvas,editor-bar,left-panel,right-click-menu}`.
- **Framer**: based on the founder's screenshots plus Framer's publicly documented feature set. Framer was not run, and REA was not used because no authorized target was available. Framer behaviour below is **OBSERVED** (where it is in the screenshots) or **INFERRED** (where it comes from public documentation). Nothing about Framer's internals is claimed.
- **No code was copied.** Where Onlook informed an implementation, the file names the upstream path and commit and says what changed.

## Feature matrix

Legend: ✅ have · ➕ added in this change · ⛔ out of scope / later phase · — not applicable.

| Capability | Framer | Onlook baseline | allstudio before | allstudio now |
|---|---|---|---|---|
| Pages, layers tree, assets | ✅ | ✅ (page/layers/image tabs) | ✅ | ✅ |
| Layer search | ✅ | ✅ (left panel search) | — | ➕ matches + ancestors, auto-expanded |
| Insert frame/shape/text/image | ✅ | ✅ (div/text insert) | ✅ | ✅ |
| Select, shift-select, marquee | ✅ | ✅ (drag-select overlay) | ✅ | ✅ |
| Snap guides | ✅ | ✅ (`snap/index.ts`) | ✅ (adapted) | ✅ |
| **Alt-hover distance measurement** | ✅ | ✅ (`overlay/elements/measurement.tsx`) | — | ➕ `measure.ts`, to hovered layer or to parent |
| **Right-click context menu** | ✅ | ✅ (`right-click-menu`) | — | ➕ driven by the command registry |
| **Command palette / shortcut list** | ✅ (⌘K) | ⚠ display-only `Hotkey` list | — | ➕ ⌘K palette (also `?`) |
| **Auto layout (stacks)** | ✅ | ✅ via CSS flex controls (`dropdowns/display`) | — | ➕ direction, gap, padding, align, distribute, fit width/height |
| **Reorder by dragging inside a stack** | ✅ | ✅ (`move/index.ts` flow vs absolute) | — | ➕ live index reorder |
| **Per-corner radius** | ✅ | ✅ (`dropdowns/radius.tsx`) | — | ➕ |
| **Layer blur, blend mode** | ✅ | partial (opacity only) | — | ➕ |
| **Distribute horizontally/vertically** | ✅ | — | — | ➕ |
| **Resize multiple layers together** | ✅ | — | — | ➕ |
| **Copy / paste style** | ✅ | — | — | ➕ ⌥⌘C / ⌥⌘V |
| Group / ungroup | ✅ | ✅ | ✅ (frame selection) | ✅ |
| Undo/redo, one step per gesture | ✅ | ✅ (history manager) | ✅ | ✅ |
| Fill/gradient, stroke, shadow, typography | ✅ | ✅ | ✅ | ✅ |
| Rotation handle on canvas | ✅ | — | inspector only | inspector only |
| Breakpoints / responsive variants | ✅ | n/a (real site) | ⛔ | ⛔ Phase 3 site editor |
| Components & variants | ✅ | n/a | ⛔ | ⛔ |
| Interactions / prototyping / effects on scroll | ✅ | — | ⛔ | ⛔ |
| CMS, publish/hosting | ✅ | ✅ (publish) | ⛔ | ⛔ Phases 6–7 |
| AI agent / chat | ✅ | ✅ (chat tab) | not connected | ⛔ Phase 5 BYOK |
| Real-time multiplayer, comments | ✅ | partial | ⛔ | ⛔ not V1 |
| Code panel / edit source | ✅ | ✅ | ⛔ for boards | ⛔ (site editor covers source) |
| Vector pen / boolean ops | ✅ | — | ⛔ | ⛔ not V1 |
| PNG/SVG export | ✅ | screenshot manager | JSON only | JSON only |

## What was ported and how it was improved

| Onlook source | allstudio implementation | Why it was rewritten |
|---|---|---|
| `components/hotkey.ts` | `board/editor/commands.ts` | Onlook only stores labels; each surface wires its own key handling, so the shortcut a menu shows can differ from what actually works. Here each command carries `keys`, `run` and `enabled`, and the keyboard, context menu and palette all use those same entries. A test checks that ids and shortcuts are unique. |
| `right-click-menu/index.tsx` | `board/editor/menus.tsx` `ContextMenu` | Built from the registry, so every entry shows its real shortcut and disabled state. Right-clicking an unselected layer selects it first. The menu stays inside the viewport and supports arrow keys. Onlook's AI-chat and IDE entries are omitted. |
| `canvas/overlay/elements/measurement.tsx` | `board/measure.ts` + canvas overlay | Onlook's version is a 300-line React component with five near-duplicate branches per axis, tied to iframe views. Ours is a 60-line pure function in world units: one routine per axis, nesting and overlap both report edge gaps, and it is unit tested. |
| `editor-bar/dropdowns/display/*` (flex) | `board/layout.ts` + inspector section | Onlook writes CSS flex into the page and reads positions back from the iframe. Boards are canonical JSON, so the stack is computed in the model and the stored x/y are always the laid-out result. That makes it deterministic and testable, and selection, snapping, thumbnails and export stay exact. |
| `store/editor/move/index.ts` | `canvas.tsx` `dropInto` + `layout.ts` `stackInsertIndex` | Same idea: dragging inside a flow container reorders it, and dragging anywhere else moves the layer freely. Onlook asks the preview iframe for the new index; ours computes it from sibling midpoints and reorders live while dragging. |
| `editor-bar/dropdowns/radius.tsx` | `radii` field + inspector corner fields | Onlook models radius as CSS strings. Ours is a validated 4-tuple in the schema, and a toggle switches between uniform and per-corner radius. |

## Not taken from Onlook

- The MobX `EditorEngine`, tRPC/DB persistence, sandbox/branch managers, and the chat/AI managers. These are coupled to Onlook's cloud and to Phase 5+ work.
- The `@onlook/ui` component library (shadcn/Radix). It would add a large dependency set, and the existing original chrome already covers the needs.
- The DOM/iframe overlay utilities (`adaptRectToCanvas`). Boards render in-page in world coordinates, so they are not needed.

## Suggested next gaps

These are listed for the founder to choose from, not as committed work:

1. Rotation handle and correct bounds for rotated layers.
2. PNG/SVG export of a frame.
3. Components (a reusable frame with instances).
4. Desktop `.allstudio/boards/*.json` persistence.
5. Board → site scaffold export (Phase 4 gate).
