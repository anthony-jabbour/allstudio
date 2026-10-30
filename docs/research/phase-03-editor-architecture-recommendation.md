# Phase 3 — editor architecture recommendation

Status: PROPOSED — READY FOR REVIEW; Phase 3 IN PROGRESS.
Public baseline: `d132d58ed70f2a38ea4af529144f5a051827aa36`. Observed 2026-10-27.

## Recommendation

Use **A with D's restraint**: extend the working Onlook-derived allstudio source mapper and original bridge; adapt small proven Onlook interactions only where they reduce code and preserve guarantees. Use native React/CSS controls and installed dependencies first. Penpot and FigCraft provide interaction/command references, not additional runtimes.

This continues approved architecture. It does not select a new canvas, state manager, Rust process, WASM engine or scene document. Architecture-affecting adoption still requires founder approval. The audit is [here](phase-03-open-source-editor-audit.md).

## Alternatives and trade-offs

| Criterion | A: Onlook-first extension | B: selective Penpot | C: FigCraft hybrid | D: focused libraries |
|---|---|---|---|---|
| Source correctness | Preserves tested TSX/hash pipeline; new actions need tests | No JSX advantage from native shape model | Scene edits have no automatic JSX correspondence | Controls still need existing mapper |
| Compatibility | React/TS; avoid full MobX engine | ClojureScript/Potok/Rumext adapters are costly | Rust/egui/document/render adapters are costly | React fits, iframe coordinate support varies |
| Performance | Browser layout/DOM; measure tree bounds/zoom | No established benefit for a real DOM page | CPU/WASM scene rendering duplicates browser work | Small targeted costs; measure installed bundle |
| Complexity / maintenance | Smallest delta; own narrow contracts | Low if reference-only; high if copying subsystems | High lifecycle/build/ABI/scene synchronization cost | Low only if dependency count stays bounded |
| Offline | Existing manual pipeline demonstrated | Possible but no integration proof | Possible, extra binaries/artifacts to ship | Possible with bundled dependencies |
| Package/build | No required new package | CLJS/WASM/app dependencies if embedded | Rust 1.95, native/WASM packaging if embedded | Each package adds review/update obligations |
| Licensing | Existing Apache + MIT notices | MPL file-level obligations for incorporated source | Dual license, per-file/assets/transitives review | Usually MIT candidates; verify actual artifact |
| Security | Preserve current trust boundaries | Larger frontend/state surface if embedded | New IPC/process or wasm/control surface | Avoid tools reaching preview DOM directly |
| Future boards | Separate Phase 4 adapter remains possible | Useful interaction reference | Potential future board study; format compatibility unproven | Compose only after board scope defined |
| Future agents | Same validated manual operations | Event commands are conceptual reference | Shared Session command path is useful reference | Same allstudio command functions |
| Duplication risk | Low if no full Engine imported | High if Penpot renderer/store imported | High: second document and renderer | Moderate: libraries can duplicate existing geometry/history |

Do not embed all three engines. There is no executed proof that doing so improves Phase 3. No upstream integration is claimed from baseline allstudio tests.

## Current lifecycle and module boundaries

1. Desktop preview loader instruments supported JSX/TSX in preview compilation, keeping user source free of preview OIDs.
2. `preview-bridge/client.ts` observes selection and DOM rectangles. `protocol.ts` validates origin, exact frame, version, nonce, identity and payload types/limits.
3. `use-preview-bridge.ts` tracks selection through ready/select/element messages and HMR. There is no tree or privileged write message.
4. `EditorShell` calls `SourceEditWorkspace.locate`, preserving source hash/location and clearing stale drafts on new selections. Repeated instances are refused.
5. `previewTextEdit` / `previewClassEdit` show source patches. Apply passes path/OID/expectedSha256 through the typed desktop preload. Browser playground implements the same port through its dev-only adapter.
6. `LocalWorkspace.edit` reads granted source, compares hash, validates static editability and parse/readback/OID invariants, strips preview-only IDs, computes confined diff and enforces size bounds.
7. Native expected-byte save, fsynced journal and session history persist source; external conflicts fail without overwriting. Preview observation and source relookup confirm the visible value. A preview timeout is a saved-but-unconfirmed state, not success.

