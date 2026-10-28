# Phase 3 — open-source editor audit

Status: IN PROGRESS — research recommendation; no new runtime or dependency adopted.
Observed: 2026-10-27 (America/Los_Angeles). Public baseline: `d132d58ed70f2a38ea4af529144f5a051827aa36`.

## Method and evidence limits

Canonical GitHub API metadata, pinned recursive trees and selected source files were inspected. Existing Onlook research checkout was read at the verified pin. Penpot and FigCraft selected raw source was fetched at the SHAs below into `/tmp/allstudio-phase03-research`; no checkout/clone was created. Reproducible upstream links identify the sources independently of that temporary cache. [Metadata snapshot](phase-03-upstream-evidence.json) records heads, stars, license detection and maintenance dates.

OBSERVED means source/metadata or an executed allstudio check. INFERRED means the integration judgment. UNKNOWN includes upstream runtime quality, measured bundle cost, vulnerabilities in unselected dependencies, and integration fit until a proof runs. Source presence or upstream tests do not establish that those tests pass here. No upstream application, Rust executable, WASM bundle or new dependency was installed or executed.

## Eligibility and maintenance

Every candidate below exceeds 1,000 canonical GitHub stars at observation. Eligibility does not approve adoption. Exact SHAs are versions for this evaluation; selected manifest versions are separately noted below. None is archived in the API snapshot. Repository push dates are activity signals, not release or security guarantees.

