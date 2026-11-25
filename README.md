# Cosmic Drift

A landscape 2.5D sci-fi platformer with 1-4 player cross-play co-op.
Android (sideload APK) and iPhone/iPad (installable web app) from one TypeScript codebase.

Copyright (c) 2026 Anonymous1362. All rights reserved. This repository is public for viewing only; see `LICENSE`.

## Status

Pass 0 (foundation) and Pass 1A (boot, asset loading with fallbacks, device checks) are done. No gameplay yet.
Android builds: see `docs/RELEASE.md`.
See `docs/PROGRESS.md` for the current milestone and `docs/MASTER_SPEC.md` for the full specification.

## Commands

Node 24 is pinned in `.nvmrc`.

```bash
npm ci
npm run dev          # local dev server
npm run verify       # the full gate: format, lint, typecheck, layer rules, stub scan, tests, build
npm run test:e2e     # browser tests (builds first; needs Playwright browsers installed)
```

For local browser tests with an installed Chrome:
`CHROME_PATH=/path/to/chrome PW_CHROMIUM_ONLY=1 npx playwright test`

## For AI coding agents

Read `AGENTS.md` first, then `docs/PROGRESS.md` and `docs/HANDOFF.md`. Work one milestone at a time and stop for approval.
