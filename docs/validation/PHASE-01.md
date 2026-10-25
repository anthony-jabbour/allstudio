# Phase 01 — Validation report

**Status:** IN PROGRESS  
**Slices:** (1) source mapper in `@allstudio/editor`; (2) browser preview → select → text edit → JSX write → live refresh; (3) three fixtures, heading/button/layout, text + className edits, format-preserving writes (below)  
**Founder decision:** ADR-0002 option A (2026-10-24)  
**This report does not mark the phase PASS.**

## Slice 3 — Three fixtures, text + class edits, format-preserving writes (2026-10-25)

**Branch:** `claude/fervent-tesla-7bsghy` (restarted from `main` @ `c178a2a`)  
**Status:** READY FOR HUMAN VALIDATION. Not PASS. Phase 0 is not PASS either.

### User-observable outcome

`bun install && ALLSTUDIO_RESET_WORKSPACE=1 bun run dev` → open
<http://localhost:5173>. A **Fixture** picker switches between three running
Next.js projects (each a git-ignored copy with its own `next dev`):

| Fixture | `examples/` dir | Preview | What it exercises |
|---|---|---|---|
| Aurora Atelier | `nextjs-site-fixture` | :3101 | landing page (unchanged from slice 2) |
| Lumen Notes | `nested-components-fixture` | :3102 | components across files, a component reused twice (`NavLink`), a `.map()` list (`NoteCard`), a ternary, a `&&` conditional, expression text |
| Harbor Studio | `tailwind-variants-fixture` | :3103 | `sm:`/`md:`/`lg:`, `hover:`/`focus-visible:`, `dark:` variants, a `cn()` helper, a template-literal `className`, `components/` + `lib/` |

Click a heading, a button, or a layout element: the panel shows the real
source file and line range (for a nested component, its own file, e.g.
`src/components/new-note-button.tsx:3–9 in NewNoteButton`). Two controls:
**Text** (Preview text patch / Apply text) and **Classes** (Preview class
patch / Apply classes). Apply writes the JSX file; Next.js hot reload updates
the preview; the editor confirms the preview shows the new text or classes.

### What changed

| Area | Change |
|---|---|
| Source mapper | New `splice.ts`: edits replace only the bytes of the edited node, located by the Babel AST. `editElementText` (splices one text child, string-literal child, empty or self-closing element; keeps the indentation of multi-line text), `editElementClassName` (replaces the whole static string, keeps the quote style, empty removes the attribute), `instrumentSource(content, { preserveFormatting: true })` (inserts `data-oid` after the last attribute and changes nothing else). `describeElement` now also returns the static `className` (`readClassName`). |
| Fail-closed fallback | Text shapes that cannot be spliced (JSX comments mixed with text, several text parts) fall back to `previewPatch`; if the regenerated file differs anywhere outside the element, the edit is refused with `unconfined-patch`. Class edits never regenerate. |
| Workspace contract | `SourceEditWorkspace` gains `previewClassEdit` / `applyClassEdit` (`ClassEditRequest`); `SourceElementInfo` gains `className`. |
| Dev adapter | `DevWorkspace` shares one path for text and class edits: path confinement → sha256 precondition → semantic no-op → splice → validation (parses, oid resolves once, value matches, no `data-oid` lost) → per-file serialized write with a second hash check → temp file + rename. |
| HTTP API | Routes are per fixture: `/__allstudio/workspace/<fixture>/{locate,preview-text,apply-text,preview-class,apply-class}`; class bodies have exact keys and ≤ 1000 chars; unknown fixture, action, or extra path segment → 400. |
| Workspace preparation | Instruments every `src/**/*.tsx|jsx` (pages and components) with the format-preserving inserter. The copy differs from `examples/` only by ` data-oid="…"` attributes (tested per file). |
| Preview bridge | Snapshot carries the rendered `class` attribute (≤ 2000 chars, validated) so class edits can be confirmed in the preview. |
| UI | `EditorShell` gets the Classes field and its two buttons and a per-field note explaining why a field is disabled. The playground adds a fixture picker. |

