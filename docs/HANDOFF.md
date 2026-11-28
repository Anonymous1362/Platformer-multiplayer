# Handoff

State: 2A, 2B-1, and release prep for 0.0.5 are merged (#4, #5, #6). Pass 2B-2 is merged (#7); 2B-3 (PR #8) and 2B-4 (touch presets and layout editor) are done; the owner asked to finish 2B (2B-4 layout editor, 2B-5 rebinding) and then start "Art & UI B" on command. Each step gets its own PR. The owner runs Actions → Release for 0.0.5 (and later versions). Manual mode. Owner phone checks still open: docs/DEVICES.md and the 2A "no long tasks on a Mid device" check.

What 2B-4 added:

- `input/TouchLayout.ts`: `buildLayout(width, height, { preset, floatingStick, buttonScale, custom })`, `presetButtons`, `presetAutoFire`, `overrideFromPoint`, `layoutProfile`; `classicLayout` is now a wrapper.
- `settings/TouchLayoutStore.ts` (`cd.touchLayouts`); `GameInput.setTouchPrefs({ preset, ..., custom(profile) })`, `layoutProfile`, `canvasSize`; `SettingsApply` re-lays out on settings or saved-layout changes and forces auto-fire for Simple.
- `ui/screens/LayoutEditor.tsx`, opened through `useSettingsPopup` (Settings ⇄ editor); the UI context's `touch` host gives it the layout store, canvas size, and profile.
- Test hook `__CD_TEST__.touchLayout()`.

What 2B-3 added:

- `src/theme/Cvd.ts`: Machado 2009 matrices, sRGB ↔ linear ↔ Lab, CIEDE2000, `perceivedDelta`, `contrastRatio`. `ThemePalette.ts`: `SemanticColors`, `CVD_PALETTES`, `semanticColors(mode)`, `WorldColors`/`worldColors()`.
- Apply: `UiService.setSemantic` (CSS variables on `.cd-ui`), `HudView.setStyle(colors, highContrast)`, `TouchControlView.setColors`, and `colors` passed to `LevelView`, `TerrainView` (spikes), `Effects`, `ScreenFx` at level start.
- `src/audio/Captions.ts` (`CAPTION_KEYS`, `captionDirection`, `CaptionQueue`) and `src/hud/CaptionView.ts`; `LevelScene` wraps the engine given to `GameAudio` so captioned sounds post captions.

What 2B-2 added:

- `content/locale/en.json` (all player-facing strings), `src/i18n/I18n.ts` (`I18n.t(key, params)`, plurals, numbers, English fallback, `pseudoLocalize`, `PSEUDO_LOCALE = 'en-XA'`), `src/i18n/Locales.ts` (`resolveLocale`, `createTranslator`, `SUPPORTED_LANGUAGES = ['en']`).
- `main.ts` `createLanguage(settings)`: a `Store<Translator>` that follows Settings → Language live; `?lang=en-XA` in test/debug builds. It goes into `services.i18n` and the UI context; Preact components call `useT()` (and `useTranslator()` for numbers); non-Preact code calls `services.i18n.get().t(...)` (level notices, error panel, Safe Mode, no-graphics screen, checkpoint label) or receives a translate function (touch labels via `GameInput.setTranslate`).
- Adding a language later: add `content/locale/<lang>.json`, add the code to `SUPPORTED_LANGUAGES` and the Language options, and load it in `createTranslator`. Keys missing in a language fall back to English and are logged once.
- Tests: `tests/unit/i18n.test.ts`; `tests/e2e/pseudo-locale.spec.ts` (`audit()` collects untranslated and overflowing text per screen and saves screenshots).

Gotchas learned:

- New player-facing text must go through a key, or the pseudo-locale test fails; the unit test also fails on keys nobody uses.
- Touch button labels live in their own `[data-label]` span, so re-labelling never removes the cooldown rings.

What 2B-1 added:

- `src/settings/`: `SettingsSchema.ts` (one Zod schema per §8.6 row, `DEFAULT_SETTINGS`, `parseSettings` never throws and falls back per field, `serializeSettings`), `SettingsStore.ts` (`cd.settings`, writes on every change, survives blocked storage, migrates `cd.perf`), `Derived.ts` (pure mappings: bus gains, stick tuning, `FxPrefs`, manual tier, fps limit, level difficulty, reduced motion).
- `src/ui/screens/SettingsScreen.tsx`: tabs Audio, Graphics, Controls, Gameplay, Accessibility, Language, Data, About; rows say when a setting takes effect; Restore defaults per tab; pop-up rises from its opener (gear on the Title, "Settings" on Pause). Settings and About info travel in the UI context (`useUi().settings`).
- `src/app/SettingsApply.ts`: on every change → `SoundEngine.setMix` (volumes, mono, night), stick tuning (touch and pads), touch stick type, button size and opacity, `InputRouter.setOptions` (shoot toggle, auto-fire, aim mode via `input/InputOptions.ts`), quality preset (`QualityGovernor.setManual`), `game.loop.setFPSLimit`, the FPS badge, UI reduced motion and `--text-scale`. `installAudioLifecycle` honours "Mute when in background".
- Read at each level start (`LevelScene.create`): difficulty, assists, particles and parallax overrides, background intensity, the level's reduced motion. Read live: camera shake, hit-stop, screen flashes, damage numbers (`FxPrefs` getter into `Effects`, `CameraRig`, `ScreenFx`), game speed. TitleScene: menu background (static/animated) and intensity.
- Core: `WorldSetup.assists?` (`Assists`, `NO_ASSISTS`, `assistBits`), `DamageRules` for `hitHazard`/`hurtPlayer`, infinite fuel in the jetpack, assists in the state hash only when on, optional `setup.assists` in replays.
- Test hooks: `__CD_TEST__.settings()`, `.audio.mix()`, `.fpsLimit()`; the probe has `difficulty` and `assists`.

Gotchas learned:

- The game keyboard handler used to `preventDefault` Arrow keys everywhere; form controls now keep their own keys (`isFormControl`).
- `choice()` option lists need a `const` type parameter, or the literals widen to `string`.
- Hover-to-focus follows only real mouse movement (`pointermove` with movement) and never takes focus from a slider or text field: content opening under a still mouse used to steal focus from a slider mid-adjustment (CI caught it).
- Navigation scopes register and autofocus in a layout effect, and autofocus never takes focus from something already focused inside the scope (a passive effect ran after paint and could steal focus on slow CI).
- Eight axe scans on software WebGL take about 30 s; that test has its own 120 s timeout.

What 2A added (`src/ui`, Preact, DOM over the canvas inside `#game-root`):

- `tokens.css` (spec 8.2 tokens as CSS variables under `.cd-ui`; glass via `data-glass`, opaque in high contrast or Battery/Safe Mode), `fonts.ts` (Exo 2 700, Inter 500/600 from @fontsource, bundled).
- `motion.ts`: durations, easings, springs (analytic step response → CSS `linear()`), one `MOTIONS[kind](reduced, params)` per §8.4 row, `play()`, counter roll, logo shard offsets. `Transitions.ts`: fade through `bg.deep` (150 + 150 ms) and iris (disc scaled up, then fade; 450 ms), fade under reduced motion; `midpoint` switches scenes.
- `components/`: Button (variants, pressed/selected/disabled, UI sound), Panel, Toggle, Segmented, Stepper, Badge, ItemCard, NumberCounter, ProgressRing (Basics); Slider, Tabs, CodeInput, ScrollList (Inputs); Modal, ConfirmDialog (Cancel focused), SideSheet, ToastQueue/ToastHost (Overlays).
- `nav.ts` + `hooks.ts`: `NavStack` of scopes; menu intents move DOM focus over `[data-nav]` items, confirm clicks, back calls `onBack`; hover/focus set `data-selected`; modals trap Tab and restore focus.
- `UiService.tsx`: owns the screen store (`none` | `photosensitivity` | `title` | `pause`), toasts, transitions, prefs (`prefs.ts`: reduced motion system/on/off, glass, contrast). `services.ui` in every scene. `closeTopModal()` lets the pause key close a dialog instead of the menu.
- `screens/Screens.tsx`: PhotosensitivityNotice, TitleScreen (logo assembles, "Tap to start", version), PauseScreen (Resume, Restart level, performance overlay, Quit to title with confirm).
- `gallery/Gallery.tsx`: `?debug=1&gallery=1`, a standalone page (no game).
- `scenes/TitleScene.ts`: drifting nebula/star tile sprites, notice then Title, pumps intents, emits BOOT_READY. Boot → Title (or straight to Level with `?test=1`; add `&flow=1` for the real flow). Level Quit → fade → Title.
- `TouchControlView.setSuppressed` hides touch controls on the Title. New synth keys `sfx_ui_toggle`, `sfx_ui_error`. `touch-action: none` now only on the canvas; the page uses `manipulation`.
- Removed: `hud/PauseMenu.ts`, `hud/MenuModel.ts` (and its test).

Gotchas learned:

- Inside the game, keyboard menu input arrives twice (window key → intent, and the browser's native button activation). `UiService` (driven mode) prevents the native default for Enter, Space, and Up/Down; Left/Right, Tab, and text fields stay native.
- preact typings reject `role="dialog"` on `<aside>`; use a `div`.
- `@playwright/test` uses Chromium build 1243 here; a bare `playwright` script needs `executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'`.
- Transitions queue (never overlap). Only the covering half blocks input (`ui.covered`); during the reveal the new screen already takes taps and keys, so an early Enter is never lost.
- Measure element sizes only after `document.getAnimations()` settle: WebKit reports mid-scale boxes (47.8 px for a 48 px button).
- `?test=1` boots straight into the level; browser tests that need the Title must add `&flow=1`.

Deferred on purpose: Title Settings/Credits (2B and later), attract loop (2D), "Skip tutorial" (2C); Pause Settings, Controls, Difficulty, "Restart from checkpoint" with those features; haptics (7B); UI navigation for left/right intents (gamepad sliders/tabs) with the 2B rebinding work.

Art & sound A: `npm run art:bake` (Blender `bpy` + Pillow, dev machine only) renders tools/blender/{hero,crawler,shard,terrain,backdrop}.py into public/assets/global/ and refreshes the manifest hashes. Frame sheets are described in `src/render/world/SpriteSheets.ts` (`SHEETS`, `HERO_ANIMS`, `heroFrame`, `sheetScale`); frames are added when a baked file is swapped in (`createGame` texture store) and by the painters' grid fallbacks. `PlayerSprite` draws rim + body + slot-tinted accent. `TerrainView` front faces are tileSprites of `terrain_front`. `npm run audio:build` (ffmpeg) turns pinned Kenney CC0 packs (`npm run assets:fetch` first) into public/assets/audio/*.webm|*.m4a and the manifest's `audio` entries; `SoundEngine.setSamples` decodes them (Opus first where supported, then AAC) and falls back to synth recipes per key.

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

What 1F added: replays v3 (hash every 60 ticks, first-divergence report), the `arena_autopilot` golden, in-level replay record/playback and a `?debug=1` panel (Export/Import replay), a 200-entry log ring buffer with global error handlers, a recovery panel for scene errors, the boot guard and Safe Mode screen, `QualityGovernor` (first tier from capabilities, p95-driven drops and raises at scene boundaries), leak and memory counters (`?test=1`), the performance overlay toggle in the pause menu, and docs/DEVICES.md. Pass 1 is done except the owner's phone checks.

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

What 1E-3 added:

- `src/audio/`: `SoundEngine` (one context created on the first gesture; buses master → {music, sfx, ui, voice, ambience}; master limiter −3 dB / 20:1 / 3 ms / 250 ms; voice caps sfx 24, ui 6, ambience 4, voice 2 through `VoicePool`; 40 ms repeat guard; quietest-then-oldest stealing; ±3–5% pitch variation from a render-side generator; pan and off-screen attenuation from `Spatial`; music ducking; `stopLoops`), `SynthRecipes` (every SFX key as data: tone and filtered-noise layers), `GameAudio` (events → sounds once per tick, jetpack loop, low-HP heartbeat, shard pitch chain), `AudioTypes`, `StressTest` (test-only offline render, loaded on demand).
- `src/app/AudioUnlock.ts`: unlock on the first pointer, touch, or key gesture; suspend when hidden, resume on return (every gesture also resumes, for iOS). Phaser audio stays disabled.
- `src/render/fx/FallTracker.ts`: fall heights per landing, shared by effects and audio (the simulation has no fall field).
- Test hooks: `__CD_TEST__.audio.{stats, limiter, stress}`.
- `tests/sim/arena-run.test.ts`: the arena autopilot (acceptance for "plays start to finish").

Deferred on purpose: haptics come with Capacitor Haptics in 7B (a new dependency then); music tracks and ambience loops arrive with content (the music bus and ducking exist); real recorded SFX replace synth recipes through the asset pipeline (`audio:build`, spec 10.5) when they exist.

Previous next-step note (kept for reference): Pass 1E-3 (audio): `SoundEngine` with buses master → {music, sfx, ui, voice, ambience}, limiter (−3 dB, ratio 20, 3 ms attack, 250 ms release), polyphony caps (sfx 24, ui 6, ambience 4, voice 2), 40 ms minimum repeat, oldest/quietest stealing, synthesized SFX for every event above, unlock on the first gesture, suspend on interruption. Then 1F.

Next: Pass 1F (hardening and acceptance): replay export/import (dev), the 50-restart leak test with pool/listener/timer/texture/audio-node counters (M8, O5), error handlers and Safe Mode (§19), memory counters, basic adaptive quality (O6; replaces the software-renderer rule), state-hash tooling, the device record, and the Pass 1 checklist.
