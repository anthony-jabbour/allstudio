# Phase 01 — Validation report

**Status:** IN PROGRESS  
**Slices:** (1) source mapper in `@allstudio/editor`; (2) browser preview → select → text edit → JSX write → live refresh (below)  
**Founder decision:** ADR-0002 option A (2026-10-24)  
**This report does not mark the phase PASS.**

## Slice 2 — First visual editing loop (2026-10-25)

**Branch:** `claude/fervent-tesla-7bsghy` (from `main` @ `7bbd292`)  
**Status:** READY FOR HUMAN VALIDATION. Not PASS.

### User-observable outcome

`bun run dev` → open <http://localhost:5173>. The playground shows the Next.js
fixture running in an iframe. Click the heading "Aurora Atelier": it is
outlined, the panel shows `<h1>`, its `data-oid`, and
`src/app/page.tsx:7–12 in Home`. Change the text, click **Preview patch** to
review the diff, then **Apply**. The JSX file on disk changes and the preview
shows the new heading through Next.js hot reload (observed 844 ms after Apply).

### How it works

| Step | Code |
|---|---|
| Copy `examples/nextjs-site-fixture` to git-ignored `apps/playground/.workspace/nextjs-site-fixture`, `instrumentSource` its `src/app/*.tsx`, add `src/instrumentation-client.ts` + bridge | `apps/playground/dev/prepare-workspace.ts` |
| Start `next dev --port 3101` in the copy (fixed argv, scrubbed env: `PATH`, `HOME`, `NODE_ENV`, `NEXT_TELEMETRY_DISABLED`) | `apps/playground/dev/vite-plugin.ts` (`apply: "serve"` only) |
| Bridge in the preview: click → nearest `[data-oid]` → `postMessage` to the fixed editor origin; reports rect/text of the tracked oid on scroll/resize/DOM mutation | `packages/editor/src/preview-bridge/client.ts` (self-contained, no imports) |
| Editor validates every message: origin, `event.source === iframe.contentWindow`, per-handshake nonce, strict shape and size limits | `packages/editor/src/preview-bridge/protocol.ts`, `shell/use-preview-bridge.ts` |
| Resolve oid → file/lines/component/static text; refuse missing or duplicated oids (per file and across files) | `describeElement` (new, source mapper) + `DevWorkspace.locate` |
| Preview/apply: path confinement → sha256 precondition → semantic no-op check → `previewPatch` → validate patch → re-check hash → temp file + rename | `apps/playground/dev/dev-workspace.ts` |
| HTTP surface `/__allstudio/workspace/{locate,preview-text,apply-text}` | `apps/playground/dev/workspace-api.ts` |
| UI: one preview, selection box, source path/lines, text field, Preview patch, Apply, status/error, diff | `packages/editor/src/shell/editor-shell.tsx` |

The editor UI only sees the runtime-neutral `SourceEditWorkspace` contract
(`packages/editor/src/site/source-edit-workspace.ts`). The HTTP dev adapter is
playground-only; Electron will implement the same contract over IPC in Phase 2.

### Security boundaries

- **Writes:** only `src/**/*.tsx|jsx` inside the canonical workspace root; no
  `..`, `.`, empty, absolute, drive-letter, backslash, or NUL segments. The real
  path must equal the lexical path, so any symlink (file or directory, pointing
  in or out) is rejected. The source scan never follows symlinks. Files over
  1 MB are rejected. No file creation or deletion API exists.
- **Concurrency:** every edit carries the sha256 from selection time; mismatch →
  `stale-file` (HTTP 409). The hash is checked again just before the rename.
- **Patch validation:** the generated file must parse, the oid must resolve to
  exactly one element whose static text equals the request, and the multiset of
  `data-oid`s must be unchanged. Otherwise `invalid-patch`, nothing written.