### Formatting preservation (slice 2 limitation addressed)

Slice 2 regenerated the whole file with Babel `retainLines`. The new text
landed on the opening-tag line, and the old text lines became blank lines.
The workspace copy was also reformatted when it was instrumented. Now:

```diff
--- a/src/components/new-note-button.tsx
+++ b/src/components/new-note-button.tsx
@@ -6,5 +6,5 @@
       className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white" data-oid=":d:821u"
     >
-      New note
+      Write a note
     </button>
   );
```

```diff
--- a/src/app/page.tsx
+++ b/src/app/page.tsx
@@ -9,5 +9,5 @@
       <section
         id="hero"
-        className="mx-auto grid max-w-5xl gap-8 px-6 py-20 md:grid-cols-2 md:items-center lg:py-28" data-oid="5uq-ji-"
+        className="mx-auto grid max-w-5xl gap-8 px-6 py-20 md:grid-cols-3 md:items-center lg:py-28" data-oid="5uq-ji-"
       >
         <div className="flex flex-col gap-6" data-oid="lg:jp5f">
```

In the E2E run every one of the 10 Apply operations changed exactly one line
of the file, and that line was inside the selected element's range. This is
byte splicing, not Prettier: no formatter dependency was added, and nothing
is reformatted.

Remaining transformations:
- The only change to a workspace copy at preparation time is the inserted
  ` data-oid="…"` attributes. They stay in the source while editing
  (ADR-0002); stripping them on export is still open.
- A text edit whose element mixes JSX comments with text, or has several
  static text parts, is refused (`unconfined-patch`) unless Babel
  regeneration happens to stay inside the element.
- Text containing `< > { } &`, or with leading or trailing spaces, is written
  as `{"…"}`.

### Commands executed (2026-10-25, Linux container, Bun 1.4.4, Node 22.22.0)

| Command | Exit | Observed |
|---|---|---|
| `bun install` | 0 | `bun.lock` gains only the two new workspace entries; `Checked 152 installs across 257 packages (no changes)`, no new external packages |
| `bun run test` | 0 | Vitest 3.2.7 — 9 files, **187 passed** (source-edit 42, fixtures 33, dev-workspace 29, workspace-api 29, source-mapper 24, preview-bridge 20, manifest 5, editor-shell 3, public-boundary 2) |
| `bun run typecheck` | 0 | project, editor, playground, and the 3 fixtures `Exited with code 0` |
| `bun run lint` | 0 | `Checked 81 files … No fixes applied.` |
| `bun run validate:public-boundary` | 0 | `Public boundary check passed (132 files scanned).` (count includes git-ignored `next-env.d.ts` files generated by `next dev`/`next build`) |
| `bun run build` | 0 | playground (JS 236.51 kB) + `next build` of all 3 fixtures |
| `ALLSTUDIO_RESET_WORKSPACE=1 bun run dev` + `node scripts/e2e/text-edit.e2e.mjs <out>` | 0 | Playwright/Chromium, **32 checks passed** (31 on two earlier fresh runs before the draft-preservation check was added), dev-server log had 0 errors/warnings; `trace.zip`, 5 screenshots, and 10 per-edit `.diff` files captured |

### Browser evidence (32 checks)

