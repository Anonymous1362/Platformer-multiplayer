# Handoff

State: Pass 1E-1 (gameplay core) implemented and verified locally; 1E-2 (presentation) is next, then 1E-3 (audio). Owner device checks for 1D (build 0.0.2) are still pending. Releases: the owner starts them from Actions → Release → Run workflow (`0.0.1` is published).

What 1C added (all in `src/core`, Node-only):

- `level/LevelTypes.ts`, `level/AsciiParser.ts`: `parseLevel(raw)` validates level JSON (spec 5.2) into an immutable `Level` (tile flags, spawn, platforms, zones, content hash). It never throws and rejects anything whose behavior is not built yet (crumble/cracked tiles, enemies, decor, triggers).
- `Collision.ts`: axis-separated `moveX`/`moveY` with sub-steps above 32 u, one-way crossing test with 6 u snap, corner correction (10 u, both heights checked), ledge forgiveness (14 u), `findSupport`, `wallContact`, `overlapsSolid`. Out-of-bounds columns and rows above the level are solid; rows below are a pit.
- `player/PlayerController.ts`: the state machine (`ground`, `air`, `wallSlide`, `dash`, `hazardRespawn`, `dead`); `applyIntents` (edges, timers, buffer) runs before kinematics, `movePlayer` after.
- `player/Hazards.ts`: hazard tiles, pits, kill planes, damage (shield first), safe-ground sampling, respawn and death sequences, shield recharge.
- `MovingPlatforms.ts`: ping-pong paths, rider carry, pushes, crush → hazard respawn.
- `WorldSimulation(level)`: tick order 1 (intents) → 2 (platforms) → 3 (players) → 6 (hazards, safe ground). `createWorld(setup, level)`, `setupFor(level, …)`.
- Replays are format v2 (`levelId` + `levelHash` in the setup); `runReplay(replay, level)`.
- Content: `content/levels/dev/test_arena.json` (one-way stack, spike pit, wall-jump shaft, ceiling notch, lava lake with a one-way moving platform, bottomless gap with a kill plane, ice strip, end ledge).
- Tools: `tools/shared/levels.ts` (Node loader), `levels:lint` now parses every level (stage 1 of LevelLint).
- Tests: `tests/sim/{reach,movement,platforms,hazards,tunneling}.test.ts`, `tests/unit/level-parser.test.ts`; fixtures `tests/fixtures/levels.ts` (`makeLevel`, `flatLevel`, `Harness`).

Decisions this pass (details in `docs/DECISIONS.md`, spec updated): gravity is rising/falling only (the jump cut handles early release); the jetpack engages at the apex while Jump is held; wall-jump vy scales with sqrt(gravity); dash = 183 u; platform `w`/`h`; object anchoring; respawn fallbacks.

Gotchas learned:

- Test fixtures that place a player inside a wall get "landed" on that wall's top; always place bodies in free space (the Harness `placePlayer` does not check).
- `scriptedInput` now presses Dash at tick 0, so tests that need a specific velocity should use explicit frames.
- The N11 assertion used to build a path string per element and dominated test time; it now builds the path only on a hit.
- Changing `GameConfig`, the simulation, or `test_arena.json` changes golden hashes on purpose: `npm run golden:record`, review, commit.

What 1E-1 added (src/core, Node-only):

- `combat/Raycast.ts` (tile grid walk, segment vs box, line of sight), `combat/Weapons.ts` (Pulse Blaster, heat and vent, auto and manual aim), `combat/Projectiles.ts` (swept bolts).
- `enemies/Enemies.ts` (spawn with difficulty HP, sleep and wake, damage, defeat with drops, section resets; behavior table per archetype), `enemies/EnemyCommon.ts` (helpers kept apart to avoid an import cycle), `enemies/Crawler.ts`.
- `pickups/Pickups.ts` (level shards, drops, magnet, collection), `Progress.ts` (run state, checkpoints, exit, death reset), `SimContext.ts` (per-tick context, ID allocation, sorted insert).
- `player/Hazards.ts` gained `hurtPlayer` (knockback, control lock), difficulty-scaled damage, and checkpoint respawns; `PlayerState.wallJumpLockTicks` became `controlLockTicks`.
- Tick order now runs phases 1–7 (players fire after moving; enemies; projectiles; hazards, pickups, triggers; death reset).
- The arena has 3 Crawlers, 15 level shards, 2 checkpoints, and an exit. `LevelView` draws them with plain shapes; `LevelScene` shows a level-complete banner.
- `InputFrame.held` bit 6 is `AimManual`; the router sets it when the mouse or right stick aims.

What 1D added:

- `src/input/`: `TouchLayout` (Classic preset, 12 px hit slop, nearest-center split, floating or fixed stick), `TouchControls` (finger ownership; pure logic + `attachTouchListeners`), `KeyboardMouseControls` (both 8.9 columns, repeat ignored, modified keys ignored, mouse aim through a scene resolver), `GamepadControls` (standard mapping, D-pad, right-stick aim, refocus suppression, hot-plug), `InputRouter` (latching merge, `releaseAll`, `installInputCleanup`).
- `src/hud/TouchControlView.ts`: DOM controls over the canvas with `pointer-events: none`; shown on touch devices or after the first touch.
- `src/app/GameInput.ts`: builds the adapters, attaches them to the canvas on Phaser READY, polls gamepads each frame, forwards interruptions to scenes.
- `src/render/world/LevelView.ts`: plain-shape renderer (stand-in until the 1E art pass).
- `src/scenes/LevelScene.ts`: plays the test arena: FixedLoop → one router frame per tick → `WorldSimulation`; render interpolation with teleport snapping; camera follow and zoom; minimal pause; releases input on shutdown; publishes the `?test=1` probe.
- Phaser input plugins are off. Boot goes straight to `LevelScene`.

Gotchas learned:

- CDP `Input.dispatchTouchEvent` releases fingers by list position, not by id, and `touchEnd` must carry no points; use synthetic `TouchEvent`s to lift a specific finger.
- `touch-action: none` is still on `body` (from 1A); when DOM menus arrive in 2A, scope it to the canvas and HUD so menus scroll.

Owner device checks still open (spec 8.13 records): 2–3 fingers on a real phone, a controller inside the Android app, the iPhone PWA.

Next: Pass 1E-2 (presentation): HUD (HP and shield pill, fuel, shards, heat ring on Shoot), pause menu with Restart, procedural Neo-Celestial art (slabs with side faces, five parallax layers, contact shadows), event-driven effects consumed once per tick, render-only hit-stop, reduced motion, WebGL disposal and context loss (N13). Then 1E-3: SoundEngine (buses, limiter, polyphony caps, synthesized SFX).
