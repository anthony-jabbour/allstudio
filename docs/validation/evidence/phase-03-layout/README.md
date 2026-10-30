# Slice 3.4c executed review evidence

Captured 2026-10-30 Pacific from disposable public fixtures using the shared inspector, real Next.js previews and native/packaged Electron. See ../../PHASE-03.md for exact commands, execution failures/corrections, complete trace paths and remaining gates. TSX snapshots are stored as .txt rather than executable application source.

- layout.png / source-before.tsx.txt / source-after.tsx.txt / measured.json: Harbor `#hero` Base `grid-rows-2` (`238px` → `238px 238px`, height `462px` → `732px`) and unconstrained `w-[800px]` (`1024px` → `800px`), with `max-w-5xl` and `md:grid-cols-2 md:items-center lg:py-28` preserved byte-for-byte.
- constrained-unconfirmed.png: Harbor `#hero` `w-[1200px]` clamped by `max-w-5xl` at `1024px` displays the active min/max constraint note, retains `max-w-5xl` and `w-[1200px]` in source, and truthfully withholds visual confirmation.
- flex-before.tsx.txt / flex-after.tsx.txt / measured.json: Harbor CTA multi-child flex container (`flex flex-wrap gap-3`) updated with `flex-col justify-between items-start`; secondary button bounding box moves from `(x: 355.3125, y: 248)` beside the primary CTA `(x: 232, y: 248)` to `(x: 232, y: 304)` stacked vertically below it.
- layout-dark-narrow.png: real keyboard focus order, collapse/draft preservation and dark narrow window (`900×800`).
- native-layout.png and native-layout-*.tsx.txt: uninstrumented Aurora button `w-fit` → `w-[240px] ... flex justify-center`, observed `["240px", "flex", "center"]`.
- native-layout-reopened.png / native-layout-reopened.tsx.txt: exact source and computed layout/appearance/spacing/typography after full Electron quit/reopen (`w-[240px] rounded-[12px] bg-[#112233] ... flex justify-center` and heading `text-[36px] ... p-[16px]`).
- offline-layout.png and offline-layout-*.tsx.txt: packaged restricted-network equivalents, including quit/reopen.

No private cloud files, real user project or credentials are included. Human usability and assistive-technology validation remain pending.
