# Testing

| Layer | Where | Run |
| --- | --- | --- |
| Unit and property tests (Vitest, fast-check) | `tests/unit/` | `npm test` |
| Golden replays (none yet) | `tests/golden/` | `npm run test:golden` |
| Browser tests (Playwright) | `tests/e2e/` | `npm run test:e2e` |
| Everything except browser tests | | `npm run verify` |

Notes:

- `src/core/**` must run in plain Node; ESLint and dependency-cruiser forbid DOM, Phaser, wall-clock, and `Math.random` there.
- The random generator is checked against an independent sfc32 reference vector, plus a pinned seed-0 vector. Changing either invalidates replays on purpose.
- Browser tests need Playwright browsers (`npx playwright install chromium webkit`). CI installs them. Without WebKit, set `PW_CHROMIUM_ONLY=1`.
- Browser tests use `?test=1` (read-only hooks in `window.__CD_TEST__`) and Playwright request routing to simulate stalled, missing, and corrupt assets and a blocked WebGL.
- Real-device checks (touch, iOS silent switch, latency) are manual; see spec section 20.5.