- **API guard:** POST only, `Origin` must equal `http://localhost:5173`,
  `Sec-Fetch-Site` (when sent) must be `same-origin`, JSON content type,
  per-start 256-bit session token in `x-allstudio-session` (timing-safe compare),
  16 KB body cap, exact-key body schema, text ≤ 500 chars.
- **Preview isolation:** different origin (`:3101`); iframe
  `sandbox="allow-scripts allow-same-origin allow-forms"` (no top navigation,
  no popups); Vite `server.cors: false`, so the preview cannot read the editor
  page or its token. A cross-origin call from the preview to the API is blocked
  by the browser (verified below).
- **Bridge:** accepts commands only from `window.parent` at the configured
  editor origin; posts only to that origin (never `"*"`); exposes no methods.

### Commands executed (2026-10-25, Linux container, Bun 1.4.4, Node 22.22.0)

| Command | Exit | Observed |
|---|---|---|
| `bun install --frozen-lockfile` | 0 | 143 packages; no dependency changes in this slice |
| `bun run test` | 0 | Vitest 3.2.7 — 7 files, **98 passed** (source-mapper 23, preview-bridge 19, editor-shell 3, dev-workspace 27, workspace-api 19, manifest 5, public-boundary 2) |
| `bun run typecheck` | 0 | project, editor, playground, fixture `Exited with code 0` |
| `bun run lint` | 0 | `Checked 56 files … No fixes applied.` |
| `bun run validate:public-boundary` | 0 | `Public boundary check passed (99 files scanned).` |
| `bun run build` | 0 | playground JS 234 kB (was 3,550 kB: Babel no longer ships to the browser); fixture Next.js 16.4.3 static build |
| `bun run dev` + `node scripts/e2e/text-edit.e2e.mjs <out>` | 0 | Playwright/Chromium, **11 checks passed**, `trace.zip` + screenshots captured |

### Browser workflow evidence (Playwright, real servers)

`scripts/e2e/text-edit.e2e.mjs` against `bun run dev` (fresh workspace via
`ALLSTUDIO_RESET_WORKSPACE=1`):

```text
PASS select heading resolves JSX source — src/app/page.tsx:7–12
PASS patch preview shows diff without writing
PASS apply writes JSX file and preview updates — … (preview refreshed 844 ms after Apply)
PASS no-op edit does not rewrite the file
PASS external change since selection reports a conflict
PASS dynamic {children} element is refused
PASS DOM oid missing from source is refused
PASS ambiguous rendered oid is refused
PASS forged preview messages are rejected
PASS workspace API rejects unauthorized paths, tokens and the preview origin
PASS examples/ fixture file is unchanged
11 checks passed.
```

Source diff written by the first Apply on a fresh workspace (from the editor's
diff panel; the oid is random per workspace):

```diff
--- a/src/app/page.tsx
+++ b/src/app/page.tsx
@@ -7,7 +7,7 @@
       <h1
         id="hero-heading"
-        className="max-w-xl text-5xl leading-tight font-semibold tracking-tight text-zinc-950" data-oid="c9n1acv">
-        
-        Aurora Atelier
+        className="max-w-xl text-5xl leading-tight font-semibold tracking-tight text-zinc-950" data-oid="c9n1acv">Aurora Atelier — edited 1792916026803
+
+
       </h1>
       <p className="max-w-xl text-lg leading-8 text-zinc-600" data-oid="jsa5u8n">
```

The E2E asserts that every byte before the heading's `id` attribute and from
`</h1>` onward is unchanged. The trace and screenshots are not committed
(2 MB binary); rerun the script to regenerate them.

### Negative cases