| Location | Phase 3 responsibility | Forbidden dependency |
|---|---|---|
| `packages/editor/src/shell` | Shared toolbar/panels, layer UI, selection, viewport, property controls | Electron, Node fs/process, app main imports |
| `packages/editor/src/preview-bridge` | Bounded derived DOM snapshots/geometry and narrow selection requests | Native bridge, arbitrary file paths, source-write RPC |
| `packages/editor/src/source-mapper` | Static class transformations and later supported sibling splice | Scene store or silent dynamic-expression rewrites |
| `packages/editor/src/site` | Runtime-neutral editing requests/results; add functions only for real operations | Speculative cloud/agent registry |
| `apps/desktop/src/renderer` | Local Home/open/recent, host action wiring, shared theme preference | Direct filesystem access |
| `apps/desktop/src/{main,preload,shared}` | Existing grant/process/history; bounded route/asset APIs only after approval | Generic list/read/write/shell API exposed to preview |
| `apps/playground` | Same editor, disposable fixture adapter, browser integration evidence | Desktop-only editor fork |

Source files remain canonical. Tree nodes, computed bounds, selected instance and inspector values are transient derived views. Unknown/inherited values are distinct from source-set utilities. No token system may become a competing website stylesheet authority.

## Selection/layers and responsive invariants

Proposed bounded tree: snapshot version/generation, bounded node count/depth/strings, parent relationships, rendered-instance identity distinct from source OID, source-backed/unsupported flags. Validate cycles, duplicate IDs, invalid parents, oversize payloads and stale generations before rendering. Cap values must be chosen with fixture/performance evidence and recorded in Slice 3.2, not claimed approved here. HMR/route changes invalidate old instance IDs. Multiple rendered instances may be inspected, but cannot silently become instance-specific source writes.

Viewport widths are actual iframe CSS layout widths (390/768/1440), not just scaled images. Zoom transforms the iframe and overlay together or converts measured rects into a single defined coordinate space. Scroll/resize/HMR must invalidate geometry. Source breakpoint scope is separately selected; viewport width alone never changes class variant targets. Preserve hover/dark/arbitrary variants outside scope.

Static route discovery/navigation is a separate Slice 3.2b, not part of the layer-only bridge change. Main may expose a reviewed bounded route enumeration/selection API inside the existing grant, with strict discovered-identity validation and the approved preview-origin restriction; the preview receives no filesystem API. Dynamic/catch-all/intercepted/ambiguous routes are refused. Draft-discard/cancel is explicit before switching; cancellation preserves project/selection/drafts. See the route sub-slice in the implementation plan. This API is proposed, not implemented.

## Commands and future extension points

Use typed functions for the manual operations as they become real. Existing workspace locate/preview/apply functions already form most of the lifecycle. A typography control should map a supported value to an immutable class draft and use the same preview/apply path. Keyboard actions call the same native history functions, respecting input/textarea/contenteditable focus.

Onlook centralizes operations through engine actions; FigCraft has stable command specs dispatched across UI/CLI/MCP; Penpot groups event-driven changes into transactions. Learn the **single mutation path** principle. Do not build a generic command bus, plugin registry, MCP server or model interface in Phase 3. A future agent can call the same validated operations behind Phase 5 permissions. Future boards keep their own explicitly versioned canonical format and adapter; neither `.figcraft` compatibility nor JSX round-trip is assumed.

## Proof plans

These are executable plans, not passing evidence. No third-party source is copied yet.

### Proof 1 — viewport and selection geometry (candidate adaptation)

