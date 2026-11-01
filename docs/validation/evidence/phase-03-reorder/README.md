# Slice3.6 executed evidence

Actual source/diffs and browser/Electron screenshots, with host paths normalized in logs. Browser: reorder6 scenario groups, responsive6, text34, layers13, typography10, spacing12, appearance10, layout15, routes7. Native: Aurora38, Lumen23, Harbor23; development and packaged security6 each; packaged offline repair38.

Offline automation uses the actual packaged renderer/preload/main/native helper, with OS preview-child egress denial and browser HTTP blocked. Its owned window is hidden with background throttling disabled to isolate the automated renderer from unrelated desktop input; this does not substitute for human OS/assistive-technology validation.

An initial Lumen center selection failed with clipped/global-scrolled UI; visible-point repair passed. An initial offline restart assertion found /about while expecting root; the repair explicitly selected the tested root route. The unexpected route cause is not established. Full original logs/traces remain in local dist harness directories.

The direct subframe IPC probe is unavailable despite the harness's PASS-prefixed availability line; it is not counted as a passed direct probe. Offline production next/font/google build remains NOT RUN. Independent review's statement-control-flow finding was fixed RED→GREEN. Minor stale route confirmation after Cancel/Escape is queued for final Phase3 finishing.
