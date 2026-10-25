# apps/playground/dev — development workspace adapter

Development-only. Not the Electron filesystem adapter (Phase 2), and never shipped by `vite build`.

Invariants (tests: `apps/playground/tests/`):

- Writes go only to `src/**/*.tsx|jsx` in the canonical workspace root. Reject `..`, absolute, backslash, NUL, and any symlink. Do not add create/delete/list-arbitrary-file endpoints.
- Every write needs the selection-time sha256. Re-check it before the rename. Write via temp file + rename.
- Validate generated source before writing: it parses, the oid resolves once, the text matches, and no `data-oid` is lost.
- API requests: POST, exact editor `Origin`, session token header, JSON, exact-key bodies. Keep Vite `server.cors: false`.
- The preview process gets a fixed argv and a scrubbed env. Never pass editor env/secrets or request data to it.
- Never write into `examples/`; the fixture is copied into `.workspace/` first.
