# Architecture Decisions

## ADR-0001 — Bootstrap toolchain and starter architecture

- **Date:** 2026-11-24
- **Status:** Accepted for Pass 0
- **Decision:** Start with Node 24 LTS, TypeScript 6, Vite 8, Phaser 4, Vitest, Playwright, ESLint/typescript-eslint, Prettier, and dependency-cruiser. Pin installed dependency versions exactly and commit `package-lock.json`. Keep deterministic starter math and timing utilities framework-independent under `src/core`; isolate the initial Phaser scene in `src/render`.
- **Context:** Pass 0 requires a runnable Phaser canvas, strict TypeScript, the first deterministic/unit tests, lint/format/import-layer checks, e2e scaffolding, and CI.
- **Alternatives:** Phaser 3 (rejected by spec); non-deterministic `Math.random` (rejected for reproducible tests); a larger game framework/state library (not needed for this milestone).
- **Dependencies:** `phaser@4.2.1` (runtime renderer); `vite@8.3.8` (dev server/build); `typescript@6.0.3` (strict compiler); `vitest@4.1.12` (unit tests); `@playwright/test@1.65.1` (browser acceptance scaffold); `eslint@10.15.0` + `typescript-eslint@8.74.0` (lint); `prettier@3.10.1` (format); `dependency-cruiser@18.9.0` (layer/cycle checks); `@types/node@26.6.7` (tooling types). Versions were checked in the npm registry on 2026-11-24. No additional runtime dependency is planned for Pass 0.
- **Consequences:** Node 24.22.3 is pinned in `.nvmrc`; contributors need Node 24 or 26. CI and local verification use the committed npm lockfile. Phaser stays outside `core`.
