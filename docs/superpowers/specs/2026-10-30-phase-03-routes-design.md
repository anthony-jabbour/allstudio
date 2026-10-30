# Phase 3.2b — static route discovery and preview navigation design

Status: APPROVED — authorized by existing founder decisions (`docs/superpowers/plans/2026-10-26-phase-03-workspace.md` line 28, `docs/research/phase-03-studio.md` lines 59 and 78–82, and locked visual decisions D1–D3). Drafted: 2026-10-30.
Base: `814f456` (`feat/phase-03-layout`, draft PR #21).
Branch: `feat/phase-03-routes`, stacked on `feat/phase-03-layout` in the active checkout; no merge/worktree/clone.

## Outcome and existing guarantees

A user sees discovered eligible static Next.js App Router pages in the `Pages` section of the left Studio navigator (above `Layers`, matching Figma's Pages stack density per D3) and can switch the existing live preview iframe between static routes. Navigating to another static route keeps the preview on the approved loopback origin, invalidates the previous route's active selection and layer snapshot generation, preserves session undo/redo history across routes, and leaves source files untouched until the user explicitly applies an edit on the selected route.

When the user has an unsaved inspector draft (`draft` text, `classDraft` utilities, invalid structured inspector input, or a pending preview diff) and clicks a different route, the navigator refuses to silently discard or save the draft. Instead, it presents an explicit inline confirmation (`Discard and switch` vs. `Keep editing`). Cancelling (`Keep editing`) retains the current route, iframe, active selection, and unsaved drafts. Unsupported dynamic, catch-all, parallel, intercepting, private, or colliding/ambiguous route files are visibly listed with an explicit unsupported reason rather than guessed or hidden.

No new third-party dependency, native C helper capability, OS/Electron permission grant, cloud code, or board document model is introduced.

## Approaches and recommendation

1. **Recommended: pure deterministic route discovery over existing bounded source file listings (`NativeFiles.list()` and `DevWorkspace.listSourceFiles()`) + validated route-selection contract.** Both Electron (`NativeFiles.list()` over pinned directory descriptor `fd 3` with `O_NOFOLLOW`) and Playground (`DevWorkspace.listSourceFiles()` with `lstat` no-symlink traversal) already enumerate relative `src/**/*.{tsx,jsx}` files within the granted project root. A pure helper in `packages/editor/src/site/routes.ts` classifies `src/app/**/page.{tsx,jsx}` into eligible static routes and unsupported routes, and validates route selection requests against current discovery and the pinned loopback preview origin.
2. **Extract Onlook `PagesManager` (`apps/web/client/src/components/store/editor/pages/index.ts` and `helper.ts`) wholesale:** rejected. Onlook's manager is coupled to MobX (`makeAutoObservable`), `EditorEngine`, remote sandbox file APIs, and AST metadata rewriting, and its `isNodeActive` helper matches dynamic `[segment]` routes permissively rather than failing closed.
3. **Allow freeform route path input or client-side history/router push injection inside the preview:** rejected. Freeform URL/path entry widens the navigation surface, and synthetic router pushes bypass main-process route allowlist validation. Updating the iframe `src` to the main/workspace-validated loopback URL exercises Electron's existing `will-frame-navigate` and `did-frame-finish-load` bridge re-injection path cleanly.

## Reuse and REA evidence

- **Onlook pin:** `423e2e924366419e418ee049093872d535eea41a` (27,042 stars observed 2026-10-29, Apache-2.0). Inspected `apps/web/client/src/components/store/editor/pages/index.ts` and `apps/web/client/src/components/store/editor/pages/helper.ts`. Consistent with `docs/research/phase-03-open-source-editor-audit.md` (line 46: *"No direct extraction: scan granted local routes in main, reject dynamic/ambiguous routes"*), we implement a clean pure helper over existing file listings.
- **New third-party dependencies:** None (0).
- **REA:** Not applicable / not performed. Next.js App Router file conventions and allstudio's Phase 3 route/security contracts define the exact target behavior.

## Exact behavior

### 1. Static App Router discovery (`discoverAppRouterRoutes`)

Given the sorted relative `src/**/*.{tsx,jsx}` file list from the workspace:

- Only files matching `^src/app/(?:(.+)/)?page\.(tsx|jsx)$` are considered route page candidates. Layout, template, loading, error, not-found, default, and API route files (`layout.tsx`, `loading.tsx`, `route.ts`, etc.) and files outside `src/app/` (`src/components/**`) are ignored.
- Path segments between `src/app/` and `page.{tsx,jsx}` are evaluated in order:
  - **Private folders (`_folder`):** Any segment starting with `_` is reported in `unsupported` with `reason: "private-route"`.
  - **Intercepting routes:** Any segment containing `(.)`, `(..)`, or `(...)` is reported in `unsupported` with `reason: "intercepting-route"`.
  - **Parallel routes (`@slot`):** Any segment starting with `@` is reported in `unsupported` with `reason: "parallel-route"`.
  - **Catch-all routes (`[...slug]`, `[[...slug]]`):** Any segment containing `[...` is reported in `unsupported` with `reason: "catch-all-route"`.
  - **Dynamic segment routes (`[slug]`):** Any segment containing `[` or `]` is reported in `unsupported` with `reason: "dynamic-route"`.
  - **Route groups (`(group)`):** Any segment matching `/^\([a-zA-Z0-9_-]+\)$/` is stripped from the URL path without adding a URL segment (e.g. `src/app/(marketing)/about/page.tsx` maps to `/about`; `src/app/(marketing)/page.tsx` maps to `/`).
  - **Static URL segments:** Every remaining segment must match `/^[a-zA-Z0-9._-]+$/` and must not be `.` or `..`; otherwise the candidate is reported in `unsupported` with `reason: "invalid-segment"`.
- **Ambiguous / duplicate routes fail closed:** If two or more static candidates resolve to the same normalized URL route (for example `src/app/page.tsx` and `src/app/(marketing)/page.tsx` both resolving to `/`, or `page.tsx` and `page.jsx` in the same folder, or two route groups resolving to `/pricing`), **all** colliding candidates are excluded from `routes` and reported in `unsupported` with `reason: "ambiguous-route"`.
- **Deterministic order:** Eligible `routes` sort `/` first, then lexicographically by `route`. `unsupported` entries sort lexicographically by `sourcePath`.

### 2. Hostile route validation and loopback origin pinning (`resolvePreviewRouteUrl`)

When the renderer or playground requests `selectRoute(routeInput)`:

- Workspace re-discovers routes from the current project files so a deleted or newly ambiguous route fails closed immediately.
- `validateRoutePath(routeInput)` rejects non-strings, empty strings, strings exceeding 256 characters, leading/trailing whitespace, strings not starting with `/`, trailing slashes (when `routeInput !== "/"`), `//`, `:`, `\`, `?`, `#`, `%`, control characters, and `.` or `..` segments with `reason: "invalid-request"`.
- If `routeInput` matches an entry in `snapshot.unsupported` (by `route`), fail closed with `reason: "route-unsupported"`.
- If `routeInput` does not match an entry in `snapshot.routes` (by exact `route`), fail closed with `reason: "route-not-found"`.
- Construct the target preview URL from the current project's `basePreviewUrl` (`new URL(matched.route, baseOrigin)`), verifying that `resolved.origin === base.origin`, `resolved.pathname === matched.route`, `resolved.search === ""`, and `resolved.hash === ""`.
- In Electron (`apps/desktop/src/main/projects.ts` and `index.ts`), `current.info.previewUrl` and `current.info.activeRoute` update to the validated route URL, while `will-frame-navigate` and `did-frame-finish-load` continue enforcing exact loopback origin equality and re-injecting `preview-bridge.js` into the preview subframe on load.

### 3. Navigator Pages UI, selection invalidation, and draft guard

- In `EditorShell` (`packages/editor/src/shell/editor-shell.tsx`), the `Pages` section in `.studio-navigator` renders:
  - Interactive route buttons for each discovered static route (`aria-current="page"` on the active route, displaying the route path and `sourcePath`).
  - Non-interactive rows for each `UnsupportedRoute`, displaying the route pattern, a concise badge (`Dynamic`, `Catch-all`, `Parallel`, `Intercepting`, `Private`, `Ambiguous`, or `Invalid`), and its explanation.
- **Draft guard:** `hasUnsavedDraft` is true whenever an element is located (`source !== null`) and any of the following hold:
  - `source.text.ok && draft !== source.text.text`
  - `source.className.ok && classDraft !== (source.className.value ?? "")`
  - `!typographyValid || !spacingValid || !appearanceValid || !layoutValid`
  - `pending !== null` (an unconfirmed preview diff is open)
- Clicking a different route while `hasUnsavedDraft` is true does **not** navigate or call `workspace.selectRoute`; it opens an inline confirmation prompt in the `Pages` section with `Discard and switch` and `Keep editing` buttons:
  - `Keep editing` clears the pending route target and preserves the active route, iframe, selection, and unsaved drafts.
  - `Discard and switch` proceeds with the route switch.
- **Selection and generation invalidation on switch:**
  - Increments `selection.current`, `request.current`, and `editRun.current` so any in-flight `locate`, `preview`, or `apply` responses from the prior route are ignored.
  - Clears `selected`, `source`, `draft`, `classDraft`, `diff`, `pending`, `pendingRouteSwitch`, and resets inspector validity flags.
  - Updates `currentPreviewUrl` to the validated `previewUrl` returned by `workspace.selectRoute(route)`, causing `usePreviewBridge` to issue a fresh nonce handshake and populate the new route's `layers` tree when the iframe loads.

## Verification and acceptance

1. Unit tests (`packages/editor/tests/routes.test.ts`): static route discovery, route group unwrapping, dynamic/catch-all/parallel/intercepting/private exclusion, ambiguous collision rejection, and hostile URL/traversal/query/hash/percent-encoding rejection.
2. Workspace & API tests (`apps/desktop/tests/local-workspace.test.ts`, `apps/playground/tests/dev-workspace.test.ts`, `apps/playground/tests/workspace-api.test.ts`): `discoverRoutes()` and `selectRoute()` positive, unsupported, stale/deleted, and hostile input checks.
3. Component tests (`packages/editor/tests/editor-shell.test.tsx`): Pages list rendering, active `aria-current="page"`, unsupported route badges, unsaved-draft inline confirmation (`Keep editing` vs. `Discard and switch`), and selection/draft reset on navigation.
4. Browser E2E (`scripts/e2e/routes.e2e.mjs`) + Electron security/workflow E2E (`scripts/e2e/desktop.e2e.mjs`, `scripts/e2e/local-workflow.e2e.mjs`): navigate between `/` and `/about` on Aurora, verify unsupported `/journal/[slug]` is visibly refused, verify `Keep editing` preserves drafts, verify `Discard and switch` navigates and resets selection, edit an element on `/about` with real disk persistence, and verify undo/redo across routes.
