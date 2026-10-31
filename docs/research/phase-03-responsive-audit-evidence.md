# Responsive breakpoint audit evidence

Date: 2026-10-31. Slice 3.5 remains IN PROGRESS. No new dependency, editor engine or cloud service. The existing Onlook-derived Babel parser validates static module/config syntax; React/CSS transforms implement viewport scaling. The founder approved all remaining Phase 3 implementation decisions and the earlier bounded read-only metadata audit.

## Observed evidence

`docs/validation/evidence/phase-03-responsive/unused-breakpoint-probe.json` was generated with installed Tailwind 4.3.3: compiling only `block` produces identical CSS with md=48rem and md=900px. Preview CSS alone cannot establish unused breakpoint thresholds.

The adapters audit bounded project style metadata, source imports and fixed build-config names inside the existing project grant. CSS stays under src for reads. Styles elsewhere, unsupported style extensions, PostCSS configuration, custom breakpoints, unknown imports/aliases/loaders, dynamic module imports, inline style/link elements and unrecognized Next configuration fail closed for scoped property edits. Native source-module audit reads are readonly and bounded; no raw project CSS/source is returned by the capability endpoint. Every non-Base property preview/apply repeats the audit. JSX writes still use the existing expected-hash, AST splice, atomic save, history and recovery path.

Recognized build subset: static default-exported Next configuration with boolean agentRules/cacheComponents/partialPrefetching and the existing standard @tailwindcss/turbopack CSS loader. The native adapter verifies its own generated wrapper using existing integration logic and audits the original config. This deliberately excludes many valid projects; Base/manual edits remain available. This is not a general JavaScript behavior proof or an atomic multi-file snapshot. External edits after an audit remain a concurrency boundary; selected JSX hashes still guard source writes.

## Review and tests

A fresh independent static review found the initial CSS-only audit could accept an unused default stylesheet while the project imported custom CSS elsewhere. Added a missing-module RED test, then static import/config validation; root CSS and .postcssrc rejection were separately RED then GREEN. Repeated native scans exposed a shared-directory-offset issue; opening a fresh directory description fixed it. Full Vitest: 792 tests / 32 files passed. Typecheck passed all seven workspaces. No phase gate approval is claimed.

REA was not used. No external OSS tool was newly selected; the existing parser/provenance remains authoritative. These checks are an original conservative integration around existing approved components. Runtime browser/native evidence is recorded separately in PHASE-03.md as executed.