| Case | Where tested | Result |
|---|---|---|
| Dynamic expression (`<body>{children}</body>`) | unit + E2E | `unsupported-dynamic-children`; input disabled; file unchanged |
| Rendered oid absent from source | unit + E2E | `oid-not-found`; nothing written |
| Duplicate oid in one file / across files | unit | `oid-ambiguous` |
| Same oid rendered twice in the DOM (e.g. `.map()`) | E2E | refused before any request (`renders 2 times`) |
| File changed since selection | unit + E2E | `stale-file` / HTTP 409; external content kept |
| Invalid patch (broken JSX, or another oid lost) | unit (patcher test seam) | `invalid-patch`; file unchanged |
| Unauthorized path (`..`, absolute, backslash, non-`src`, non-JSX, symlinked file/dir) | unit + HTTP + E2E | `path-rejected` / 403; symlink target unchanged |
| Missing/wrong token, wrong Origin, cross-site fetch, GET, text/plain, extra keys, oversized body | HTTP | 403 / 400 |
| Preview origin calls the API or reads the editor page | E2E | blocked by the browser (no CORS) |
| Forged nonce from the preview frame | unit + E2E | rejected, shown as `rejected a preview message (stale-nonce)` |
| Messages from another origin/window, before handshake, malformed shapes | unit | rejected (`unexpected-origin`, `unexpected-source`, `not-connected`, `malformed`) |
| No-op edit | unit + E2E | `noop: true`; file mtime unchanged |

### Transformations and limitations (documented, not fixed)

- `instrumentSource` reformats the **workspace copy** once when it is created
  (moves `>` onto the last attribute line, adds `data-oid`, drops the final
  newline, adds `;` after `</main>)`). The fixture in `examples/` is untouched.
- A text edit regenerates through Babel `retainLines`: the new text joins the
  opening-tag line and the old text lines become blank lines (see diff). The
  rendered result is correct; formatting preservation remains open.
- Clicking selects the nearest ancestor with a `data-oid`. Clicks in the preview
  are swallowed while connected (there is no "interact" mode yet).
- Only static single-line text is editable. Style, structure, and multi-element
  edits are out of scope.
- The editor origin is fixed to `http://localhost:5173` (opening the playground
  via `127.0.0.1` will not connect). The preview port is fixed to `3101`.
- The E2E needs Playwright, which is **not** a repository dependency, so it is
  not in CI. See the decision below.
- The workspace persists across restarts (edits are kept) until deleted or
  `ALLSTUDIO_RESET_WORKSPACE=1` is set.

### OSS / reuse record

| Candidate | Finding | Decision |
|---|---|---|
| Onlook `apps/web/preload` (`anthony-jabbour/onlook-baseline` @ `423e2e9`, Apache-2.0) | Uses `penpal` RPC with `allowedOrigins: ['*']` (marked TODO), exposes ~40 DOM-mutation methods, depends on `penpal`, `lodash`, `css-tree`, `@onlook/models`; injects a `<Script>` by rewriting the user's `layout.tsx` | **Inspected, not copied.** Original minimal bridge written instead. No new dependency. |
| Next.js `instrumentation-client.ts` (already a fixture dependency, Next 16.4.3) | Runs client code before hydration from a new file | Used to load the bridge without rewriting fixture source |
| Existing source mapper (`instrumentSource`, `locateSource`, `previewPatch`) | Sufficient for the edit | Reused; added `describeElement`, `readNodeTextContent`, `createLineDiff` |

No new npm packages. No sandbox vendor.

### REA

Not applicable: no competitor behavior was referenced; the reference is Onlook's
public Apache-2.0 source.

### Decisions for the founder (not blocking this slice)

```text
Decision needed: add Playwright as a devDependency and run the E2E in CI?
Why it matters: the browser workflow is only checked when someone runs the script by hand.
What is known: microsoft/playwright is Apache-2.0 and far above the 1,000-star bar (star count not re-verified in this session).
Options: A add `playwright` + a CI job that starts `bun run dev` and runs the script / B keep it manual.
My recommendation: A, once the founder approves the dependency.
Blocked work: none in this slice.
```

```text
Decision needed: preview click behavior.
Options: A always-select (current; clicks never reach the page) / B a select/interact toggle.
My recommendation: keep A for Phase 1; decide B with the Phase 3 canvas design.
```

### Remaining Phase 1 gate criteria

