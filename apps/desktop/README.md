# allstudio desktop — Phase 2 preview

The desktop uses the shared editor to edit original supported Next.js source files. It does not require an allstudio account or cloud service. Phase approval belongs to the founder; this is not a general release or a claim of universal Next.js compatibility.

From the public repository root, with Bun 1.3.14 and the system C compiler installed:

```sh
bun install --frozen-lockfile
bun run dev:desktop
```

To make the local package on its target OS/architecture:

```sh
bun run package:desktop
```

The arm64 Mac result is `apps/desktop/dist/mac-arm64/allstudio.app`. The native helper is compiled for the build host: cross-platform native packaging and Windows are not validated. Developer ID signing/notarization are intentionally deferred; the founder approved an unsigned local package for this gate.

## Open and edit

1. Install the project's dependencies before opening it. The demonstrated compiler is Next.js 16.4.3 with React, JSX/TSX under `src/`, and the three repository fixtures.
2. Choose **Open project** and select its folder. The app may add a reviewed Next.js config wrapper after consent. An existing config is preserved exactly at the adjacent `next.config.allstudio-original.*` path. A collision or changed editor wrapper is refused rather than overwritten.
3. Review the exact executable, arguments and folder before choosing **Run**. Project code executes with your user-account access. **Remember for this project** is opt-in; changed package/config/runtime fingerprints require permission again.
4. Select a supported rendered element, review its source location and patch, then **Apply text** or **Apply classes**. Apply saves the original source immediately. Preview-only attributes are not persisted. Source files are limited to 1 MiB, paths to 1024 characters, and scans to 1000 eligible files/10000 entries; root metadata reads are also bounded.
5. **Undo saved edit** and **Redo saved edit** operate on the session's saved changes with stale-source checks. External changes require reselecting affected elements. Unapplied field drafts are not saved to source.
6. After an interrupted save, reopen the project and choose **Restore pending edit**, **Keep current files**, or **Cancel**. A conflicting external edit is never silently overwritten. Recovery and recent-project/grant JSON live in Electron userData; recovery files are private and fsynced.

The config wrapper returns the original config outside the editor's preview environment. The edited project can build without Electron or an allstudio dependency. User-defined JSX/TSX loader rules are not silently replaced. Other framework/compiler versions and advanced configuration patterns need their own proof.

## Layers and selection

The navigator lists instrumented rendered source elements, nested under their nearest included DOM ancestor. Click a row or the preview to inspect the same instance and source target. Expand/collapse and keyboard focus do not save or discard field drafts; selecting a different element follows the existing canvas-selection behavior for unapplied drafts.

Use Up/Down, Left/Right, Home/End and Enter/Space in the layer tree. Reused component/list instances have separate rows and rectangles; editing one repeated instance remains unsupported. Unmapped or dynamic source edits retain their existing refusal messages.

The tree is explicitly partial when its node/depth/visit limits are reached. A canvas target outside that displayed subset retains its own inspector state without a false active layer. Stale layer requests require reselection and never write source. The actual source-instance count remains independent of any partial tree count.

## Typography (Phase 3.3)

Select a uniquely rendered static element, then use **Typography · Base** for font size, weight, line height, alignment, sRGB hex text colour and project sans/serif/mono aliases. Choose a preset or an explicit numeric/hex mode. The source draft and last observed rendered value are shown separately; a missing Base utility may originate elsewhere and is not a default value.

Use **Preview typography patch** to inspect the source diff, then **Apply typography** to save through the existing source/hash/history pipeline. Blur changes only the draft. Other classes and responsive/state variants are preserved; breakpoint-specific editing is not included yet. Size edits retain explicit slash line height, and colour edits retain existing alpha.

Dynamic expressions, repeated instances, ambiguous utilities and unsupported values stay read-only. An invalid custom value disables typography Apply. CSS may override the new source utility, or the result may be visually equivalent: the editor then reports **source saved, rendering unconfirmed** and keeps Undo available. A project font alias does not prove a downloaded face is available offline. The new hex control compares sRGB values; wide-gamut fidelity is not claimed.

## Spacing (Phase 3.4a)

