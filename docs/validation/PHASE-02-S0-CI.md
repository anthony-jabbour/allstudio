# Phase 2 S0 — first hosted CI repair

2026-10-25. PR #11 initial head: `7b69befd648bd3bd3c0fdcec69818585465b3501`.

The quality job passed. The Linux desktop job built, passed all six development Electron checks and packaged successfully, but failed to launch the package: its test looked for `dist/linux-unpacked/allstudio`, while electron-builder derived `@allstudiodesktop` from the scoped package name.

Diagnosis: the installed linuxPackager defaults executableName to appInfo.sanitizedName, not productName. A local `bun run package --linux` produced `dist/linux-arm64-unpacked/@allstudiodesktop`, confirming the mismatch. The fix sets the supported `linux.executableName: allstudio` option. `bun run package --linux --x64` then exited 0, and filesystem inspection confirmed an executable `dist/linux-unpacked/allstudio`.

The Linux binary was cross-packaged on macOS and not executed locally. This is one diagnosis-driven CI repair; a hosted run must establish Linux execution. No repeat blind repair loop is authorized by this record. Mac development/packaged smoke tests already passed six checks each; no full Phase 2 gate claim follows.
