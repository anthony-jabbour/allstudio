# Phase 3.4 — spacing, appearance and layout

Status: proposed design, awaiting founder approval. No production code changed for this slice.

## Intent and architecture

Users select a real static section, change supported spacing/layout/appearance through the shared inspector, inspect the exact source patch, Apply, see the actual preview change and Undo. Site files remain canonical. Extend the approved3.3 draft/diff/hash/history/HMR path; no new engine, dependency, native API, font/asset access or cloud feature.

There is one practical architecture within the approved boundary: original bounded property transforms over the existing source pipeline. Full Onlook manager extraction would import its engine/mutation/state dependencies; a separate design engine would compete with JSX as source of truth. Neither is proposed. Reuse the small proven class-token scanner and existing colour/validation concepts only where real callers need them. [Research and compiler evidence](../../research/phase-03-spacing-layout.md) explain the constraints.

## Integrated delivery order

- **3.4a spacing:** margin and padding All/Inline/Block; gap All/Columns/Rows. Labels use logical CSS axes, never assume Inline means horizontal in every writing mode. Native preset/custom numeric controls follow Typography's source-versus-last-rendered distinction. No phantom zero when source is absent. Margin supports auto and bounded negative literals; padding/gap reject negative values.
- **3.4b appearance:** background sRGB hex/preset colour with existing slash/hex alpha retained, plus uniform radius. Text colour continues using3.3. Background-image/gradient/position utilities are preserved. Unknown bg tokens may make colour unsupported; unrelated spacing stays available. Radius with unknown/mixed corner overrides is unsupported until a safe per-corner transform exists.
- **3.4c layout/sizing:** display block/flex/inline-flex/grid/inline-grid; flex row/column/reverse directions; justify start/end/center/between/around/evenly; align start/end/center/stretch/baseline. Uniform grid rows/columns1–12; static subgrid/arbitrary templates/expressions stay unsupported. Width/height known auto/full/fit/min/max/fraction presets and explicit px literals. Min/max constraints are preserved and displayed as a possible reason for unconfirmed output, not silently removed.

These are focused follow-up PRs, not permission to claim full3.4 after3.4a. Preserve responsive/state variants in Base edits; explicit breakpoint tools remain3.5. Route, structural and asset work remain in their existing slices.

## Source-safe shorthand rules

Every transform validates one requested group and edits only its supported Base tokens. Unrelated duplicates, whitespace and scopes remain byte-preserved. Important, variable/custom ambiguous and arbitrary CSS-property conflicts refuse the affected group. Source unsupported does not imply a rendered value is missing.

For recognized unambiguous shorthands, preserve their companion property explicitly. Example: changing Inline padding on `p-6` to preset8 yields `px-8 py-6`; changing row gap on `gap-6` yields `gap-x-6 gap-y-<new>`. A width change on `size-20` retains its height using `h-20`. Do not guess from last-token order: CSS order is compiler-defined. Existing mixed conflicting All/axis/directional groups are refused with the exact conflict reason unless a tested mapping proves which property would be changed and retains every companion value. Physical-side/logical-side mixtures, custom utility declarations and arbitrary expressions are not normalized automatically. A no-op retains original shorthand bytes.

Literal input proposal: at most3 decimal places, finite px numbers; padding/gap/radius0–2048px, margin−2048–2048px, width/height1–4096px. Existing supported presets remain project-defined values, with no fixed-pixel assumption from their names. Hex entry retains raw typed input until its explicit Apply; controls never write files on blur. Unknown source origins remain “elsewhere/unknown,” not inherited/default guesses.

## Inspector and observation

Place collapsible Spacing, Appearance and Layout groups beside Typography in the current inspector, with clear source draft and last observed values. Preserve invalid local fields across unrelated control edits; disable relevant Apply while invalid. Diff/Apply can include supported edits from multiple groups through the same class draft, with the resulting patch visible. Unsupported properties explain the cause without disabling unrelated groups.

Extend the selected-only measured contract with a fixed strict record for the implemented properties as each sub-slice needs them. No computed styles on the whole layer tree, arbitrary key names, message-supplied paths or native exposure. Measure actual margin/padding sides, gap axes, background/radius, display/flex/grid/sizing and direction/writing mode as necessary; nullable bounded strings when unavailable. Every added field has schema/limit/negative tests and a deliberate protocol version update, including browser runtimes.

Confirm source readback plus changed relevant computed values; literal targets must match within explicit CSS rounding tolerance. Project presets require observed change without assuming a default theme. Grid confirmation verifies the supported actual track count; width/height can be constrained by parent/min/max and then remain unconfirmed. An inactive flex/grid property or unchanged responsive result is saved-but-unconfirmed, keeping Undo. Geometry proof on a real section supplements computed values for the layout acceptance scenario. No automatic cascade rewrite or rollback.

## Validation and acceptance

Each sub-slice starts with a failing behavioral test, then minimal source helper/UI/protocol work. Unit tests cover companion shorthand preservation, scope/whitespace/no-op, negative/range/injection/important/ambiguous cases. Compiler tests pin actual generated utility behavior. Real browser and Electron tests compare selected element, displayed settings, exact source diff, refreshed computed CSS and changed layout geometry. Include dynamic/repeated refusal, hash conflicts, unrelated responsive/state utility preservation, undo/redo, full offline quit/reopen, both themes and keyboard/narrow layouts. Keep all301 current units,34 prior browser,13 layers and native/security/recovery regressions green as applicable. Never substitute mock-only or typecheck evidence.

Representative real fixture tasks: Harbor `#hero` starts with `mx-auto grid max-w-5xl gap-8 px-6 py-20 md:grid-cols-2 md:items-center lg:py-28`; change Inline padding to32px and compare computed inline sides/child geometry while retaining vertical/breakpoint/source bytes. Change its gap axes independently with explicit companion preservation. The static Harbor CTA exercises background/radius while hover/focus variants remain untouched; the dynamic secondary button remains refused. A real multi-child flex container exercises direction/alignment and geometry, with a supported grid track and constrained-size case alongside it. Responsive overrides must yield unconfirmed rather than false success.

3.4 complete requires spacing and appearance/layout/sizing controls actually implemented and evidenced, not just the first sub-slice. Human usability/assistive-technology gates remain pending founder-led validation. No merge or phase PASS without founder approval.

## Founder decision requested

Approve this concrete extension of the existing property pipeline and three-PR delivery order, including logical-axis labels, explicit companion-preserving shorthand expansion, fail-closed mixed conflicts, stated literal bounds, source/rendered distinction and saved-but-unconfirmed behavior. No new external dependency, editor engine or filesystem permission is requested. This approval is separate from structural/asset decisions later in Phase3.

## Independent builder check

Fresh read-only GPT-6 Luna reviewer at extra-high found no material implementation blocker: scope, source safety, strict selected measurement bounds, compiler-proof limits and real fixture targets were coherent with current code and roadmap. No product code or runtime test was executed by this design review. Founder approval remains pending.

Founder approved this design: “Approve and implement Slice 3.4 (recommended).” Implementation starts with the spacing sub-slice; appearance and layout/sizing follow as separate integrated PRs.
