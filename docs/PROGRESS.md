# Progress

| Pass | Status |
| --- | --- |
| 0 | DONE, approved. |
| APK pipeline test (slice of 7B, approved early) | Debug APK builds in CI on every push. Signing secrets added by the owner. Releases start from Actions → Release → Run workflow (the agent cannot push tags). `0.0.1` published 2026-11-25 (release run 45609929624, signed APK 3.66 MB). |
| 1A | DONE, approved. |
| 1B | DONE, approved (CI run 45607110857). |
| 1C | DONE and green in CI (run 45620958633: verify, perf:bench, Chromium and WebKit browser tests, Android debug build). |
| 1D | IN PROGRESS (auto mode). |
| 1E onward | Not started |

## Pass 1C evidence (2026-11-25)

- `npm run verify`: passes (206 unit, property, and simulation tests; 5 golden replay tests; `levels:lint` 1 level, 0 failed; build).
- `npm run test:e2e` (Chrome, local): 15 of 15 pass (no app-side changes in 1C).
- Derived reach (spec 4.1) reproduced on all five planets, every column: full-jump apex within 0.7 u, flat distance exact, base jetpack apex within 0.2 u, jetpack distance exact (Kepler 201.5 / 392 / 343.0 / 910 u). Tap jump 77 u at 1.0x gravity and above 64 u on every planet. Dash 183.3 u.
- Every 4.1 rule has a scripted headless test: coyote (7 ticks yes, 8 no, no double jump), jump buffer (7 ticks before landing yes, 8 no, no auto-repeat), jump cut (0.45, once, after 3 ticks), wall slide (260 u/s, refreshes air dash, recharges fuel), wall jump (520 / -980 x sqrt(g), 7-tick stick lock, same height on Kepler and Vulcanis within 4 u), jetpack (engages at the apex, exactly 60 ticks of thrust, approaches -140 u/s, 0.55/s ground recharge), dash (10 ticks, no gravity, one air dash, 57-tick cooldown, 8 i-frames, walls end it), corner correction (8 u slips, 12 u bonks, never into a wall), ledge forgiveness (10 u pops, 15 u blocks, also while dashing), one-way (jump through, catch at terminal speed, drop-through with grace, then the lower platform catches), ice (0.25x deceleration).
- Moving platforms: ping-pong with end waits, riders carried, jump inherits velocity capped at 300 u/s, elevators lift, crushing against the floor or a wall gives a hazard respawn and never leaves the player inside geometry.
- Hazards (spec 4.3): spikes, lava, pits, kill planes; 25 damage shield-first; 0.5 s fade with the move at the midpoint; respawn on safe ground at least 1 s old, 2 tiles from hazards, never inside `no_safe_ground`; invulnerability blocks damage but not the respawn; death at 0 HP restores at the spawn after 1.2 s; shield recharges 20/s after 3 s; dash i-frames block hazard damage.
- No tunneling (property tests, fixed seeds): 400 random maps x moves of up to 400 u per axis never cross a solid tile or a one-way top; 100 random maps with random inputs and injected velocities up to 3000 u/s, plus 15 random four-player runs of the test arena, never end a tick with a player inside solid geometry.
- Robustness: NaN, Infinity, and 1e300 velocities neither hang a tick nor slip past the N11 assertion; the level parser never throws on 500 random JSON values and rejects 19 classes of bad level files with readable errors.
- `perf:bench` (4 players, test arena, moving platform): 0.005 ms mean per tick (budget 2 ms).

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
