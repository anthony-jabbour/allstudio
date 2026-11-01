# Slice3.7 — bounded local asset association

Founder approved metadata list plus Use asset for static img/verified next/image and preapproved remaining Phase3 choices. Execute inline/TDD with one independent review, same checkout `feat/phase-03-assets` on reorderPR24 fd535ca. No dependency, engine, grant, binary asset reads, upload/import, thumbnail or asset CSP expansion. PaperHome/FigmaStudio visual finishing follows as its own focused slice.

## Concrete contract and reuse

Reuse existing Babel parser, OID/source resolution, exact string-literal splicing, typed workspace adapters, expected hashes, atomic save/history/recovery and preview tracking. Onlook pin423e2e9 image manager remains MobX/sandbox-coupled (approved prior research,Apache2,observed27042stars); no new OSS tool adopted. REA not used.

Asset metadata: fixed public/ only; svg/png/jpg/jpeg/webp/gif/avif. Maximum500 listed files,10000 visited entries,32 directory depth,1024-byte path,2048-character encoded URL. Every listed file must be regular, single-link and no-follow under the pinned project descriptor. Missing public/ returns an empty list. List size metadata without reading image bytes; empty/over10MiB files remain visible but cannot be associated. Reject unsafe names/paths/links, malformed framing and unsafe numeric sizes. Main/API never accept an arbitrary listing root.

Image transform: resolve one unique source element. Plain img or a lexical binding to a default import from next/image (aliases supported; shadow/fake imports refused). Existing quoted src and quoted alt (including decorative empty alt) required. Refuse duplicate attrs, all spreads, srcSet/srcset; custom next/image loader/overrideSrc and unsupported dimension configuration. Retain all unrelated bytes and the original quote. Existing literal src may be replaced by a validated project-owned URL; no remote asset may be chosen. Missing/dynamic alt is explained, never invented.

Write request: source path/OID/hash plus public asset path only. Re-list current metadata before preview/apply, derive the URL in the adapter, validate the exact src readback, then reuse existing persistence/history. No generic attribute API.

Strict protocolv9 image observation: currentSrc, complete, naturalWidth/naturalHeight (bounded) or null. Confirmation requires a loaded image with positive dimensions and exact selected local URL at the approved preview origin; Next optimizer URLs require one bounded decode of the local url parameter, never suffix matching. Failed/hidden/unmatched images stay saved-but-unconfirmed with Undo available.

UI: metadata Assets section, refresh, selected file, Preview asset patch and Use asset. No thumbnail/image loads in privileged shell. Disable association for unsupported/repeated elements and explain why. Draft guards, save feedback, source diff and history remain shared.

## Tasks

- [ ] RED pure path/URL/metadata limit tests and static image binding/source-diff/refusal tests. Implement pure assets.ts and narrow mapper image transform.
- [ ] RED native metadata-only public listing tests (no-follow/hardlinks/limits/missing directory/no binary read/no asset write), then both workspace adapters and strict API/IPC/request tests. Reuse safe source writes and history.
- [ ] RED v9 image schema/URL confirmation tests and real browser association. Add bounded client observation and shared Assets inspector; verify img and next/image, optimizer URL, actual source diff, render and unsupported/stale refusal.
- [ ] Extend a real fixture with an asset-gallery route and original tiny test image; update discovery expectations honestly. Keep existing root-page source locations unchanged.
- [ ] Serial browser regressions and native img/Next association, exact source, undo/redo and full restart; packaged offline and security proof. One app/harness at a time; no environment-blocked result called PASS.
- [ ] Fresh independent review, Important fixes RED→GREEN, PHASE03 actual evidence and user guide; commit/push focused draft on reorder. Then mandatory visual/interaction finishing (including known stale cancel route dialog and viewport overflow), no phase PASS.