- Upstream: Onlook `apps/web/client/src/components/store/editor/overlay/utils.ts` (`adaptRectToCanvas`, offset concepts) and `frames/dimension.ts`. These are smaller and more relevant than importing CanvasManager with its tRPC persistence.
- Integration: `SourceElementEditor` preview wrapper + existing snapshot rects; shared CSS consumed by both hosts. Retain `usePreviewBridge`, nonce/origin/frame validation and iframe isolation.
- Rights: pinned Apache source, applicable notices, modified-file attribution and destination map before incorporation. No upstream icons/assets. If the existing wrapper transform achieves correctness with less code, use it and mark upstream reference-only.
- First failing behavior: on the real Aurora fixture, select hero at each viewport and 50/100/150 percent zoom; assert iframe innerWidth and overlay edges match DOM bounds within a stated CSS-pixel tolerance (proposed <=1 pixel). Include canvas scroll and in-frame scroll. Test existing unscaled geometry before changing it.
- Expected diff: shell JSX/state, shared CSS, existing shell/browser/Electron checks; no source-file rewrite from viewport changes; no IPC extension.
- Desktop/browser: launch same shared shell in Electron and playground; capture selected heading at widths/zooms; change text/classes and verify source diff/HMR/history afterward.
- Negative/security: invalid zoom/width input, frame reload, missing/duplicate target, rejected nonce/frame messages; project preview still lacks bridge/Node. Focus and keyboard checks for viewport controls.
- Success: correct real layout width, aligned overlay, no stale selectable target, earlier source-save workflow passes. Failure: alignment drifts, app becomes desktop-only, or privilege changes are needed. Reject extraction rather than introducing full engine.

### Proof 2 — one source-backed typography control (candidate adaptation)

- Upstream: Onlook `style/index.ts` action grouping and editor-bar text controls; already-installed allstudio class editing and Tailwind utilities. Adapt the narrow presentation/intent separation, not the engine singleton.
- Integration: shared inspector class draft → validated scoped utility transform → `previewClassEdit` / `applyClassEdit` → native journal/history → observed preview.
- Rights: Apache notices/provenance for actual copied files; no need for new UI dependency. Exact control extraction closure must be reviewed before copying. An original small native select is an acceptable lower-code result, documented as reference-only.
- First failing behavior: change Aurora hero static font-size utility through a labeled inspector control; assert exact minimal class/source diff, unrelated font weight/color/variants retained, rendered font size changes, no-op does not rewrite inode/mtime, undo/redo and reopen preserve expected bytes.
- Expected diff: one pure property-to-utility function/test, inspector control, integration assertions. No parser replacement. Start with known static utilities; unknown/inherited values display unknown rather than guessed pixel values. Arbitrary/conflicting slash syntax is refused unless a specific transform test proves it safe.
- Desktop/browser: same user operation in playground and actual Electron, source diff + screenshot + computed-style evidence; packaged offline reopen before claiming acceptance.
- Negative/security: dynamic className, duplicate rendered OID, stale hash, external file edit, invalid property value; preserve file and show error. Breakpoint variants outside selected scope unchanged.
- Success: one complete visual-to-source-to-preview-to-restart operation without new permissions/dependency. Failure: a field appears functional while only changing DOM, rewrites unrelated utilities, or unsupported styles are fabricated.

## Founder decisions

Recorded in this chat: screenshot-matching Paper-style layout/colors/typography; shared Home/Studio design; both light and dark modes. The founder clarified that a token-library download is not required: reproduce the pictured design direction. Use original CSS variables and controls, not competitor branding/assets. Exact values inferred from screenshots are approximations, not extracted Paper tokens.

The primary recommendation remains a proposal for review; no invasive integration/new engine is authorized by its existence. Later material decisions: precise structural eligibility/UX after a demonstrable transform; owned-asset scope/API and overwrite/import behavior before new permissions. Do not block shell/source-backed typography on unrelated future asset choices. Preview/script/config/history decisions approved in Phase 2 remain settled.

## Boundaries and next step

Proceed with the existing-editor Studio shell as the first implementation slice, after the design/plan review required by the invoked workflow. The proposed shell changes no persistence or security contract. The [dependency plan](phase-03-studio.md) and [design map](phase-03-design-reference-analysis.md) define the reviewable scope. Independent baseline tests do not count as independent review of an unimplemented integration.
