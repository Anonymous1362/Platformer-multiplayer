# Testing and Quality Gates

The full gate is `npm run verify`; its order matches spec §20.1. Run browser acceptance with `npm run test:e2e` after `npx playwright install chromium webkit`.

Pass 0 tests cover the radial input deadzone, fixed-step time accumulation, deterministic PRNG, and Phaser canvas sizing in Chromium and WebKit at 16:9, 19.5:9, and 4:3. Device-level checks are recorded per milestone in `docs/HANDOFF.md`; browser automation does not substitute for real-device acceptance.

The Pass 0 `levels:lint` command deliberately reports that there are no authored levels. Full schema, reachability, and geometry validation is not claimed until the level-authoring milestone.
