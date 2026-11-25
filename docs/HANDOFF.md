# Handoff

State: Pass 1B implemented and verified locally (see `docs/PROGRESS.md`); waiting for owner approval before 1C. Releases: the owner starts them from Actions → Release → Run workflow; `0.0.1` is not published yet.

What exists for 1B (all in `src/core`, Node-only, no platform imports):

- `GameConfig` (`as const`, spec 3.4 and 4.1 values), `Ticks` (ms → ticks at module load), `CONFIG_HASH` (FNV-1a of canonical JSON, computed at module load).
- `Hash` (FNV-1a 32 with u8/u32/f64/string writers, canonical JSON), `DMath` (4096-entry sine table built from a Taylor series, polynomial atan2), `EntityIds` (generation-tagged IDs, plain-data allocator), `Ids` (planet and difficulty unions; a test checks them against Appendix B).
- `InputSanitize`: the simulation's input boundary; clamps, finite checks, and the network's i8 axis quantization (×127), idempotent.
- `SimulationTypes`, `WorldSimulation` (`createWorld`, `cloneWorld`, `step` with the 13.4 order: inputs and edges, players X then Y; semi-implicit Euler; flat test floor), `StateHash`, `FiniteGuard` (N11 path-reporting assertion), `Replay` (RLE recorder, validation, `runReplay`).
- Tools: `npm run replay:run -- <file>`, `npm run golden:record`, `npm run perf:bench` (run with `tsx`).
- Tests: `tests/sim/*` (determinism, dt spike, pause, refresh-rate independence, derived reach), `tests/unit/core-basics.test.ts`, `tests/unit/replay.test.ts`, `tests/unit/layer-rules.test.ts` (canary), `tests/golden/*`, scenarios in `tests/fixtures/scenarios.ts`.

Gotchas learned:

- **dependency-cruiser:** `exclude: node_modules` hid every package import from every rule, so Pass 0's layer rules never checked packages. Use `doNotFollow` for node_modules, never `exclude`. The programmatic API only applies rules with `validate: true`.
- **approach()** used to return the target when given NaN, silently hiding corruption; it now passes NaN through so the N11 assertion catches it (regression test in `tests/sim/determinism.test.ts`).
- The spec's derived-reach table assumes velocity-then-position integration with gravity applied on the take-off tick. Keep that order in 1C.
- The flat floor (`setup.floorY`) is temporary; 1C replaces it with tile collision and level loading. `aimMrad` is sanitized and recorded but not used by the simulation yet.
- Changing `GameConfig` or the simulation changes golden hashes on purpose: run `npm run golden:record`, review the diff, commit.
- Earlier gotchas (Phaser loader timeouts, WebKit XHR timeouts, Phaser `Scale.RESIZE`) are in the Pass 1A notes in git history and in `docs/DECISIONS.md`.

Next: Pass 1C (spec section 23): player state machine, axis-separated tile collision, one-way and drop-through, coyote, buffer, jump cut with minimum hold, wall slide and jump, jetpack, dash, corner correction, ledge forgiveness, hazard respawn, one moving platform, minimal ASCII level parser and a test arena.
