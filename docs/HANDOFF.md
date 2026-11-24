# Cosmic Drift — Session Handoff

- **Current milestone:** Pass 0 — Bootstrap (IN PROGRESS; local quality gate green, browser/CI gate pending)
- **Branch:** `arena/d6467a6e-platformer-multiplayer`
- **Last green commit:** `96725ae` baseline commit (Pass 0 changes are not committed yet)
- **Started:** 2026-11-24

## 1. Implemented

- Preserved the full 2,362-line source specification at `docs/MASTER_SPEC.md`.
- Added contributor/session guidance: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/PROGRESS.md`, `docs/HANDOFF.md`, `docs/DECISIONS.md`, and `docs/TESTING.md`.
- Pinned Node `24.22.3` (`.nvmrc`), npm `11.21.3` (`packageManager`), exact dependencies, and committed-lockfile workflow (`.npmrc`, `package.json`, `package-lock.json`).
- Added Vite 8 + Phaser 4.2.1 responsive 1920×1080 WebGL canvas and procedural Cosmic Drift title/background scene (`src/main.ts`, `src/render/BackgroundScene.ts`, `src/style.css`). `Phaser.Scale.FIT` + `CENTER_BOTH` preserves the 16:9 game frame; browser coverage exercises 16:9, 19.5:9, and 4:3 viewports.
- Added starter deterministic utilities: `GameConfig`, `FixedStepClock`, `SeededRandom`, and radial stick deadzone (`src/core/**`, `src/input/deadzone.ts`).
- Added strict TypeScript, ESLint, Prettier, dependency-cruiser, stub scan, initial empty-level guard, Vitest, Playwright config, Git LFS attributes, and GitHub Actions CI.

## 2. Dependencies

New dependencies, versions, rationale, and install decision are in ADR-0001 of `docs/DECISIONS.md`. Registry versions were checked 2026-11-24. The exact install was run under Node `v24.22.3` / npm `11.21.3`; no install-time audit vulnerabilities were reported.

## 3. Verification

- `npx --yes --package=node@24.22.3 --package=npm@11.21.3 -c 'node --version && npm --version && npm ci && npm run verify'` — **PASS** on the final scaffold.
  - `format:check`, ESLint, strict typecheck, dependency checks, stub scan, unit tests, `test:golden` (no golden tests exist yet), empty-level lint, and production build all completed.
  - Vitest: **3 files, 10 tests passed**.
  - Build output: generated; main chunk 1,369.53 kB raw / 358.23 kB gzip (below the spec’s 900 kB gzip budget). Vite prints its default advisory for chunks >500 kB raw.
- `npx --yes --package=node@24.22.3 --package=npm@11.21.3 -c 'npm audit --omit=dev'` — **PASS**, 0 vulnerabilities.
- `git diff --check` — **PASS**.
- `git check-attr filter -- assets_src/audio/test.wav assets_src/test.png assets_src/test.psd` — each reports `filter: lfs`.
- HTTP smoke: Vite returned `index.html` from `http://127.0.0.1:4173/`; the Cosmic Drift preview server is running on port 4173.

## 4. Acceptance

| Pass 0 acceptance item | Result | Evidence |
| --- | --- | --- |
| Private GitHub repository | ✅ | `gh repo view --json nameWithOwner,isPrivate,viewerPermission` reports `isPrivate: true`. |
| Node pin, Vite 8, strict TypeScript 6, Phaser 4, ESLint, Prettier, dependency rules, Vitest, Playwright, CI, LFS rules, agent docs | ✅ | Configs and docs are present; TypeScript/lint/dependency/unit/build checks pass. |
| Clean `npm ci` | ✅ | Completed with the pinned Node/npm versions in the command above. |
| `npm run verify` locally | ✅ | Completed; see gate output above. |
| `npm run verify` in CI | ⏳ | Workflow is configured; requires pushed branch/PR run. |
| Responsive Phaser canvas/background at 16:9, 19.5:9, 4:3 | ⏳ | Playwright test is configured for Chromium and WebKit. Local browser test could not launch because browser binaries are absent and `cdn.playwright.dev` is unreachable in this sandbox; CI browser install is pending. |

## 5. Manual tests

- No physical devices were available/tested; no device-specific result is claimed.
- The 3 viewport cases are automated in `tests/e2e/bootstrap.spec.ts`, but not yet executed successfully in a browser.

## 6. Review & polish

- Fixed a deadzone edge-case found by a failing unit test; all 10 unit tests pass afterward.
- Kept Phaser imports in `src/render`; `src/core` passes the import-layer check.
- Phaser v4 migration guidance and the relevant Phaser setup, scale, scene, graphics, and text skills were read. `FIT` with centering is used; no Phaser 3-only FX/pipeline/tint APIs are used.
- **P0/P1:** none identified in checks that ran.
- **P2:** Vite raw bundle-size advisory (gzip budget passes); full golden replay and LevelLint behavior intentionally arrive in their planned milestones.

## 7. Traceability

Pass 0 has starter tracking for M10, N10, and N15 in `docs/PROGRESS.md`; other §25 items remain assigned to their scheduled milestones.

## 8. Known issues / deferred

- Local `npm run test:e2e` cannot launch Chromium/WebKit: Playwright browsers are not installed. `npx ... playwright install chromium webkit` failed because the sandbox cannot reach `cdn.playwright.dev` (ECONNRESET). CI installs those browsers on GitHub Actions; acceptance remains pending until it passes.
- Git LFS is not installed in this sandbox, so local LFS smudge/push behavior is not tested. `.gitattributes` is configured and CI checkout opts into LFS.
- Phaser’s required-WebGL fallback screen is Pass 1A; this Pass 0 canvas intentionally uses the WebGL renderer only.
- Full LevelLint and golden replay fixtures are not introduced in Pass 0. The gate reports empty content / no tests honestly rather than claiming those systems are complete.

## 9. Next milestone

After Pass 0 passes its pending browser and CI gates, hand off and stop. Pass 1A — Boot & canvas is next, but must not begin until the user explicitly approves it.

## 10. STOP

Awaiting completion of the Pass 0 CI/browser acceptance gate before requesting approval to proceed to Pass 1A.
