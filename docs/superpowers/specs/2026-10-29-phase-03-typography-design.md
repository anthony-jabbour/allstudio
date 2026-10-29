# Phase 3.3 — source-backed typography design

Status: APPROVED — founder replied “Approve and implement Slice 3.3 (recommended)” in this chat.
Date: 2026-10-29. Base: `97f5bb434d6ac5c371f0337e9c52238976b265d8` (draft PR #17, quality/Electron CI successful). Branch `feat/phase-03-typography` in the existing checkout, stacked on unmerged #17. No worktree, clone or merge.

## Outcome and scope

A user selects a unique static source-backed element and changes font size, weight, line height, alignment, text colour or a safely represented project font-family alias in the inspector. They preview the exact source diff, Apply, observe the property in the real preview, undo/redo and reopen the edited project offline.

Implement all six requested typography groups progressively, starting with font size as the first complete source/render/persistence proof. This design approval covers that six-group slice and its tests; it does not authorize merging or a Phase 3 PASS. Preserve Layers, selection, grants, static text/class edits, hash checks, journals, recovery and preview isolation. No new dependency, engine, cloud feature, font service, font/config rewrite, structural operation or native permission.

Initial editing scope is **Base**. Existing responsive/state/dark/arbitrary variants outside it remain byte-preserved. Breakpoint-specific source controls and viewport/zoom tools remain Slice 3.5; this does not remove them from the goal. A source setting and the value currently rendered at 1440px are deliberately different facts.

## Approaches and recommendation

**A — Recommended: original small inspector controls and property-scoped class rewrites over existing source APIs.** Keep exact token ranges outside the edited property, retain explicit line-height/alpha coupling, show source origin separately from measured CSS, and preserve the current diff/Apply/history flow. Reuse browser-native inputs, existing CSS tokens and the working mapper/workspace; no full Tailwind or CSS cascade engine.

**B — Whole-string tailwind-merge or wholesale Onlook StyleManager/controls.** Rejected for this slice. Whole merging removes unrelated utilities; the Onlook engine/hook brings state/actions/frame/UI dependencies and updates CSS directly with default values. It is not a standalone source-safe inspector for allstudio.

A separate project CSS resolver could answer more configurations, but it is not needed for the first proven constrained controls. Do not silently add it, a new state manager or a generic command registry.

## Reuse and factual evidence

Onlook evaluated pin: `423e2e924366419e418ee049093872d535eea41a`, Apache-2.0; 27,020 stars observed 2026-10-27 in the existing audit (historical observation, not a fresh count). Selected source inspected: `apps/web/client/src/app/project/[id]/_components/editor-bar/text-inputs/{font/font-size,font/font-weight,font/font-family,text-align,advanced-typography}.tsx`, `hooks/use-text-control.ts` and `components/store/editor/style/index.ts`. Their field grouping/unit controls are useful references. The hook defaults missing values to16px/400/black and calls engine style updates; allstudio must not copy those defaults or the coupled manager graph. No upstream code/assets copied by this proposal.

[Thirteen installed tailwind-merge probes](../../research/phase-03-typography-transform.md) reproduced cross-property leading removal and unrelated duplicate normalization. The actual production replacement primitive `spliceElementClassName` already performs confined static-literal edits/readback; keep it.

[Eleven installed Tailwind4.3.3 compiler candidates](../../research/phase-03-typography-compiler-probe.json) generated real rules for explicit pixel size, size/slash leading, numeric weight, ratio/pixel leading, hex/alpha colour and project mono/alignment. Examples: `text-[36px]/7` retains the spacing-based line height; `text-4xl/[1.5]` retains the size while setting a ratio. `text-[#112233]/50` compiles through colour-mix in oklab, so a simple string comparison to RGB is not sufficient. These are compiler probes, not a running inspector or a cascade/persistence proof. Existing installed dependencies remain unchanged.

## Inspector behaviour and source origin

Use the existing quiet two-theme field styling. Each group shows:

- **Source setting:** supported explicit token/literal, no supported base utility, ambiguous, or unsupported. Do not invent16px/400/black/left when absent.
- **Rendered now:** the last measured selected-element CSS value, or unavailable. This is read-only observation, not a source token or an automatically written value. A larger breakpoint, state rule, global CSS or inheritance may determine it.
- Absence of a class utility does not prove inheritance: other selectors or inline CSS may set the property. Label it “No base utility / origin elsewhere or unknown,” not a proven inherited value.
- A labeled value/preset control. Known project-token presets remain selected until the user chooses another value. Explicit numeric/hex modes are intentional choices; never convert a project token to a literal merely because selection, focus, blur or inspection occurred.

Font-size presets can coexist with an explicit px choice. Line-height supports project presets plus ratio/px. Weight supports recognized presets and bounded numeric values. Family choices use project sans/serif/mono aliases, with the rendered stack shown separately. Colour uses a source/current swatch and explicit sRGB hex entry/picker; do not display a fabricated black current value when source or measurement is unknown. Explain unset/unknown/custom states instead of silently normalizing them.

Changing a control changes only the transient class draft. **Preview typography patch** invokes existing previewClassEdit; **Apply typography** invokes applyClassEdit with the trusted source path/OID/hash. No save-on-blur, hidden DOM style mutation or automatic rollback. Keep current Text and Classes tools working; any already-pending manual class draft is part of the same reviewed class patch. A typography Apply preserves an unsaved text draft, as existing class Apply does.

Do not enable visual edits on repeated source instances, dynamic className expressions, stale/unavailable targets or an unmeasurable selected property. Unsupported source groups explain the reason; static text editing remains independently available when supported.

Right inspector content scrolls independently in a desktop window, with canvas/layers accessible. Narrow windows retain the approved stacked/collapsible layout and reachable actions. Theme changes retain drafts/selection/frame identity. No new tool icons or inactive publishing/font-marketplace controls.

## Constrained class transformation contract

Introduce only the pure property inspection/update functions actually used by these controls, as browser-safe editor/site helpers. They do not read files or import the Babel-heavy mapper into the renderer. Existing adapters remain the only source-write path.

1. Identify top-level variant separators without confusing colons/slashes inside bracket/parenthesis expressions. Edit only Base utilities; preserve all other variant chains exactly. Preserve whitespace, class order, unrelated duplicates, tracking/decoration/layout/spacing utilities and source formatting.
2. Recognize conventional static size/weight/leading/alignment/colour/family utilities and narrowly supported static literal equivalents. Current unknown CSS variables/custom utilities are not inferred from pixel measurements. Untyped ambiguous `text-[var(...)]` cannot be assumed to be a size or colour; ambiguous font utilities cannot be assumed to be family or weight. Fail that property safely rather than guess.
3. More than one conflicting base setting for a property is ambiguous: do not choose based on class-string order. Preserve the draft and report unsupported/ambiguous. Exact duplicate settings do not get normalized on a no-op.
4. A size edit preserves a separate explicit leading utility. For a supported size/slash-leading token, replace only its size portion and retain the leading suffix. A line-height edit changes the leading portion while preserving its size. Unknown or conflicting shorthand combinations are refused, not split heuristically. Implicit/auto line height is not frozen into a new guessed pixel utility.
5. An RGB colour change preserves an explicitly supported alpha modifier; unknown alpha/colour shorthands are refused. Preserve other colour/state variants. Only explicit supported values can produce new utility strings; no arbitrary CSS or expression evaluator.
6. New numeric literals use bounded finite values and static Tailwind syntax: size1–512px, weight1–1000, line-height0.1–10 unitless or1–1024px. Limit numeric precision; reject NaN/infinity/invalid units. New colour input is valid sRGB hex; font-family target is one of the three project aliases. These are engineering input bounds for this slice, not claims of general font/CSS support.
7. A same-setting request returns the original class string with no normalization. Existing API no-op detection must leave file/inode/mtime/history unchanged. Main-side string/AST/hash/path validations stay in force even if renderer validation is bypassed.

Do not promise arbitrary theme/plugin/variable/selector coverage. Unknown source means unknown; measured output is not permission to rewrite its source expression. Expanding unsupported grammar requires a demonstrated test and review, not a permissive fallback.

## Read-only preview measurement and confirmation

Extend only the current selected-element snapshot with a fixed measured typography record: fontSize, fontWeight, lineHeight, textAlign, color, fontFamily. Values are bounded strings or explicit unavailable/null, not raw CSS rules/URLs/files. Measure one selected element with browser getComputedStyle; do not read computed styles for all layer rows or change project DOM/styles to preview a value. Increment bridge version for the snapshot contract and update producers/consumers/generated test copies together. Keep exact origin/frame/nonce/schema/identity/count limits and source-revision checks unchanged.

Computed data is an untrusted observation from the preview. It never supplies a file path, source hash, write permission or a source replacement. React text rendering and colour-specific browser parsing must not turn measured strings into HTML or arbitrary CSS. No font assets are loaded into the editor chrome from these fields.

Apply retains the existing bounded save/HMR confirmation window. During that window, re-request selected observations at a bounded interval if necessary; CSS compilation may lag className changes and must not be mistaken for a confirmed visual edit. A stylesheet load should refresh the observation without collecting the whole tree. Polling ends on confirmation, error, timeout, selection change or unmount; do not introduce a permanent style polling service.

Confirmation states:

| Evidence | Feedback / source behaviour |
|---|---|
| Exact source/API no-op | No file/history rewrite; retain existing no-op feedback |
| Write acknowledged, preview not yet caught up | Saved; waiting for property observation, edits locked as current save confirmation requires |
| Source class/readback correct and supported literal property matches measured value | Saved and observed rendered value; refresh source/hash, preserve the other draft |
| Project preset/family alias saved and its actual rendered property observed | Report source preset and measured output explicitly; do not pretend a default px/weight/font-face definition was proven |
| Output unchanged, overridden, unavailable or equivalence not established within the supported measurement model/deadline | Source saved but visual result unconfirmed/unchanged, with observed value/reason. Keep Undo and actual source; do not claim visual success or silently revert |
| Stale file/invalid input/unsupported expression | Existing safe refusal, source untouched |

Colour measurement/normalization must state the sRGB scope of the new hex control; do not claim wide-gamut fidelity from a clipped conversion. Font-family CSS observation does not prove a particular downloaded face/glyph is available; existing offline font fallback remains explicit. Formal visual success for a gate requires real source plus rendered-property proof in the actual fixture, not merely class-string equality.

## Validation and dependency order

- First font-size vertical proof on Aurora's static hero: failing pure transform tests; real labeled control; exact scoped source diff; unchanged `leading-tight`, colour, weight and other utilities; actual rendered size/line-height; history and packaged offline reopen. Then extend through the remaining five groups without creating a separate editing engine.
- Pure tests cover each source group, base versus variant preservation, slash size/leading independence, alpha handling, whitespace/unrelated duplicates, no-op, important/ambiguous/arbitrary/custom values and invalid numeric/hex input. Actual Tailwind compilation confirms output utilities before integration claims.
- Bridge negative tests cover added measured fields, length/key/type limits, stale IDs/nonces, incorrect source/window/version and unavailable measurements. Malicious preview data still cannot invoke native IPC or supply paths.
- Browser and actual Electron cases compare selection, displayed source/rendered state, exact file diff, refreshed computed property, undo/redo and reopen. Test all six groups, non-default/responsive/state tokens retained, repeated-instance/dynamic refusal, external conflict, no-op and an overridden/delayed CSS case with truthful unconfirmed feedback.
- Run earlier source/layer/security/recovery smoke tests, lint/type/unit/boundary/build/package checks. Verify keyboard/focus and both themes. Unfamiliar-user and assistive-technology work remains pending human validation.

Record actual evidence in PHASE-03; get an independent review. Keep the slice on this stacked branch until founder merge approval. Only the founder/authorized maintainer can approve the Phase 3 gate.

## Decisions and non-goals

Founder review is requested for these concrete source/UX semantics: six property groups with token-versus-literal/source-versus-rendered distinction; Base edits initially preserve variants; explicit diff/Apply; generic project font aliases only; unsupported/ambiguous groups fail closed; saved-but-unconfirmed visual results retain source and Undo. These follow the existing architecture and original requirements but are made reviewable before implementation.

No new library, global CSS rewrite, font installation/download, variable/token management platform, routes, device/zoom controls, assets, freeform canvas, AI/MCP or private cloud change. Those remain in their original roadmap slices.

## Independent design review

One fresh local read-only builder reviewer found no material unanswered question: source versus rendered values, shorthand coupling, Base/variant preservation, unsupported states and truthful save confirmation were sufficiently settled while retaining the current draft/diff/Apply/hash boundary. No code/tests or external posts were performed by that review. Founder subsequently approved this design; implementation proof is still required.

Managed Reason was checked per workspace policy, but it reports login_required with no effective account/workspace/cloud scopes. A pairing login was initiated and its link supplied privately; no cloud task, billing activation, purchase or paid run was started. Local independent review kept this design task moving without pretending cloud authorization or completion.