```text
PASS select heading resolves JSX source — src/app/page.tsx:7–12
PASS patch preview shows diff without writing
PASS apply writes JSX file and preview updates — … (preview refreshed 842 ms after Apply)
PASS no-op edit does not rewrite the file
PASS old draft is cleared while a new selection is looked up
PASS external change since selection reports a conflict
PASS dynamic {children} element is refused
PASS DOM oid missing from source is refused
PASS ambiguous rendered oid is refused
PASS forged preview messages are rejected
PASS workspace API rejects unauthorized paths, tokens and the preview origin
PASS aurora-button-text — src/app/page.tsx:18–23; lines changed 22; preview 843 ms
PASS applying one field keeps the other field's unsaved draft
PASS aurora-heading-classes — src/app/page.tsx:7–12; lines changed 9; preview 858 ms
PASS new Tailwind class is compiled and rendered — lab(2.51107 0.242703 -0.886115) → lab(44.4871 -41.0396 11.0361)
PASS aurora-layout-classes — src/app/page.tsx:3–24; lines changed 3; preview 859 ms
PASS examples/ fixture file is unchanged
PASS lumen-heading-text — src/app/page.tsx:12–17; lines changed 16; preview 869 ms
PASS lumen-nested-button-text — src/components/new-note-button.tsx:3–9; lines changed 8; preview 399 ms
PASS lumen-layout-classes — src/app/page.tsx:11–36; lines changed 11; preview 343 ms
PASS lumen-ternary-branch-text — src/app/page.tsx:25–30; lines changed 29; preview 355 ms
PASS ternary condition and other branch are preserved
PASS reused component (NavLink) is refused — renders 2 times
PASS .map() list item is refused — renders 3 times
PASS expression text is refused — {notes.length} notes in this workspace
PASS harbor-heading-text — src/app/page.tsx:14–19; lines changed 18; preview 1376 ms
PASS harbor-variant-classes — src/app/page.tsx:24–30; lines changed 27; preview 841 ms
PASS harbor-layout-responsive-classes — src/app/page.tsx:9–50; lines changed 11; preview 856 ms
PASS responsive variant edit changes the rendered grid — 2 → 3 columns
PASS template-literal className is refused, its static text stays editable
PASS footer text with {year} is refused
PASS no file under examples/ changed
32 checks passed.
```

The trace and screenshots are not committed (binary, about 3 MB). Rerun the
script against fresh workspaces to regenerate them. It is not idempotent on
an already-edited workspace (it asserts the original classes).

### Dynamic and conditional markup

