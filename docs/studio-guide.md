# Studio: supported local website editing

Open an approved local Next.js/React project. Pages lists discovered static App Router routes; dynamic routes remain labelled unsupported. Layers represents rendered source elements. Canvas and Layers select the same source-backed element; repeated instances can be inspected but cannot be edited individually.

## Responsive preview and editing

Mobile390, Tablet768, Laptop1024 and Desktop1440 change the actual preview width and automatically choose Base, md, lg and xl respectively. A whole custom width from320 to2560px chooses the largest default breakpoint at or below that width. The Edit menu supports Base/sm/md/lg/xl/2xl and lets you override that choice. Width changes restore automatic selection. Zoom affects only the canvas; Fit,50%,75% and100% do not change source styling.

A property field shows the utility explicitly set at the selected scope and the last observed rendered value separately. An unset field does not establish where its rendered value came from. Set supported typography, spacing, background/radius or flex/grid/sizing properties, review the source diff, then Apply. Other breakpoint/state utilities stay intact. Clear override removes only that scoped property, retaining shorthand companions; it does not invent a fallback value. Base has no Clear override.

Changing width or edit scope with an unapplied/invalid design draft offers Discard design draft or Keep responsive editing. Text drafts are retained. Pending saves lock context switching. An edit at an inactive or overridden breakpoint can save correctly while rendering remains unconfirmed. The editor reports confirmation only after source readback and an observed property change.

Scoped property edits require a conservative audit of default Tailwind4 breakpoints, source stylesheet imports and recognized static build configuration. Unknown aliases, imports/loaders, custom breakpoints, PostCSS/Babel extensions and styles outside the supported src CSS subset disable scoped property writes. Base and manual class editing remain available through the existing safe pipeline; the raw class editor is in the collapsed Source classes disclosure. The audit returns eligibility only; previews receive no native filesystem access.

Apply persists project source immediately. Undo/Redo covers saved edits for the current session; reopening retains disk edits, not prior-session history. Stale hashes, external modifications and unsupported expressions refuse safely. Clear may leave surrounding class whitespace because unrelated bytes are preserved.

Phase3 remains in progress pending founder validation. Bounded adjacent-sibling rearrangement and existing-project image association are implemented and verified; unfamiliar-user task sessions and assistive-technology validation remain human gates.

## Home and canvas controls

Home lists remembered local website projects and can search by project name or path. Cards show the project name and folder label without rendering the absolute path. Open project chooses an approved local project; Reopen opens the most recent grant. Grid/list view and light/dark appearance persist on this computer. A preview card is a small JPEG capture of the current visible site page. It is kept in AllStudio's user-data directory (maximum 96 KiB per project) and does not change project source or add a project file. Only the first 24 recent projects send preview images to Home. A project without a capture shows a neutral instruction until its preview has loaded.

Select (V) keeps preview click-to-select active. While connected, the bridge suppresses mouse and keyboard click activation and link navigation so supported editor controls remain in charge of selection and routes. Hand (H) temporarily disables iframe pointer handling and pans the canvas by dragging. Escape clears a selection when no edit draft is awaiting confirmation. Fit is the initial canvas zoom; 50%, 75% and 100% are available. Zoom and canvas panning do not change the actual preview viewport width.

## Project image association

Assets lists image names, project paths, types and byte sizes under the granted project's `public/` directory. It supports SVG, PNG, JPEG, WebP, GIF and AVIF metadata, with at most 500 listed files. The Assets section does not load thumbnails in the trusted shell. Empty and files larger than 10 MiB remain visible but cannot be assigned.

Select one unique rendered `<img>` backed by a static source element, choose an existing usable asset, review the source diff and select Use asset. Default imports from `next/image`, including aliases, are supported when `src`, `alt` and dimensions are static literals (or `fill` is set). Missing/dynamic alt, spreads, `srcSet`, custom loader/override, reused instances and ambiguous targets are refused. Assignment replaces only the existing quoted `src`; it does not invent alt text. A loaded, visible image using the local asset must appear in the preview before the editor confirms the result. Session Undo/Redo and reopening preserve source edits.


## Supported layer arrangement

Select a layer in the current static App Router page. Move layer up/down and dragging the selected layer onto an eligible adjacent row preview the same operation. Review the exact source diff, then Apply layer move. Cancel or Escape discards the pending move without writing. Property/text edits are locked while the move preview is pending; viewport and route switches protect it.

The initial subset is deliberately narrow: literal/static JSX sibling chunks in the default page component's direct unconditional JSX return. Non-control-flow declarations may precede that return. Component definitions/call-site ownership across modules, conditional/loop/alias returns, mapped or dynamic descendants/attributes, spreads, comments or meaningful text between siblings, fragments, reused instances and cross-parent moves are refused. Keys, subtree bytes and inter-element whitespace stay intact.

After saving, actual unique DOM neighbors must reflect the new source order before confirmation. Visual geometry alone is not the order proof; CSS positioning/reverse order can affect appearance. Native session Undo/Redo restores source, and disk order persists after reopening.
