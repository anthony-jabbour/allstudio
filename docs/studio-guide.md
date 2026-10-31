# Studio: supported local website editing

Open an approved local Next.js/React project. Pages lists discovered static App Router routes; dynamic routes remain labelled unsupported. Layers represents rendered source elements. Canvas and Layers select the same source-backed element; repeated instances can be inspected but cannot be edited individually.

## Responsive preview and editing

Mobile390, Tablet768, Laptop1024 and Desktop1440 change the actual preview width and automatically choose Base, md, lg and xl respectively. A whole custom width from320 to2560px chooses the largest default breakpoint at or below that width. The Edit menu supports Base/sm/md/lg/xl/2xl and lets you override that choice. Width changes restore automatic selection. Zoom affects only the canvas; Fit,50%,75% and100% do not change source styling.

A property field shows the utility explicitly set at the selected scope and the last observed rendered value separately. An unset field does not establish where its rendered value came from. Set supported typography, spacing, background/radius or flex/grid/sizing properties, review the source diff, then Apply. Other breakpoint/state utilities stay intact. Clear override removes only that scoped property, retaining shorthand companions; it does not invent a fallback value. Base has no Clear override.

Changing width or edit scope with an unapplied/invalid design draft offers Discard design draft or Keep responsive editing. Text drafts are retained. Pending saves lock context switching. An edit at an inactive or overridden breakpoint can save correctly while rendering remains unconfirmed. The editor reports confirmation only after source readback and an observed property change.

Scoped property edits require a conservative audit of default Tailwind4 breakpoints, source stylesheet imports and recognized static build configuration. Unknown aliases, imports/loaders, custom breakpoints, PostCSS/Babel extensions and styles outside the supported src CSS subset disable scoped property writes. Base and manual Classes editing remain available through the existing safe pipeline. The audit returns eligibility only; previews receive no native filesystem access.

Apply persists project source immediately. Undo/Redo covers saved edits for the current session; reopening retains disk edits, not prior-session history. Stale hashes, external modifications and unsupported expressions refuse safely. Clear may leave surrounding class whitespace because unrelated bytes are preserved.

Phase3 remains in progress. Structural rearrangement and asset association are documented only after their implementation is verified. Human usability and assistive-technology validation remain a founder gate.