| Markup | Behavior | Evidence |
|---|---|---|
| Ternary branch `{isSynced ? (<span>Synced</span>) : (<span>Offline</span>)}` | text edit of the static branch **preserves semantics**; condition and other branch byte-identical | unit + fixtures + E2E |
| `{visible && (<p>…</p>)}` | text edit **preserves semantics**; condition kept | unit + fixtures |
| `{notes.length} notes…`, `© {year} Harbor Studio`, `{children}`, `{note.title}` | refused: `unsupported-dynamic-children` | unit + fixtures + E2E |
| `.map()` item, component rendered twice | refused in the editor before any request (`renders N times`) | E2E |
| `className={cn(…)}`, template-literal `className`, spread after/without `className` | refused: `unsupported-className-expression`; static text of the same element stays editable | unit + fixtures + E2E |
| Class value with `" ' { } < > \` or a line break | refused: `unsupported-className-value` | unit |

Every refusal is checked to leave the file content and mtime unchanged.

### Negative / security / regression

All slice 2 checks still pass (no-op, stale hash, `oid-ambiguous`,
`oid-not-found`, path escapes including symlinks, token/Origin/Sec-Fetch-Site
guards, forged preview messages, selection race, concurrent applies). New in
this slice:
- class no-op does not rewrite the file;
- a class edit made with a hash taken before a text edit reports `stale-file`;
- unknown fixture id, unknown action, and extra path segments return 400;
- the editor page learns only fixture id, name, and preview URL (no
  filesystem paths);
- `examples/` is unchanged after the full E2E run (sha256 of every file).

### OSS / reuse

No new packages. The two fixtures reuse the existing dependency versions
(`next` 16.4.3, `react` 19.3.0, Tailwind 4). Splicing uses the Babel parser
already in the source mapper. Prettier or a recast-style printer would be a
new dependency and was not evaluated for adoption; the splice approach made
one unnecessary for this slice.

### REA

Not applicable. No reference product was observed.

### Choices made in this slice (open to founder override)

- **Classes field = full replacement of the static `className` string** (what
  you see is exactly what is written; empty removes the attribute). The
  alternative is Onlook's merge semantics (`tailwind-merge` of added classes),
  which cannot remove a class. `previewPatch` still has the merge path.
- **Fixture picker** in the playground (developer harness only), with all
  three previews started together. This uses about three Next.js dev
  processes of memory.

### Founder decisions still open

```text
BLOCKED — FOUNDER DECISION (does not block this slice)
Decision needed: add Playwright as a devDependency and a CI E2E job (A), or keep the E2E manual (B)?
Why it matters: the 32 browser checks run only when someone runs the script.
Recommendation: A. microsoft/playwright is Apache-2.0; its star count was not re-verified in this session and must be recorded before adoption.
Blocked work: CI E2E job. Playwright was not added.
```

```text
Decision needed: select vs interact toggle in the preview.
Current: always-select, unchanged in this slice as instructed.
```

### Phase 1 gate status after this slice

| Gate test (RoadMap.md Phase 1) | Status |
|---|---|
| At least three representative runnable fixtures | 3 fixtures; dev, typecheck and `next build` pass for each |
| Select heading/button/layout; expected file and lines change; preview reflects it | E2E for all three element types in all three fixtures |
| Dynamic/conditional markup preserved or clearly refused without corruption | see table above |
| No-op, hash conflicts, edits affecting unrelated nodes | unit + E2E (one changed line per edit, inside the element) |
| Independent source diff review + recording/trace of one interaction | trace captured; independent review **pending** (Greptile requested on the PR); founder validation **pending** |

Recommendation: **READY FOR HUMAN VALIDATION**. The phase is not PASS until the founder approves it.

---

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
  `stale-file` (HTTP 409). Applies to the same file are serialized and the
  hash is checked inside that section, so two concurrent applies cannot both
  win; it is checked again just before the rename for outside edits.
- **UI selection race:** a new selection clears the previous source and draft
  immediately (editing is disabled until its lookup returns), and edit
  responses for an older selection are ignored.
- **Patch validation:** the generated file must parse, the oid must resolve to
  exactly one element whose static text equals the request, and the multiset of
  JSX `data-oid` attributes (read from the AST, not a text scan) must be unchanged. Otherwise `invalid-patch`, nothing written.
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
| `bun run test` | 0 | Vitest 3.2.7 — 7 files, **101 passed** (source-mapper 24, preview-bridge 19, editor-shell 3, dev-workspace 29, workspace-api 19, manifest 5, public-boundary 2) |
| `bun run typecheck` | 0 | project, editor, playground, fixture `Exited with code 0` |
| `bun run lint` | 0 | `Checked 56 files … No fixes applied.` |
| `bun run validate:public-boundary` | 0 | `Public boundary check passed (99 files scanned).` |
| `bun run build` | 0 | playground JS 234 kB (was 3,550 kB: Babel no longer ships to the browser); fixture Next.js 16.4.3 static build |
| `bun run dev` + `node scripts/e2e/text-edit.e2e.mjs <out>` | 0 | Playwright/Chromium, **12 checks passed**, `trace.zip` + screenshots captured |

### Browser workflow evidence (Playwright, real servers)

`scripts/e2e/text-edit.e2e.mjs` against `bun run dev` (fresh workspace via
`ALLSTUDIO_RESET_WORKSPACE=1`):

```text
PASS select heading resolves JSX source — src/app/page.tsx:7–12
PASS patch preview shows diff without writing
PASS apply writes JSX file and preview updates — … (preview refreshed 844 ms after Apply)
PASS no-op edit does not rewrite the file
PASS old draft is cleared while a new selection is looked up
PASS external change since selection reports a conflict
PASS dynamic {children} element is refused
PASS DOM oid missing from source is refused
PASS ambiguous rendered oid is refused
PASS forged preview messages are rejected
PASS workspace API rejects unauthorized paths, tokens and the preview origin
PASS examples/ fixture file is unchanged
12 checks passed.
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
| Two concurrent applies on one file | unit | first writes, second `stale-file`; no lost update |
| New selection while the previous draft is still in the field | E2E (lookup delayed 1.5 s) | field cleared and disabled until the new lookup returns |
| Text containing `data-oid="…"` | unit | saved (not mistaken for an attribute) |

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
