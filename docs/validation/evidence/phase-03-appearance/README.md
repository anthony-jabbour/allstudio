# Slice 3.4b executed review evidence

Captured 2026-10-29 Pacific from disposable public fixtures using the shared inspector, real Next.js previews and native/packaged Electron. See ../../PHASE-03.md for exact commands, execution failures/corrections, complete trace paths and remaining gates. TSX snapshots are stored as .txt rather than executable application source.

- appearance.png / source-before.tsx.txt / source-after.tsx.txt: Harbor `#harbor-cta` Base colour `bg-sky-600`→`bg-[#112233]`, `hover:bg-sky-500` and focus-visible bytes retained. These are instrumented browser test copies; radius 12px is applied in a later check in the same harness.
- overridden-unconfirmed.png: CSS `!important` override kept the source colour edit and correctly withheld visual confirmation.
- appearance-dark-narrow.png: real keyboard focus, collapse/draft preservation and dark narrow window.
- native-appearance.png and native-appearance-*.tsx.txt: uninstrumented Aurora button `rounded-full bg-zinc-950`→`rounded-[12px] bg-[#112233]`, observed `rgb(17, 34, 51)` / `12px`.
- native-appearance-reopened.png / native-appearance-reopened.tsx.txt: exact source and computed colour/radius after full Electron quit/reopen (also retains heading `text-[36px] p-[16px]` from earlier 3.3/3.4a proofs in the same session).
- offline-appearance.png and offline-appearance-*.tsx.txt: packaged restricted-network equivalents, including quit/reopen.

No private cloud files, real user project or credentials are included. Human usability and assistive-technology validation remain pending. Layout/sizing 3.4c is not claimed.
