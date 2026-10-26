# Phase 2 — native file-operation feasibility

Date: 2026-10-25. Founder explicitly approved an original native helper after the research below. This is an unexposed byte primitive, not the production workspace adapter or a completed gate.

## Research and approval

Node's documented rename API accepts paths, not directory descriptors. A disposable Mac probe of `/dev/fd/<directory fd>/probe` returned ENOENT. Rechecking a pathname cannot replace descriptor-relative publication and cleanup.

No suitable qualifying OSS solution found for a drop-in Node adapter providing the complete required transaction. Canonical GitHub metadata checked directly on 2026-10-25:

| Candidate | Repository | Stars | License evidence | Fit |
|---|---|---:|---|---|
| cap-std | https://github.com/sunfishcode/cap-std (redirect from bytecodealliance) | 833 | Other/NOASSERTION; legal review incomplete | Below threshold; Rust integration required |
| node-fs-ext | https://github.com/baudehlo/node-fs-ext | 110 | MIT | Below threshold; complete transaction API not established |
| fs-safe | https://github.com/openclaw/fs-safe | 62 | MIT | Below threshold; README calls macOS containment best-effort |
| libuv | https://github.com/libuv/libuv | 27284 | MIT | Eligible, but its path-based rename does not supply this transaction |

Sources: GitHub REST `repos/<owner>/<repo>`, [Node fs docs](https://nodejs.org/api/fs.html), and [cap-std Dir API](https://docs.rs/cap-std/latest/cap_std/fs/struct.Dir.html). No new dependency or external source was incorporated. REA not applicable and not invoked. The original helper uses the OS C library and existing compiler; project-owned code and platform APIs are exempt from the external-tool star threshold.

## Primitive and actual tests

`apps/desktop/native/files.c` requires the granting parent to pass its pinned root directory as descriptor 3. A root string is insufficient authority. Descendants resolve with openat/O_NOFOLLOW; only regular, single-link, bounded src/**/*.tsx|jsx files qualify. Expected bytes are compared twice. A random exclusive temp is chmodded and fsynced; READY accepts bounded input, PREPARED waits for C before publication. Parent scope, temp identity, bytes, links and permission bits are rechecked. Rename and cleanup use held parent descriptors. Errors after publication say commit-uncertain rather than claiming the original was kept.

`bun run test apps/desktop/tests/native-files.test.ts`: seven tests pass on arm64 macOS. Tests compile the actual helper using `cc -std=c11 -Wall -Wextra -Werror`, then inspect real bytes, modes and directories. Coverage: expected-byte conflicts; traversal/symlink/hardlink denial; absent/mismatched grants; cancellation after preparation; prepared-temp replacement and chmod; parent swap after preparation and cleanup through the original held parent.

Independent review reproduced a P1 temp substitution and a P2 changed-temp mode. Each received a failing regression before correction. The temp descriptor now stays open and is checked before and after publication; mode comparisons reject permission tampering. Cleanup checks the temp entry identity and leaves an unknown replacement entry intact. Pre-fix green tests are not evidence those defects never existed.

## Limits before production use

Not wired to renderer IPC or included in the packaged app. Still required: bounded typed Node wrapper, invalid UTF-8 refusal, mapper validation, synchronous per-file queue admission, journal/recovery UX, watcher/grants, abrupt termination/power-loss tests, and packaged-helper proof.

This is not kernel-atomic compare-and-swap against arbitrary same-privilege external writers. Source verification and rename are separate syscalls; a final temp-name substitution window is checked after publication but is not impossible. Pinned descriptors prevent directory-path redirection, not all concurrent mutations or OS access by user code. The eventual adapter must reconcile uncertain outcomes against its journal and actual hashes without blindly overwriting external edits. Abrupt termination can leave a prepared temp; recovery is not implemented here.

Recommendation: INCOMPLETE for production; reviewable feasibility slice only.
