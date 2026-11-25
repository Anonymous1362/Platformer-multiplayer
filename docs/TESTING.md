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
- Real-device checks (touch, iOS silent switch, latency) are manual; see spec section 20.5.
