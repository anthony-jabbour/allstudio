# Slice3.5 executed evidence

2026-10-31. Source text/diffs are from actual fixture files, not mocked patches. Screenshots are actual shared editor/browser or Electron output. Logs retain harness output except host path normalization. Full Playwright traces stay in local harness evidence directories to avoid committing large archives.

- Browser: responsive6 scenario groups; text34; layers13; typography10; spacing12; appearance10; layout15; routes7.
- Electron: native shell6, Aurora37, Lumen23, Harbor23; packaged shell6 and packaged offline37.
- `native-offline-reopened.png` additionally verifies a selected heading and enabled md typography28 after reopening the same packaged offline project. The older `native-reopened.png` caught the initial audit/loading state and no selection, so it is not evidence of ready property controls.
- Harness output says `PASS subframe IPC probe: unavailable`; this is NOT a successful direct subframe test. The direct probe remains unavailable. General preview/Node isolation and wrong-WebContents IPC denial passed.
- Offline production next build remains NOT RUN because of the historical next/font/google limitation. Online builds passed; these do not establish an offline production build.
- One initial packaged offline run failed during layout confirmation/window closure. A diagnostic retry passed; the earlier closure cause remains unexplained. No production relaxation or timeout increase was made.