- At least three representative fixtures (nested components, Tailwind variants, realistic structure).
- Button and layout element edits (this slice: heading text only) and style edits through the UI.
- Edits that affect unrelated nodes; dynamic/conditional markup beyond `{children}`.
- Formatting preservation for edited elements.
- Independent source-diff review and human validation of a recording/trace.

---

## Slice 1 — Source mapper

## User-observable outcome (this slice)

Call `@allstudio/editor` APIs on the Aurora Atelier fixture:

1. inject `data-oid`
2. resolve the `hero-heading` source location
3. preview a text + Tailwind class patch as a JSX string diff
4. refuse expression `className` edits without rewriting

Live canvas selection, preview refresh, and Electron are **not** in this slice.

## Founder approvals

- Phase 0 exit via documented CodeSandbox blocker + parser spike: **A**
- In-source `data-oid` during editing for Phase 1: default from ADR-0002

## Files changed

- `packages/editor/src/source-mapper/**`
- `packages/editor/src/index.ts` (re-exports)
- `packages/editor/tests/source-mapper.test.ts`
- `packages/editor/package.json` (Babel, tailwind-merge)
- `docs/provenance/README.md`
- `docs/decisions/ADR-0002-phase-0-exit.md`

## Tests run

Observed 2026-10-24 from `allstudio/`:

| Command | Result |
|---|---|
| `bun run test` | exit 0; Vitest 3.2.7; **15 passed** (6 new source-mapper tests) |
| `bun run typecheck` | exit 0 |
| `bun run lint` | exit 0 |
| `bun run validate:public-boundary` | exit 0; 83 files scanned |

Independent re-run on merged `main` `cf4bcd5` (2026-10-25, Claude Code): 20 tests passed (11 source-mapper), 81 files scanned, build exit 0. After the fail-closed text/oid fixes: **26 passed (17 source-mapper)**. See `docs/validation/PHASE-00-AUDIT.md`.

## Real-world proof

`packages/editor/tests/source-mapper.test.ts` reads `examples/nextjs-site-fixture/src/app/page.tsx` and asserts:

- heading `component === "Home"` at line 7
- generated text `Aurora Atelier — edited`
- `text-emerald-700` replaces `text-zinc-950`
- `clsx("px-3")` className edits return `unsupported-className-expression`
- text edits on `Hello {name}!`, `{name}`, or elements with nested children return `unsupported-dynamic-children` (previously returned `ok` and corrupted the source)
- multiline text returns `unsupported-multiline-text`; duplicate oids return `oid-ambiguous`
- invalid source returns `parse-failed`
- unknown oid returns `oid-not-found`

The fixture file on disk is not modified.

## OSS candidates

| Tool | URL | Stars (2026-10-25) | License | Role |
|---|---|---|---|---|
| Onlook parser | https://github.com/onlook-dev/onlook | 27,003 | Apache-2.0 | Adapted source |
| Babel | https://github.com/babel/babel | 44,048 | MIT | AST parse/generate (`@babel/standalone` already in Onlook) |
| tailwind-merge | https://github.com/dcastil/tailwind-merge | 5,696 | MIT | Class conflict merge (already in Onlook) |

## REA

Not applicable. Extraction from public Apache-2.0 source already inspected in Phase 0.

## Negative / security / regression

- Expression `className` is refused (Onlook would append call arguments).
- Public-boundary scan passed.
- Editor shell scaffold tests still pass.
- No Electron, no iframe, no CodeSandbox.

## Not done (Phase 1 remaining)

- Live preview / DOM selection
- Three representative fixtures
- Conditional/expression text: refusal implemented; semantic-preserving edits not implemented
- Formatting preservation / Prettier
- Hash conflict (`expectedSha256`)
- Insert/move/remove structure edits
- Independent review + human demo of a running editor

## Gate recommendation

**IN PROGRESS** — parser slice is test-backed. Phase 1 gate is not met. **Not PASS.**
