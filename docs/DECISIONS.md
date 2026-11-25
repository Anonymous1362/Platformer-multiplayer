# Decisions

- 2026-11-25: Free distribution route. Android sideload APK, iPhone/iPad via PWA, native iOS optional/paid.
- 2026-11-25: Repository is public (owner choice, for unlimited free Actions minutes). Never commit keys, keystores, or tokens. License changed to all rights reserved on 2026-11-25.
- 2026-11-25: TypeScript 6.0.3 pinned; Vitest 5.1.1; Phaser 4.2.1; Vite 8.3.8; Capacitor 8.6.2.
- 2026-11-25: Added `@types/node@24` (dev) so `tsconfig` can type Playwright config, tests, and tools. `tsconfig` `types` is `["vite/client", "node"]` and `include` also lists the three config files (small deviation from spec 13.1; spec updated to match). Size: types only, no runtime cost.
- 2026-11-25: ESLint uses `typescript-eslint` `strictTypeChecked`; `src/core/**` additionally bans `Math.random/sin/cos/pow`, wall-clock reads, and DOM globals.
- 2026-11-25: CI is `.github/workflows/ci.yml` only; `release.yml` (Android APK, PWA deploy) is Pass 7.
