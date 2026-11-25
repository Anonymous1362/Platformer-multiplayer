# Testing and Quality Gates

The full local gate is `npm run verify`; its order matches spec §20.1. Browser acceptance uses `npm run test:e2e` after `npx playwright install chromium webkit`. Verify a recorded JSON replay with `npm run replay:run -- path/to/replay.json`.

Unit coverage includes radial input deadzone, fixed-step timing and spike/pause reset, xoshiro PRNG state restoration, deterministic trig, input sanitization and edges, canonical config/state hashes, entity-generation stale-reference rejection, RLE replay recording/CLI verification, asset manifest validation and procedural fallback, and frame telemetry. Browser tests cover Phaser boot, the required-WebGL fallback, viewport guards, and 16:9, 19.5:9, and 4:3 layouts in Chromium and WebKit.

The Pass 1A `levels:lint` command deliberately reports that there are no authored levels. Full schema, reachability, and geometry validation is not claimed until the level-authoring milestone.
