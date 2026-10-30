# Phase 3.3 — typography transform evidence

Status: RESEARCH ONLY. Observed 2026-10-28. No typography control or new source transformation implemented; no dependency selected/installed. Existing manual class replacement remains unchanged.

## Factual question

Can the existing tailwind-merge dependency safely implement a property control by merging a new utility into the entire original class string, while preserving unrelated properties and responsive/state scopes?

**Observed answer: not as a general solution.** The installed dependency is tailwind-merge 3.7.0, resolved from the editor workspace. The fixture resolves Tailwind CSS 4.3.3. These are installed-version facts, not a recommendation to upgrade or a claim about all Tailwind configurations.

## Source and executed probes

- `packages/editor/src/source-mapper/style.ts`, `tryAddClassToNode`: the older AST helper merges whole class strings with twMerge.
- `packages/editor/src/source-mapper/splice.ts`, `spliceElementClassName`: the current safe editor API replaces a validated static literal using a confined splice. It refuses dynamic expressions, repeated class attributes, unsafe characters and spreads affecting semantics. No change is needed to that replacement primitive for a property-scoped caller.
- `packages/editor/src/source-mapper/index.ts`, `editElementClassName`: already checks literal readback and only returns a valid scoped source result.
- Installed `getDefaultConfig().conflictingClassGroups["font-size"]` returned `["leading"]`.
- Thirteen actual `twMerge(before, added)` probes were executed without touching project source. Inputs/results and version/scope metadata are recorded in [phase-03-typography-probes.json](phase-03-typography-probes.json).

| Probe | Actual result relevant to a property inspector |
|---|---|
| Add `text-xl` to a class string containing `text-sm leading-7` | Removes both `text-sm` and `leading-7`; explicit line height is lost |
| Add `text-xl` to `text-base/7 text-red-500` | Removes the slash line height together with the old font-size token |
| Add `text-xl/8` to `leading-7 text-sm text-red-500` | Removes the separate leading utility and sets the coupled shorthand |
| Add `md:text-2xl` | Replaces matching md size and preserves base size, hover color and md weight in the tested case |
| Set weight/family/color separately | Known conventional font-family/weight and text-color/size groups stay separate in these cases |
| Add size when `text-[var(--hero)]` is present | Removes the arbitrary variable token; its project-specific meaning was not proven by this probe |
| Add `text-xl` when `[font-size:30px]` exists | Keeps the arbitrary property; merger output alone cannot prove the rendered font size |
| Add plain size when `text-sm!` exists | Leaves the important size plus new plain size; a new class token is not proof of an effective visual edit |
| Add font size to `px-2 px-4 text-sm` | Removes unrelated `px-2`; the source change is broader than a typography control requested |

These are library-level observations only. They do not establish the CSS cascade, user theme configuration, selected DOM rendering, source persistence or inspector behavior. No allstudio test or phase gate is claimed from them.

## Recommended narrow transformation boundary

Continue using the existing source replacement/diff/hash/history pipeline. A future property control should produce a minimally changed static class draft before calling that pipeline:

- Identify only explicitly supported utilities in the selected source variant scope; leave all other tokens and their order/whitespace intact. Do not merge the whole class string merely to set one property.
- Preserve line height when changing font size. Coupled slash utilities require an explicit, tested rewrite that preserves their other property, or a clear unsupported result. Do not silently drop the slash suffix or `leading-*`.
- Treat base and each supported breakpoint scope separately. Preserve hover/focus/dark/arbitrary variants outside the chosen edit scope; do not assume the current preview width implies an edit scope.
- Do not interpret unknown variables/custom font names/arbitrary properties/important conflicts as a known explicit value. Show unknown/unsupported source state rather than fabricate a size, color or inherited value.
- Keep dynamically computed className expressions refused. Existing AST splices and byte/hash guards remain the write authority.
- Introduce rendered computed-property evidence only when implementing a real property control. The current bridge confirms class/text changes, which does not prove that a new typography utility defeated existing cascade rules. Keep rendered values distinct from explicit source settings; do not add speculative style protocol fields to the pending Layers slice.

No new library is justified by this finding. Small source-scoped logic can sit above the existing approved dependencies and source adapter once its constrained grammar/control is approved and tested. This note is a recommendation, not founder approval of a custom subsystem or later source semantics.

## Reproduce the captured library observations

From `packages/editor` with the existing installed dependencies:

```sh
bun -e 'import {twMerge,getDefaultConfig} from "tailwind-merge"; import {strict as assert} from "node:assert"; import evidence from "../../docs/research/phase-03-typography-probes.json"; assert.deepEqual(getDefaultConfig().conflictingClassGroups["font-size"],evidence.fontSizeConflicts); for (const item of evidence.cases) assert.equal(twMerge(item.before,item.added),item.result,item.name); console.log(evidence.cases.length + " captured library cases reproduced");'
```

The assertions intentionally pin observed dependency behavior, including undesirable cross-property effects. They are research reproduction, not the future property transform's acceptance tests. The future transform must assert the desired preservation instead.

## Required implementation proof later

Start with one selected hero property through a labeled control: exact minimal class/source diff, unchanged other utilities/variants, real computed rendering, no-op, unsupported expressions, stale hash, undo/redo and packaged offline reopen. Extend to the requested typography set only after that lifecycle works. A material grammar/font/cascade choice remains a founder decision if existing requirements do not settle it.

## Compiler fit probe and reviewed design — 2026-10-29

The installed Tailwind4.3.3 compiler generated rules for11 candidate utilities; captured output is in [phase-03-typography-compiler-probe.json](phase-03-typography-compiler-probe.json). This includes size/slash-leading preservation, numeric weight and line-height literals and hex/alpha colour. An assert-based repetition reproduced the exact captured CSS. This is installed default-theme compiler evidence only, not a visual inspector/cascade/persistence proof. No packages, production source or fixtures changed.

The proposed [Slice3.3 design](../superpowers/specs/2026-10-29-phase-03-typography-design.md) covers all six requested groups and a read-only measured-style contract, with explicit source-origin states and saved-but-unconfirmed handling. A fresh independent local builder review found no material planning gaps. Founder approval is pending before source implementation. Reason cloud remains unauthenticated; no cloud review job or paid action was submitted.
