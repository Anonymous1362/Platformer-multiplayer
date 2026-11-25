# Decisions

- 2026-11-25: Free distribution route. Android sideload APK, iPhone/iPad via PWA, native iOS optional/paid.
- 2026-11-25: Repository is public (owner choice, for unlimited free Actions minutes). Never commit keys, keystores, or tokens. License changed to all rights reserved on 2026-11-25.
- 2026-11-25: TypeScript 6.0.3 pinned; Vitest 5.1.1; Phaser 4.2.1; Vite 8.3.8; Capacitor 8.6.2.
- 2026-11-25: Added `@types/node@24` (dev) so `tsconfig` can type Playwright config, tests, and tools. `tsconfig` `types` is `["vite/client", "node"]` and `include` also lists the three config files (small deviation from spec 13.1; spec updated to match). Size: types only, no runtime cost.
- 2026-11-25: ESLint uses `typescript-eslint` `strictTypeChecked`; `src/core/**` additionally bans `Math.random/sin/cos/pow`, wall-clock reads, and DOM globals.
- 2026-11-25: CI is `.github/workflows/ci.yml` only; `release.yml` (Android APK, PWA deploy) is Pass 7.
- 2026-11-25: Early APK pipeline test (a slice of Pass 7B) before Pass 1A, approved by the owner, to prove a phone-only owner can receive builds. Adds `capacitor.config.ts` and the generated `android/` project (Capacitor 8.6.2 template: compileSdk/targetSdk 36, minSdk 24, AGP 8.13.0, Gradle 8.14.3, JDK 21). `android/app/build.gradle` reads version from `-PcdVersionName/-PcdVersionCode` and signing from `CD_*` environment variables; the manifest locks `sensorLandscape`.
- 2026-11-25: Release signing key: RSA 4096 PKCS12, alias `cosmicdrift`, certificate SHA-256 `94:1F:C2:...:61:73:84` (full value in docs/RELEASE.md). Generated outside the repo and handed to the owner for offline backup; CI reads it from repository secrets and refuses any other certificate. The agent sandbox's proxy blocks the secrets API, so the owner adds the two secrets by hand.
- 2026-11-25: Vite `base: './'` so one build works in the Android WebView and under a web sub-path.
- 2026-11-25: CI builds a debug APK on every push to `main` (public repo, Actions minutes are free). Release APKs only from `v*` tags via `release.yml`.
- 2026-11-25: GitHub Pages preview deferred: the proxy blocks enabling Pages, and the final PWA origin must be chosen deliberately at Pass 7A because origin = save storage (all `*.github.io` sites of one account share an origin).
- 2026-11-25: Asset manifest file entries gain optional `width`/`height` (pixel size) so O3 can check dimensions at load; spec Appendix A updated.
- 2026-11-25: Vite `build.assetsDir: 'app'` so `dist/assets/` holds only game assets and the manifest (cleaner caching rules for the PWA later).
- 2026-11-25: Scenes get a `GameServices` object through their constructors (asset registry, capabilities, warn) instead of globals or Phaser's data registry.
- 2026-11-25: The performance badge lives in `src/app/` and shows in dev builds or with `?debug=1`, so it also works in staging and phone builds (spec 21.1 "performance overlay available").
- 2026-11-25: `?test=1` exposes a read-only `window.__CD_TEST__` (asset snapshot, capabilities) for browser tests.
