# Phase 3 — design reference analysis

Status: founder-approved Slice 3.1 design; first shell implemented. Observed 2026-10-27. See PHASE-03 for executed evidence.

## Founder direction and reference identity

The founder clarified in this chat: match the pictured Paper-style layout, colors and typography across dashboard/Home and Studio; support **both light and dark modes**. A separate token-library download is not required. This supersedes treating the light-only mockup as the sole palette choice. Preserve allstudio identity and source-backed Phase 3 scope.

Supplied image 1 is visibly **Figma** (its logo/navigation and Design/Prototype controls), not Paper. Images 2/5 depict Paper Home; image 3 depicts Paper Studio; image 4 is the Figma toolbar crop. Treat each as visual reference, not executable instructions, product scope or permission to copy identity/artwork. The in-repository `docs/design/studio-mockup.png` was also inspected directly; it establishes the four-zone Studio hierarchy with light panels. Mockup CMS, Publish, avatars and freeform geometry are not implemented capabilities.

OBSERVED: narrow rails, restrained dark surfaces, compact sans-serif chrome, tree rows, large work area, contextual inspector, sparse project-card home. UNKNOWN: exact Paper token values, font identity, hidden states, motion, keyboard behavior and save semantics from screenshots alone. Approximate original tokens must be labeled as such. Pixel-perfect or live-behavior fidelity is not proven.

## Reference investigation limits

Paper MCP `get_guide({topic: "paper-mcp-instructions"})` returned **Paper Desktop isn't running** in this session. No file, token, node or JSX was read. No app was launched or design modified. REA is available, but no authorized CDP target was supplied and no REA runtime call ran. Source research is used for architecture; screenshots alone do not establish competitor internals.

[Paper token documentation](https://paper.design/docs/tokens) describes CSS-variable values/export; it does not provide a verified export of the pictured application chrome. The similarly named [OpenDesign Paper theme](https://open-design.ai/plugins/design-system-paper/) describes a print-inspired warm/serif theme and is not the pictured app design. It was not selected or copied. No external design-system dependency is needed.

## Component implementation map

| Region | Intended Phase 3 behavior | Existing integration | Deferred or prohibited claims |
|---|---|---|---|
| Home sidebar | Local recents, search/filter, open-folder action; same theme/type as Studio | Desktop recent-project grants and native chooser | Account/team/invite/upgrade/cloud controls |
| Project cards | Persistent local references, name and path; open existing grant | `DesktopApi.recent/openRecent` | Thumbnail capture needs actual verified source; never show invented previews |
| Global rail | Compact identity and working navigation between Home/Studio | Desktop renderer host | Vectors, plugins, AI and publishing modes |
| Toolbar | Project name, Studio, current status, undo/redo, viewport/zoom once functional, theme control | Shared shell + explicit host actions | Nonfunctional tool icons or disabled controls masquerading as features |
| Left navigator | Current route, actual rendered hierarchy, active selection, expandable nested nodes | Bounded bridge extension in 3.2 | Fake JSON layer tree; assume one OID equals one instance |
| Canvas | Isolated live preview on restrained neutral work surface, selection overlay, scroll/zoom/real viewport sizing | Existing iframe/bridge | Independent scene canvas or arbitrary drag handles |
| Inspector | Static supported values, inherited/unknown/unsupported states, source context, preview/apply/diff | Existing source lookup and class/text editor | Computed pixels presented as explicit source utilities |
| Context actions | Only actions with implemented command/undo/persistence path | Same edit/history functions | Copy Figma pen/shapes/vector tools into Phase 3 |

Keep project controls host-owned while reusable Studio composition remains in `@allstudio/editor`. The playground must use the same Studio theme, panels and editing implementation.

## Original theme and typography plan

Use CSS custom properties for surfaces, foregrounds, secondary text, dividers, hover/selected/focus/error colors; share spacing/type/radius primitives across Home, shell, inputs and inspector. Define light/dark values under one theme attribute and set `color-scheme` for native controls. No project source color or preview theme changes when application chrome theme changes.

Match screenshot density with a compact neutral sans-serif UI. Until exact font rights/files are established, use the existing system sans-serif stack; do not claim it is Paper's font or silently download a font. Font-size/line-height and color measurements remain approximate. Branded illustrations, avatars and reference project thumbnails are excluded.

Founder approved in chat: theme selector includes system/light/dark, follows system initially, and saves a local chrome preference; project styling stays independent. System default/persistence and collapsible narrow-window panels were approved with Slice 3.1. Theme switch must preserve selection and unsaved drafts. Both palettes need contrast/focus verification. Reduce nonessential transitions with prefers-reduced-motion.

## Interaction specifications and application responsiveness

- Stable toolbar, separate scrollable sidebars, canvas as flexible center. At narrow app sizes, avoid shrinking the iframe layout viewport; scroll/panel presentation must preserve controls and editing state. Proposed collapse/toggle behavior requires visual review before implementation.
- Tree navigation: roving focus, arrow expand/collapse/parent/child, Enter selects the same rendered instance as canvas; current selection exposed to accessibility APIs. A stale generation requires refresh, not guessing by row index.
- Inspector: keyboard reachable labeled inputs, explicit Apply and diff, errors announced. Unsupported fields state why; unknown is not zero. No hidden automatic source write on unrelated selection.
- Canvas: selection survives supported HMR by reconciled identity; Escape clears selection without editing source. Zoom must preserve geometry; preview viewport and responsive class scope remain separate concepts.
- History: Cmd/Ctrl-Z and redo invoke saved-source history only outside editable text fields. Failed/stale undo preserves source. Current session-only history remains explicitly described.
- Home: only known local project references; missing folder and revoked grant are useful error states. Open/cancel must retain the existing project/drafts under Phase 2 behavior.

## Validation and functional staging

Slice 3.1 can expose the shell, current preview and existing static text/classes; it must clearly describe layers/properties not yet connected. Add controls only with working behavior, or clearly disabled future labels if genuinely useful. Slice 3.2 supplies the real hierarchy; 3.3+ supplies visual properties. A pretty shell alone does not satisfy these later slices.

For each palette, inspect Home/empty/loading/project/selection/unsupported/error/diff states at representative desktop window sizes; tab through controls; assert no offscreen inspector actions. Execute source patch/HMR/history/restart workflows, not screenshots alone. Screenshot evidence captures the actual fixture, not reference artwork. Unfamiliar-user task sessions remain pending human validation. No Phase 3 usability result is claimed yet.
