# Testing

| Layer | Where | Run |
| --- | --- | --- |
| Unit and property tests (Vitest, fast-check) | `tests/unit/` | `npm test` |
| Simulation (determinism, dt spikes, pause, refresh rate, reach, movement rules, platforms, hazards, no-tunneling properties) | `tests/sim/` | `npm test` |
| Golden replays | `tests/golden/` | `npm run test:golden`; re-record with `npm run golden:record` after a deliberate change |
| Replay one file | | `npm run replay:run -- <replay.json>` |
| Simulation benchmark | `tools/perf-bench/` | `npm run perf:bench` (runs in CI) |
| Level files (parser stage of LevelLint) | `content/levels/**` | `npm run levels:lint` |
| Browser tests (Playwright) | `tests/e2e/` | `npm run test:e2e` |
| Everything except browser tests | | `npm run verify` |

Notes:

- `tests/unit/layer-rules.test.ts` proves the layer rules fire, using the canary files in `tests/fixtures/layer-canary/`.
- `src/core/**` must run in plain Node; ESLint and dependency-cruiser forbid DOM, Phaser, wall-clock, and `Math.random` there.
- The random generator is checked against an independent sfc32 reference vector, plus a pinned seed-0 vector. Changing either invalidates replays on purpose.
- Browser tests need Playwright browsers (`npx playwright install chromium webkit`). CI installs them. Without WebKit, set `PW_CHROMIUM_ONLY=1`.
- Browser tests use `?test=1` (read-only hooks in `window.__CD_TEST__`) and Playwright request routing to simulate stalled, missing, and corrupt assets and a blocked WebGL.
- Rule tests build tiny ASCII maps with `tests/fixtures/levels.ts` (`makeLevel`, `flatLevel`, `Harness`). The Harness drives one world tick by tick and keeps every event.
- Property tests use fixed fast-check seeds so failures reproduce; a failure prints the seed, the path, and the counterexample map.
- Golden replays and the benchmark run on `content/levels/dev/test_arena.json`. Editing that level changes its hash, so re-record the goldens.
- Browser play tests (`tests/e2e/play.spec.ts`) read the running level through the `?test=1` probe (`window.__CD_TEST__.sim()`). Multi-touch uses the Chrome DevTools Protocol for real touches (it releases fingers by list position, not id) and synthetic `TouchEvent`s to lift one specific finger; both are Chromium-only. The gamepad test replaces `navigator.getGamepads`.
- Presentation tests (`tests/e2e/presentation.spec.ts`) cover the HUD, the pause menu (keyboard and mouse), ten clean restarts, WebGL context loss and restore (`WEBGL_lose_context`; skipped where the extension is missing), and reduced motion (`page.emulateMedia`). Render code that imports Phaser cannot load in Vitest; its logic lives in Phaser-free modules (`FxMath`, `HudModel`, `MenuModel`, `TextureKeys`, `core/Ground`) that have unit tests.
- Browser tests run on software WebGL, which renders the Battery look and runs the game slower than real time; tests poll the probe with timeouts instead of assuming 60 ticks per second.
- Audio: pure parts (voice pool, space, pitch chain, recipes, event mapping with a recording player) are unit-tested; the real Web Audio graph is checked in the browser through `__CD_TEST__.audio` (state, limiter settings, and `stress()`, an offline worst-case render whose peak must stay below 1.0).
- `tests/sim/arena-run.test.ts` is a closed-loop autopilot that plays `test_arena` to the exit. If the arena changes, keep the autopilot passing (it decides by position, so small edits rarely break it).
- Real-device checks (touch, iOS silent switch, latency) are manual; see spec section 20.5.
