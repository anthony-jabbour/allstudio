# Connected local workflow implementation plan

Goal: open a granted supported Next.js project, explicitly integrate its config, preview with the existing bridge, edit original uninstrumented files, recover interrupted saves and reopen offline in Electron.

Approved: D1–D12 choices recorded in chat/research, plus explicit config integration with consent and backup. No new dependencies, worktrees or editor fork.

- Native boundary: typed bounded subprocess wrapper with held directory grant; source-only paths remain enforced at edit IPC. Extend native internal operations only for exact approved config/backup names. Preserve permission bits, UTF-8, size/path/hash/queue and patch invariants.
- Persistence: fsynced JSON recovery intent in userData before publication. Reconcile actual hashes, retain conflicts, require explicit recovery choice, never overwrite external changes blindly. Session-only undo/redo also uses expected hashes.
- Preview: bundle the tested preview-only transform, add a reviewed backed-up Next config wrapper which is inert outside the editor's preview environment, spawn bundled Node mode with scrubbed env after explicit permission. Bound process startup/stop and terminate its process group on quit.
- IPC/UI: exact trusted frame and strict bounded request validation; folder picker and remembered grants, existing EditorShell/SourceEditWorkspace, external-file invalidation, save failures and recovery UI. No generic filesystem/command IPC.
- Validation: tests first for native wrapper/workspace/recovery/integration; full earlier regression suite; real Electron loop and hostile IPC/path attempts; packaged app and network-disabled workflow, external conflict/watch, interrupted save and restart. Independent review and small draft PR; only founder can mark PASS.

Affected modules: apps/desktop main/preload/renderer/shared/native, desktop build/package assets and scripts, focused tests/e2e and phase evidence. Existing runtime-neutral editor APIs are reused. Tests and native fixture directories are disposable; never mutate original examples or user projects without explicit app consent.
