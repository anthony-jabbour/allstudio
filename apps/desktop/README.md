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
