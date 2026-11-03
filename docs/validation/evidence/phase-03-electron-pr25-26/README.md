# PR #25/#26 Electron surface evidence

Captured by the packaged Linux Electron E2E in GitHub run [41592856300](https://github.com/anthony-jabbour/allstudio/actions/runs/41592856300), head `2bd0576`.

- `home-paper.png`: shared Studio Home, local board files and the Website projects entry.
- `board-editor.png`: shared board editor with a selected text layer and visible inspector controls; the screenshot verifies the board stylesheet is bundled in Electron.
- `website-projects.png`: the existing source-backed site workspace, reached from the shared Studio surface.

The same E2E creates a board, changes its typography, reloads the renderer, checks persistence, switches to Website projects, checks the source-editor host bridge, and returns while retaining the board selection and position. It passed in both development and packaged Electron. No local app was opened for these captures.
