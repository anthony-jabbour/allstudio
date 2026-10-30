# Slice 3.4a executed review evidence

Captured2026-10-29Pacific from disposable public fixtures using the shared inspector, real Next.js previews and native/packaged Electron. See ../../PHASE-03.md for exact commands, execution failures/corrections, complete trace paths and remaining gates. TSX snapshots are stored as .txt rather than executable application source.

- spacing.png / source-before.tsx.txt / source-after.tsx.txt / measured.json: Harbor inline padding24→32px, child moves8px, original block/breakpoint values retained. These are instrumented browser test copies.
- all-padding-overridden.tsx.txt: source All padding edit retained the lg override and was explicitly unconfirmed.
- spacing-dark-narrow.png: real keyboard focus, collapse/draft preservation and dark narrow window.
- offline-spacing.png and offline-spacing-*.tsx.txt: native uninstrumented source/diff and all four observed padding sides.
- offline-spacing-reopened.png / offline-spacing-reopened.tsx.txt: actual preview/source after full packaged offline quit/reopen (36px font,16px padding). Screenshot is before a new selection; assertions verify actual computed values and exact persisted bytes.
- final command logs record observed checks, not founder phase approval. The existing harness labels its unavailable subframe injection probe PASS; that line does not prove a subframe IPC denial. Offline production build remains NOT RUN in that harness because of historical next/font/google requirements. The final online edited-project build is separate.

No private cloud files, real user project or credentials are included. Human usability and assistive-technology validation remain pending.