Select a supported static element and open **Spacing · Base**. The nine controls are Padding All/Inline/Block, Margin All/Inline/Block, and Gap All/Columns/Rows. Inline and Block follow the page writing direction; they are logical axes, not fixed left/right or top/bottom labels.

Choose a project spacing preset or enter a finite custom pixel value with up to three decimal places. Padding and gap accept 0–2048px; negative values are margin-only, within −2048–2048px. Margin also accepts `auto`. Preset names use the project utility scale. An absent Base utility is shown as unset, not as zero. Source settings and the last observed rendered values are shown separately. Editing a field only changes the draft; blur does not write source.

Use **Preview spacing patch** to review the exact source diff, then **Apply spacing** to save through the existing hash, history, and preview-refresh path. When splitting a shorthand, its companion value is retained: changing Inline padding on `p-6` to `px-8` produces `px-8 py-6`; changing Row gap on `gap-6` to `gap-y-[12px]` produces `gap-x-6 gap-y-[12px]`. Valid typography and spacing drafts can be previewed and applied in the same source patch.

Known unequal axes are shown as Mixed; choosing an explicit All value replaces those axes together. Conflicting or overlapping utilities, physical/logical edge conflicts, important or variable utilities, and arbitrary CSS spacing properties are unsupported for the affected group; the editor does not normalize them. If a gap utility is inactive for the element display, or a responsive rule wins at the current viewport, source may be saved while rendering remains unconfirmed. Undo stays available. Responsive/state classes remain in source and are not edited by this Base control.

Spacing uses the existing project grant and source-save flow; it adds no native permission, filesystem access, or cloud requirement. This is Slice 3.4a only. Layout/sizing controls remain follow-up slice 3.4c; breakpoint tools remain later work.

## Appearance (Phase 3.4b)

Select a supported static element and open **Appearance · Base**. The two controls are background colour (project presets plus explicit sRGB hex) and one uniform corner radius (project presets plus explicit px). Source settings and last observed rendered values stay separate. A missing Base utility is shown as unset, not as black or zero. Images, gradients, hover/focus variants and per-corner radii are preserved and not rewritten.

Use **Preview appearance patch** to review the exact source diff, then **Apply appearance** to save through the existing hash, history, and preview-refresh path. Colour edits retain an existing slash or hex alpha when only the colour changes. Mixed corners, unknown background tokens, important or variable utilities, and arbitrary CSS properties refuse the affected group. If a background image or gradient covers the colour, or another CSS rule wins, source may be saved while rendering remains unconfirmed. Undo stays available.

Appearance uses the existing project grant and source-save flow. This is Slice 3.4b only. Flex/grid/layout/sizing remain 3.4c.

## Offline boundary

Manual launch/open/preview/edit/save/quit/reopen/recovery was exercised with browser external HTTP blocked and OS egress denied for the preview child, retaining loopback and Chromium's Mac sandbox. The host's network settings were not changed. No Clerk/Railway or model-provider request is needed by the editor. BYOK model requests require network access and are not made by Phase 2.

The user's project may have its own remote assets or services. The sample's Google fonts fell back during offline development preview. An additional offline production `next build` failed on those remote fonts; a production build with networking succeeded. The app does not rewrite typography or strip a project's own network requirements.

## Reproduce the evidence

```sh
bun run build:desktop
bun run test:desktop
bun run test:local
node scripts/e2e/local-workflow.e2e.mjs apps/desktop/dist/mac-arm64/allstudio.app/Contents/MacOS/allstudio --offline
```

The connected harness controls native-dialog answers to choose a fresh disposable fixture/profile, then uses real Electron, UI selection/Apply, native filesystem operations, preview compilation, process termination and recovery. It does not mock source writes. Ignored `dist/local-workflow-*` folders contain screenshots, traces, requested origins and build evidence. `ALLSTUDIO_FIXTURE` can select either additional repository fixture. The offline harness is Mac-specific; Linux CI runs normal development and packaged checks under xvfb with its separately documented `--no-sandbox` limitation.

Native directory handles prevent path redirection; expected-byte checks and journals handle ordinary conflicts/uncertainty. They are not kernel-atomic compare-and-swap against an arbitrary same-UID writer, or an OS sandbox for explicitly permitted project Node code. Physical power-loss, other OS/architectures and public release hardening remain unclaimed.
