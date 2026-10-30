# Phase 3.4 spacing, appearance and layout research

Research only, observed 2026-10-29 Pacific. No product code, dependency, native permission or cloud change. Proposed behavior requires founder approval before implementation.

## Reuse and source observations

- Onlook canonical https://github.com/onlook-dev/onlook: 27,042 stars observed through GitHub API, Apache-2.0; inspected existing approved source pin `423e2e924366419e418ee049093872d535eea41a`, not an unpinned upgrade. `apps/web/client/src/app/project/[id]/_components/editor-bar/inputs/spacing-inputs.tsx` accepts values/callbacks but displays missing numbers as zero. `hooks/use-box-control.ts` imports `useEditorEngine`; extraction brings upstream mutation/state coupling. Its controls are interaction references; copy no source, introduce no engine.
- Existing tailwind-merge canonical https://github.com/dcastil/tailwind-merge: 5,701 stars, MIT, installed3.7.0; prior executed probes show whole-string merge changes unrelated classes. Keep it where already approved but do not make it the property inspector transform authority.
- Existing Tailwind4.3.3 compiler generated22 candidate rules, captured in [compiler probe](phase-03-spacing-layout-compiler-probe.json). This is compiler-only evidence; no runtime/cascade/source/persistence proof. `px-*` / `py-*` are logical padding-inline/block, not universally physical horizontal/vertical. `size-*` sets both width and height. `gap-*` sets two axes; colour slash alpha uses colour-mix. A property edit must preserve the companion property or refuse unsupported overlap.
- Official current documentation consulted: [padding](https://tailwindcss.com/docs/padding), [gap](https://tailwindcss.com/docs/gap), [width](https://tailwindcss.com/docs/width), [margin](https://tailwindcss.com/docs/margin). They document source syntax; installed compiler and real fixture output remain the acceptance evidence.

## Existing integration points

`packages/editor/src/site/typography.ts` demonstrates minimal token-range changes and explicit unknown/unsupported states. `shell/typography-inspector.tsx` owns transient drafts only; `SourceEditWorkspace` owns validated patches and actual source remains canonical. `typography-confirmation.ts` and protocolv3 provide changed-versus-unconfirmed observation, fixed selected-only measurements and the HMR deadline. Desktop atomic/hash/journal/history grants need no new capability for static class edits.

Prefer extracting only the small proven token scanner/normalization functions when a second real caller needs them. Do not prebuild a universal CSS engine, property registry, command bus or editor document model. Distinct property groups can have explicit source grammars and comparators.

## Proposed integration sequence

3.4a: margin/padding All, Inline and Block; row/column gap. 3.4b: background colour and supported uniform radius, reusing existing text-colour control. 3.4c: display/flex direction/justify/alignment, uniform grid tracks and simple width/height sizing. Each PR proves a real selected section, exact minimal source diff, changed rendered properties, undo/redo, stale-source refusal and offline restart. The entire3.4 criterion stays open until all three integrated sub-slices work.

No new OSS project is selected. REA was not run; these decisions rely on licensed source, official documentation and local compiler behavior. Competitor internals and upstream runtime quality remain unverified. Founder design review must settle the explicit shorthand/unknown/control behavior before product code.
