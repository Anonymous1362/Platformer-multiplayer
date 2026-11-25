# Progress

| Pass | Status |
| --- | --- |
| 0 | DONE, approved. |
| APK pipeline test (slice of 7B, approved early) | Debug APK builds in CI on every push. Signed release workflow ready; first release (`v0.0.1`) waits for the owner to add the two signing secrets (docs/RELEASE.md). |
| 1A | DONE locally, awaiting owner approval. CI result below. |
| 1B onward | Not started |

## Pass 1A evidence (2026-11-25)

- `npm run verify`: passes (format, lint, typecheck, layer rules, stub scan, 74 unit and property tests, golden placeholder, levels guard, build).
- Browser tests in Chrome (sandbox): 15 of 15 pass.
  - Boots cleanly at 844x390 (phone 19.5:9) and 1280x720 with zero failed requests, zero page errors, zero asset warnings.
  - A stalled star-field file falls back after the 1500 ms per-file timeout (whole boot under 5 s), with exactly one warning.
  - A 404, a corrupt PNG, and a malformed manifest all fall back with no errors.
  - With WebGL blocked, the "Graphics are not available" screen shows, its button is focused, and no canvas is created.
  - `?debug=1` shows the rounded FPS badge (FPS, EMA frame time, p95).
  - Ctrl+wheel, Ctrl+plus, and double-click zoom are blocked; plain wheel is not.
  - Earlier canvas checks (5 aspect ratios and live resize) still pass.
- Bundle: about 374 KB gzipped (budget 900 KB).

## Not verified yet

- Real phones (Android app, iPhone Safari). Owner to install the APK once the release is published.
- WebKit (Safari engine) runs in CI only.

Distribution plan: Android sideload APK (built in GitHub Actions) plus an installable PWA for iPhone/iPad. Native iOS is optional and paid.
