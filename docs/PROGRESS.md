# Progress

| Pass | Status |
| --- | --- |
| 0 | DONE, approved. |
| APK pipeline test (slice of 7B, approved early) | Debug APK builds in CI on every push. Signing secrets added by the owner. Releases start from Actions → Release → Run workflow (the agent cannot push tags); `0.0.1` not yet published. |
| 1A | DONE, approved. |
| 1B | DONE and green in CI (run 45607110857: Node 24 verify, perf:bench, Chromium and WebKit browser tests, Android debug build), awaiting owner approval. |
| 1C onward | Not started |

## Pass 1B evidence (2026-11-25)

- `npm run verify`: passes (117 unit, property, and simulation tests; 5 golden replay tests; layer rules 0 errors).
- Same seed and inputs give identical state hashes every 60 ticks in two scripted scenarios (2 players on Kepler, 4 players on Vulcanis Hard); a different seed changes the hash; a mid-run snapshot resumes to the identical final hash.
- dt spike: a 5 s frame runs exactly 4 ticks (no teleport) and the dropped backlog never returns; pause and resume never simulate paused time; 60 Hz, 144 Hz, 30 Hz, and uneven frame timing all reach the identical hash at tick 600.
- Spec 4.1 derived reach reproduced on all five planets (full-jump apex within ±2 u, flat jump distance within ±2 u).
- Golden replays reproduce their hashes through `npm run test:golden` and the CLI (`npm run replay:run -- tests/golden/replays/basic_movement_kepler.json`).
- `perf:bench`: 0.001 ms mean per tick with 4 players (budget 2 ms; players only so far).
- Negative checks: a Phaser import planted in `src/core` fails `deps:check` (now a permanent canary test); `Math.random`, `Math.sin`, `Math.pow`, `**`, `window`, `Date.now`, and `performance.now` in `src/core` all fail ESLint.

## Pass 1A evidence (2026-11-25)

- `npm run verify`: passes (format, lint, typecheck, layer rules, stub scan, 74 unit and property tests, golden placeholder, levels guard, build).
- Browser tests in Chrome (sandbox): 15 of 15 pass.
  - Boots cleanly at 844x390 (phone 19.5:9) and 1280x720 with zero failed requests, zero page errors, zero asset warnings.
  - A stalled star-field file falls back after the 1500 ms per-file timer (whole boot under 5 s), with exactly one warning, in Chromium and WebKit.
  - A 404, a corrupt PNG, and a malformed manifest all fall back with no errors.
  - With WebGL blocked, the "Graphics are not available" screen shows, its button is focused, and no canvas is created.
  - `?debug=1` shows the rounded FPS badge (FPS, EMA frame time, p95).
  - Ctrl+wheel, Ctrl+plus, and double-click zoom are blocked; plain wheel is not.
  - Earlier canvas checks (5 aspect ratios and live resize) still pass.
- Bundle: about 374 KB gzipped (budget 900 KB).

## Not verified yet

- Real phones (Android app, iPhone Safari). Owner to install the APK once the release is published.
- WebKit (Safari engine) runs in CI only (passing).

Distribution plan: Android sideload APK (built in GitHub Actions) plus an installable PWA for iPhone/iPad. Native iOS is optional and paid.
