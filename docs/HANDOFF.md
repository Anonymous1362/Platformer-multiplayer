# Handoff

State: Pass 1E-2 (presentation) implemented and verified locally; 1E-3 (audio) is next. Auto mode is on (owner, 2026-11-27). Owner device checks for 1D (build 0.0.2, published on the Releases page) are still pending. Releases: the owner starts them from Actions → Release → Run workflow.

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

What 1E-2 added (render, HUD, input; the simulation is unchanged):

- Art (`src/assets/painters/NeoCelestial.ts`): procedural textures registered under manifest keys, so real art can replace any of them: nebula, dust, megastructure silhouettes, player suit and details, Crawler, a 24-frame shard spinner strip (frames named "0"–"23"), bolt, glow, shadow, ring, beam, vignette, slab side and top. `makeProceduralTexture` adds strip frames.
- `src/render/world/`: `TerrainView` (slabs: merged front-face rectangles, lit lip and planet rim, 14 u recessed back faces, camera-driven side faces), `ParallaxView` (layers 0.05/0.12/0.25/0.45 as tile sprites; 1.15 motes as 10 sprites; the Battery tier keeps 1, 4, 5), `LevelView` (pooled sprites keyed by entity ID, contact shadows from `core/Ground.groundDistance`, Crawler wind-up glow), `PlayerSprite` (rim light tinted by the planet, slot-tinted suit, jetpack flame, blink or steady outline), `SpritePool`, `Poses`, `Depth`, `TextureKeys`.
- `src/render/fx/`: `Effects` (consumes each tick's events once; hit flash 60 ms, hit-stop 45 ms on player hurt and enemy defeat, landing squash over 2 tiles, three dash afterimages, muzzle flash and recoil, sparks, shard sparkle, dissolve, checkpoint beam and "Saved", vent steam, damage numbers), `Particles` (pool with a hard cap; oldest slots reused), `CameraRig` (own follow + trauma shake + kick; 25% cap under reduced motion), `ScreenFx` (damage vignette, low-HP pulse or steady outline), `FxMath` (pure, tested).
- `src/hud/`: `HudView` (DOM: HP pill 280 × 18 with shield strip, fuel gauge, shard counter with bump), `HudModel` (pure), `PauseMenu` + `MenuModel` (Resume, Restart level; touch, mouse, keyboard, gamepad), rings on the touch Shoot (heat) and Dash (cooldown) buttons.
- `src/input/MenuNav.ts`: menu intents from keyboard (arrows/W/S, Enter/Space, Backspace) and pads (D-pad/stick, A, B); `GameInput.takeMenuIntents()`.
- `LevelScene`: restart via `scene.restart()` (per-run fields reset in `create`), context loss pauses with a notice and resumes after `RESTORE_WEBGL`, shutdown removes every listener and DOM node it added, quality tier (software WebGL → Battery, else Balanced; adaptive quality is 1F). Probe gained `menuOpen`, `contextLost`, `fx`.
- `Capabilities.softwareRenderer` (unmasked renderer name matches SwiftShader, llvmpipe, and similar).

Gotchas learned:

- Full-screen layers are the main cost on software WebGL; prefer sprites for sparse layers. Phaser `Graphics` redraws every command each frame, so merge static rectangles.
- Scene objects survive `scene.restart()`: reset per-run fields in `create`, and remove DOM nodes and renderer listeners on shutdown (delayed calls die with the scene clock, so a banner must be removed there too).
- Phaser 4 tint: `setTint(c).setTintMode(Phaser.TintModes.FILL)` (no `setTintFill`).
- Importing anything that imports Phaser breaks Vitest (no `window`): keep lists and math in Phaser-free modules (`TextureKeys`, `FxMath`, `HudModel`, `MenuModel`).

Deferred on purpose: "Restart from checkpoint" and the rest of the Pause screen (Settings, Controls, Quit) come with the UI layer in 2A; light shafts and filters (bloom, haze) wait for quality tiers; a mouse-clickable pause button waits for 2A.

Next: Pass 1E-3 (audio): `SoundEngine` with buses master → {music, sfx, ui, voice, ambience}, limiter (−3 dB, ratio 20, 3 ms attack, 250 ms release), polyphony caps (sfx 24, ui 6, ambience 4, voice 2), 40 ms minimum repeat, oldest/quietest stealing, synthesized SFX for every event above, unlock on the first gesture, suspend on interruption. Then 1F.
