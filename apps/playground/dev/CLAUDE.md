# apps/playground/dev — development workspace adapter

Development-only. Not the Electron filesystem adapter (Phase 2), and never shipped by `vite build`.

Invariants (tests: `apps/playground/tests/`):

- Writes go only to `src/**/*.tsx|jsx` in the canonical workspace root. Reject `..`, absolute, backslash, NUL, and any symlink. Do not add create/delete/list-arbitrary-file endpoints.
- Every write needs the selection-time sha256. Re-check it before the rename. Write via temp file + rename.
- Text and class edits go through the same `DevWorkspace.edit` path. Validate generated source before writing: it parses, the oid resolves once, the text or className matches, and no `data-oid` is lost. Use the mapper's splicing edits (`editElementText`, `editElementClassName`); never write a regenerated file that changes bytes outside the element.
- API requests: POST to `/__allstudio/workspace/<fixture id>/<action>`, exact editor `Origin`, session token header, JSON, exact-key bodies. Keep Vite `server.cors: false`. The editor page learns fixture id, name and preview URL only, never filesystem paths.
- The preview process gets a fixed argv and a scrubbed env. Never pass editor env/secrets or request data to it.
- Never write into `examples/`; each fixture is copied into `.workspace/<id>` first, and the copy may differ from it only by inserted `data-oid` attributes.