| Canonical repository | Stars | Evaluated SHA | License | Last push (UTC) |
|---|---:|---|---|---|
| [BetterTyped/react-zoom-pan-pinch](https://github.com/BetterTyped/react-zoom-pan-pinch) | 1,957 | `df6a7c6187a41bb0c7d294d0aedd7cd632369671` | MIT | 2026-10-24T20:05:27Z |
| [benjamn/recast](https://github.com/benjamn/recast) | 5,256 | `111a5a8034091e7f844456b06eaac8fd1a3064fc` | MIT | 2026-10-18T19:06:16Z |
| [daybrush/moveable](https://github.com/daybrush/moveable) | 10,764 | `75069102f30c88cd89ecaaa8ca7e5f7434e54807` | MIT | 2024-06-03T07:57:45Z |
| [daybrush/selecto](https://github.com/daybrush/selecto) | 2,234 | `7c75ef57790ffc197afdab0f49127ce38d3707b9` | MIT | 2024-06-17T18:43:06Z |
| [dcastil/tailwind-merge](https://github.com/dcastil/tailwind-merge) | 5,701 | `7b5d20c543c3de07cd9fad570a9af0b5a0f976f6` | MIT | 2026-10-26T16:27:33Z |
| [facebook/lexical](https://github.com/facebook/lexical) | 23,984 | `8a573d146047f0cc2ab8eb9232a88e3c73ccd48d` | MIT | 2026-10-28T05:35:22Z |
| [omgovich/react-colorful](https://github.com/omgovich/react-colorful) | 3,561 | `8506e8c4b777e0056ce3567dc3a06ced143034bc` | MIT | 2026-09-01T16:22:24Z |
| [onlook-dev/onlook](https://github.com/onlook-dev/onlook) | 27,020 | `423e2e924366419e418ee049093872d535eea41a` | Apache-2.0 | 2026-10-21T20:42:29Z |
| [penpot/penpot](https://github.com/penpot/penpot) | 61,769 | `f6f9df9a1a94087ecc9fd30337f908598ada983c` | MPL-2.0 | 2026-10-28T05:38:44Z |
| [radix-ui/primitives](https://github.com/radix-ui/primitives) | 19,439 | `eb3a2b7091293e27df8f9ba906632d8daa3d81a3` | MIT | 2026-10-14T21:52:47Z |
| [storytold/figcraft](https://github.com/storytold/figcraft) | 3,650 | `90054a89c4ca8a96db6e3a26cd3af3a475eaa2d7` | MIT OR Apache-2.0 (Cargo.toml and both license files; API reports Apache) | 2026-10-27T21:09:27Z |

No release-cadence, full transitive-license or advisory audit has been completed. Before adopting a package, pin a released artifact, inspect its actual tarball/lockfile and advisories, verify its font/asset notices, and measure installed/build size. Do not interpret this audit as certifying dependency safety.

## Onlook: coherent extraction boundaries

All paths in this section are relative to [Onlook at the evaluated commit](https://github.com/onlook-dev/onlook/tree/423e2e924366419e418ee049093872d535eea41a). Editor manager paths below start at `apps/web/client/src/components/store/editor/`.

| Manager / source | Implemented entry points and dependencies | allstudio fit / extraction cost |
|---|---|---|
| `engine.ts` | Composes managers with MobX; resolves filesystem/history/sandbox through BranchManager; PostHog and chat/API managers | High coupling. Do not import engine or recreate its remote service graph |
| `canvas/index.ts` | Scale and pan setters call debounced save; imports tRPC, DB default frame and models | Adapt coordinate concepts, not database persistence; transient viewport state needs no server |
| `element/index.ts` (singular) | Hover, click and shift selection resolve frame views, overlays and engine actions | Reference selection reconciliation; allstudio already selects via its own validated bridge |
| `ast/layers.ts` | Per-frame root tree and DOM-ID maps, filtered by selected frames | Useful distinction between rendered identity and source identity; requires engine/frame metadata |
| `style/index.ts` | `updateMultiple` builds style action and updates preview; observes selected elements; font updates | Keep allstudio source patch as authority; copying DOM updates alone would not persist |
| `text/index.ts` | Frame RPC starts/ends text editing; verifies static editability; overlay geometry | Existing allstudio static text edit path is smaller and proven; inline editing is a later enhancement |
| `overlay/index.ts`, `overlay/utils.ts` | Refreshes rectangles from frame view; adapts scale/offset with DOMMatrix and a canvas ID | Candidate bounded adaptation; replace IFrameView/global canvas assumptions, test nested scrolling and zoom |
| `frames/{manager,navigation,dimension}.ts` | Frame collection/navigation; pure dimension rounding helper | Adapt sizing/navigation behavior, retain one iframe initially; rounding helper alone adds little value |
| `pages/index.ts`, `pages/helper.ts` | Sandbox scan, static route validation/navigation and page mutation helpers | No direct extraction: scan granted local routes in main, reject dynamic/ambiguous routes |
| `insert/index.ts` | Draw/insert text/div/image, engine actions and UI tokens | High coupling; insertion is not required for the first Phase 3 proof |
| `move/index.ts` | Drag preparation/distance thresholds; frame drag targets; move actions | Study source-safe sibling reorder; do not equate DOM dragging with validated JSX moves |
| `history/{index,helpers}.ts` | Transactions, action merging, engine writes and telemetry | Keep LocalWorkspace journal and hash-checked history; no second undo authority |
| `snap/index.ts` | Nearby frame edge/center guides, threshold configuration, engine frame collection | Reference only in Phase 3; freeform frame snapping is Phase 4 work |
| `image/index.ts` | Project image paths, preview/selected image, style/action updates; path and conversion helpers | Asset listing/association can be bounded, but filesystem grant/API decisions are required first |
| `font/index.ts`, adjacent managers | Scans configs, layout/Tailwind changes, uploads/search | Large multi-file/network side effects. Do not port for a static font-family selector |
| `group/index.ts` | Common-parent eligibility, group/ungroup actions | Requires new source transforms; outside first proof; never substitute a scene graph |

Selected UI source: `apps/web/client/src/app/project/[id]/_components/editor-bar/inputs/spacing-inputs.tsx`, `input-icon.tsx`, `hooks/use-box-control.ts`, and text controls. SpacingInputs exposes values/callbacks, but renders missing values as zero; that conflicts with this request's unknown/inherited semantics. Its hook imports the engine. Adapt only presentation after tracing InputIcon/use-input-control dependencies; do not copy wholesale. `packages/ui` adds its own tokens, icon imports and dependency closure; it is not a standalone approved React 19 component library.

The existing allstudio `source-mapper/index.ts` format-preserving edit functions already cover text/static class replacement. Upstream `packages/parser/src/code-edit/move.ts` filters JSX children, inserts keys and splices child arrays. It cannot be copied as the Phase 3 reorder algorithm: this task requires preserving existing keys and unrelated formatting, and refusing expression/conditional ambiguity. Inspect `helpers.ts` and test comment/whitespace attachment before any adaptation.

`apps/web/preload` / `packages/penpal` are architectural references. allstudio already has a smaller origin/frame/nonce/version-checked protocol. Do not replace it with upstream mutation RPC or wildcard trust. Preserve existing Apache notices and add per-file upstream/destination/modification records for any copied implementation. No Onlook UI/assets were copied by this audit.

## Penpot: strong interaction reference, expensive runtime adoption

Pinned source: [Penpot develop](https://github.com/penpot/penpot/tree/f6f9df9a1a94087ecc9fd30337f908598ada983c).

| Source | Finding | Integration consequence |
|---|---|---|
| `frontend/src/app/main/data/workspace/viewport.cljs` | Potok events, Beicon streams, common geometry and optional WASM viewport sync; pan/viewport updates | React wrapper alone cannot extract this subsystem |
| `frontend/src/app/main/data/workspace/{selection,transforms}.cljs` | Shape selection/area selection, hierarchy and workspace events; model-specific geometry | Study keyboard and ambiguity behavior; do not import its document store |
| `frontend/src/app/main/ui/workspace/sidebar/layers.cljs` | Layer tree, search and app selection/store dependencies | Reference hierarchy interactions; allstudio tree must come from real preview DOM |
| `frontend/src/app/main/ui/workspace/sidebar/options/menus/{typography,layout_container,color_selection}.cljs` | Dense contextual controls, tokens, local store dispatch; typography virtualizes font lists | Reference grouping and mixed-value UI; substantial ClojureScript/Rumext/state coupling |
| `common/src/app/common/geom/shapes/{flex_layout,grid_layout}.cljc` and subdirectories | Document-shape layout geometry | Browser CSS already lays out source-backed sites; replacing it would duplicate rendering authority |
| `frontend/src/app/main/data/workspace/shortcuts.cljs` | Workspace command/shortcut architecture | Reference focus-aware commands, not global key interception |
| `frontend/src/app/main/data/workspace/undo.cljs`, `common/src/app/common/data/undo_stack.cljc` | Undo/redo changes, groups and bounded transactions | Keep native saved-source history; grouping concept may help future gestures |

Core event files and selected controls were source-inspected; geometry subdirectory inventories identify further follow-up, not executed or exhaustive algorithm review. Frontend ClojureScript and backend requirements make embedding the app much larger than extending React controls.

MPL obligations apply to covered files, including modified files and new files containing covered source. Distribution must preserve applicable notices and make covered source available as required. A larger work may use another license for separate files; this does not relicense copied Penpot files as Apache. See [Mozilla MPL 2.0](https://www.mozilla.org/en-US/MPL/2.0/) and [FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/). Any source incorporation needs a file-level provenance/distribution plan and founder approval. Current recommendation: reference only; no Penpot source incorporated.

## FigCraft: useful commands, incompatible website authority

Pinned [FigCraft source](https://github.com/storytold/figcraft/tree/90054a89c4ca8a96db6e3a26cd3af3a475eaa2d7). Root Cargo declares version `0.11.2`, edition 2024, Rust 1.95, `MIT OR Apache-2.0`; both license texts are present. GitHub's single detected license omits that dual-license declaration. Per-file/assets/dependency rights still need review before copying.

| Source | Observed capability / coupling |
|---|---|
| `crates/engine/src/lib.rs`, `cmd.rs`, `cmd/*` | Session/Document engine; shared command specs with ID, parameters, history flag and run function; registry used by human/programmatic surfaces |
| `crates/doc/src/{lib,node}.rs` | Persistent node/document graph and typed shape/text/layout properties; canonical FigCraft document, not JSX |
| `crates/layout/src/lib.rs` | Layout calculations over Document/Node types; does not transform React source |
| `crates/geom/src/{lib,transform}.rs` | Geometry and affine helpers; potentially isolated algorithms, still need focused TS equivalence tests |
| `crates/engine/src/canvas/snap.rs` | Edge/center/guide targets and distances using document world bounds |
| `crates/engine/src/selection/selection_reorder.rs` | Restricts smart geometry reorder to regular rows/columns/grids; not safe JSX sibling reordering |
| `crates/render/src/lib.rs` | Scene renderer using tiny-skia and internal layout/text/geometry crates; not browser DOM rendering |
| `crates/ui-egui/Cargo.toml` | Native egui UI with internal engine/render dependencies; not reusable React inspector components |
| `crates/mcp/src/{tools,headless}.rs`, `docs/mcp.md` | Headless Session and control methods; screenshot render capped to 4096 maximum side in inspected backend; operates on its document |
| `apps/figcraft-cli/src/main.rs` | Info/export/render/run/commands/MCP, automation read/write roots |
| `apps/figcraft-web/{Cargo.toml,src/api.rs}` | Real wasm-bindgen browser control API (`execute`, `request`, screenshots/files), eframe/egui/WebGPU/WebGL dependency graph |

The architecture document contains older statements (e.g. no `.fig` reader) while current CLI source advertises `.fig` export; documentation is not a substitute for current code or executed fidelity tests.

| Integration path | Assessment |
|---|---|
| Architecture reference | Valuable: one validated command path for UI/keyboard/future automation. No runtime cost |
| Isolated algorithms adapted to TS | Possible for geometry, with notices and cross-language equivalence tests; browser DOM already provides site geometry |
| Narrow Rust process via main IPC | Technically possible; adds executable signing, lifecycle, IPC schemas and filesystem grants; no demonstrated Phase 3 advantage |
| WASM embedding | Browser API exists, so not dismissed on language grounds. Still renders a separate scene; ABI stability, build/bundle size and React integration unmeasured |
| External CLI/MCP tool | Evaluate separately in Phase 5; not Phase 3 functionality or a promised board-file converter |

No Rust/WASM proof executed. Recommend reference only for Phase 3. Scene snapshots cannot replace expected-hash file saves or guarantee TSX persistence.

## Focused libraries

| Candidate / exact inspected API or source | Fit, coupling and maintenance | Recommendation / proof |
|---|---|---|
| Moveable `packages/react-moveable/src/MoveableManager.tsx`, package 0.56.0 | DOM drag/resize/rotate/controls; sizable drag/matrix/overlap dependency closure; last API push 2024 | Defer; handles cannot authorize arbitrary CSS/JSX transforms; no fit proof |
| Selecto `packages/react-selecto/package.json`, 1.26.3 | React wrapper over selection runtime; crossing iframe boundary still needs bridge; last push 2024 | Defer multiselection until supported source semantics exist |
| react-zoom-pan-pinch `src/core/instance.core.ts` | Wheel/touch transform state and event plumbing; React peers accepted; root manifest is 0.0.0, not a verified release version | Reference/consider only if native CSS viewport transforms become insufficient; no fit proof |
| react-colorful `src/components/common/Interactive.tsx`, `HsvaColorPicker.tsx`, 5.8.1 | Focus/keyboard/pointer interaction, no runtime dependencies in manifest, React >=16.8 peers | Candidate for a later color control; first bounded control can use native color + text input; no install |
| Radix Slider `packages/react/slider/src/slider.tsx`, package 1.6.1 | React 19 peer compatibility; directional/collection/focus utilities; extra dependency graph | Candidate when keyboard slider behavior warrants it; native controls first |
| tailwind-merge (already installed) | Conflict utility merging; property transformation must isolate chosen variant/property first; whole-string merge could remove unrelated utilities | Reuse existing dependency only after scope-preservation regression cases; not a CSS cascade oracle |
| Recast `lib/printer.ts`, 0.24.0 | Reprint/preserve source when AST original linkage exists; ast-types/esprima/source-map and Node >=22 manifest | No substitution now: existing confined splices preserve formatting; AST strategy needs proof before dependency approval |
| Lexical (metadata only) | Rich-text canonical state solves a different problem from static JSX text | Defer; not source-audited or selected |

Design-token editors and reliable component trees: use CSS variables and the existing source mapper plus real rendered hierarchy initially. Penpot tokens and Onlook layers demonstrate the concepts but do not provide a drop-in React/TS source-aware token editor. No additional token platform is justified by this audit.

## Feature reuse matrix

Difficulty/coupling: L low, M moderate, H high. Licenses follow the pinned repository sections above. “Baseline” means the existing allstudio pipeline was executed, not that a new adaptation works.

| Feature / priority | Best candidate and exact upstream location | Existing allstudio reuse | Difficulty / framework coupling | Action / working proof |
|---|---|---|---|---|
| Studio shell / 3 | Onlook editor-bar controls + original allstudio shell; Paper screenshots | EditorShell + desktop project adapter | M / React; avoid MobX/engine | Adapt presentation; baseline only |
| Pages/layers / 3 | Onlook `pages/index.ts`, `ast/layers.ts`, `element/index.ts` | Instrumentation, locate, strict bridge | M / engine replaced by bounded snapshots | Adapt concepts; no tree proof |
| Selection/overlay / 3 | Onlook `overlay/utils.ts`, `overlay/index.ts` | Existing rect snapshots and overlay | L–M / DOM + frame offset | Adapt geometry; proof plan 1 |
| Pan/zoom / 3 | Onlook `canvas/index.ts`; zoom-pan-pinch `src/core/instance.core.ts` | Existing iframe; transient React state | M / remove DB setters | Reimplement minimal viewport UI; no new dependency |
| Typography / 3 | Onlook `style/index.ts`, editor-bar text controls | Class patch/diff/hash/history | M / extract control boundary | Adapt grouping; proof plan 2 |
| Spacing/fill/color / 3 | Onlook `inputs/spacing-inputs.tsx`; react-colorful Interactive | Same class pipeline | M / React controls; unknown value handling | Adapt or native inputs; no fit proof |
| Flex/grid / 3 | Onlook `style/index.ts`; Penpot `menus/layout_container.cljs` | Static class replacement | M / no browser layout replacement | Adapt bounded utilities; no proof |
| Responsive frames / 3 | Onlook `frames/{manager,navigation,dimension}.ts` | Preview width + class patch | M / engine state excluded | Adapt behavior; width and source scope separate |
| Rearrangement / 3 | Onlook `parser/src/code-edit/move.ts` | Babel, confined splice, native journal | H / AST semantics and comments | Adapt only after source-safe eligibility proof |
| History / 3 | Onlook `history/index.ts`; FigCraft `engine/src/lib.rs` | LocalWorkspace undo/redo | L / keep native authority | Reuse allstudio; baseline demonstrated |
| Assets / 3 | Onlook `image/index.ts` | Scoped native adapter and static JSX source | H / bounded new read/write capability | Investigate owned assets; founder decision pending |
| Freeform frames/shapes / 4 | FigCraft `doc/src/node.rs`, `engine/src/cmd/create.rs` | Future separate board adapter | H / Rust scene model | Defer; source inventoried, no runtime proof |
| Vector paths / post-V1 | FigCraft `engine/src/canvas/vectoredit` | None required | H / scene/path/render stack | Defer; directory reference only |
| Board auto layout / 4+ | FigCraft `layout/src/lib.rs`; Penpot common flex/grid | Future board schema | H / model-specific engines | Reference only; no board contract approved |
| Board components/variants / 4+ | FigCraft `engine/src/assets/components*`, `cmd/component/*` | None | H / document/library model | Defer; inventory only |
| Natural-language commands / 5+ | FigCraft `engine/src/cmd.rs`, `mcp/src/tools.rs` | Future wrappers over manual edits | M / no model code now | Reference command validation; defer AI |
| MCP automation / 5+ | FigCraft `mcp/src/{tools,headless}.rs` | Future permissioned manual command adapter | H / tool permission/runtime boundary | Defer |
| Premium generation / 8+ | No adopted public editor subsystem | Private cloud remains untouched | H / sandbox, metering, private orchestration | Defer; outside research implementation scope |

## Two proof candidates

Detailed executable acceptance plans are in [architecture recommendation](phase-03-editor-architecture-recommendation.md#proof-plans). Selection rationale: viewport/overlay correctness unlocks the Studio and responsive work; one typography control proves visual intent reaches real source. Neither imports an entire manager. Lower-value standalone helpers or a Rust renderer would not establish that lifecycle.

## Delivery and remaining evidence

Baseline tests, real source/preview/restart/security evidence and exact local artifact paths are in [PHASE-03](../validation/PHASE-03.md). Upstream adaptation proofs NOT RUN. Full project integration, dependency-security certification, unfamiliar-user sessions and Phase 3 founder gate are pending. REA tools are available, but no live target/CDP endpoint was provided; source research and supplied screenshots suffice for this bounded recommendation. No REA invocation or runtime observation is claimed.

## Follow-up: installed typography utility evidence (2026-10-28)

Thirteen executed installed-library probes demonstrate why whole-string tailwind-merge is not a property-scoped typography operation: font-size conflicts remove leading utilities, slash size can lose coupled leading, and unrelated duplicate padding classes are normalized. See [typography transform evidence](phase-03-typography-transform.md) and its captured inputs/results. This changes the implementation recommendation, not production code; no new dependency or typography control was adopted.
