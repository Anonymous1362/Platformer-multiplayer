# Testing and Quality Gates

The full gate is `npm run verify`; its order matches spec §20.1. Run browser acceptance with `npm run test:e2e` after `npx playwright install chromium webkit`.

Bootstrap tests cover radial input deadzone, fixed-step timing, deterministic PRNG, asset manifest validation, timeout/procedural fallback and scene-boundary swaps, and frame telemetry. Browser tests cover Phaser boot, required-WebGL fallback, viewport guards, and supported 16:9, 19.5:9, and 4:3 frames in Chromium and WebKit.

The Pass 1A `levels:lint` command deliberately reports that there are no authored levels. Full schema, reachability, and geometry validation is not claimed until the level-authoring milestone.
