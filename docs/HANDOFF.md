# Handoff

State: Pass 2A and all of Pass 2B are merged (#4–#8). **Art & UI B is in progress** (plan: docs/ART_UI_B_PLAN.md; PR #9 open with B0 and B1a). B0 is done: the owner picked **look B "Ember Dark"**. **B1a (look lock) is done and waits for the owner**: approve look B v2 (docs/art/look-lock/board.jpg), pick Kes's colour key (rust recommended, mustard, or the B0 colours), then "go B1b". Next: B1b engine proof (the test arena in the real game in look B, plus a short video; in-game palette and CVD test), then B2a–e production (ultracode, medium), B3 polish and 0.0.6. Then 2C (saves). Manual mode. Owner phone checks still open: docs/DEVICES.md and the 2A "no long tasks on a Mid device" check. The owner's Release #8 failed only because 0.0.5 was already released (nothing was built or tagged); the next release needs a version bump.

What B1a added (no shipped art or game code changed):

- docs/ART_BIBLE.md (look B locked; replaces spec §9.1–§9.2 by ADR). `.claude/skills/cosmic-drift-art/SKILL.md` rewritten for look B.
- Kit:
  - `shapes.crystal_cluster` sets a per-object `glow` (crc32 of the name).
  - `mats.crystal(per_object=True)` reads it.
  - `mats.rock(crack=True, lichen=hex)`; `mats.hull` (Voronoi plate tones, scorch).
  - `comp.rim_light_dir` (rim only on the edge facing the light; replaces the all-round `rim_light`).
  - `comp.smoke_plume`, `comp.shift`.
  - `looks.py`: B locked (`LOOKS['B']`), flip-safe sprite rig, `rim_engine`, finer grain, `lichen`.
- `kes.py`: `SCHEMES` (rust, mustard, bone), `recolor(look, scheme)` (reuses materials per scheme), `plant` (both soles flat; bisection on the higher leg's knee), pose `ready`, `sole_centres`.
- `kepler.py`:
  - ground: `gravel`, `rubble`, `roots`;
  - `mite`/`mites_on` (ray-cast onto the cliff face);
  - a new `lantern_wreck` (cockpit canopy, dorsal spine with the lantern beacon, wing, engine pods, fin, torn plates, ribs, cables, debris, fire light);
  - `watcher` (the giant, its own `giant` layer).
  - `WRECK`, `WRECK_BREAK`, `WATCHER` and `FLARE` constants.
- `tools/blender/lookdev/look_lock.py`:
  - renders look B v2 (play plane supersampled ×2, giant layer, three hero colour keys, close-ups incl. the wreck);
  - composes like the engine: per-foot contact shadows, sprites fogged like the play plane, rim toward the star, crystal flare with sparks, wreck smoke;
  - writes `look-B-v2.png`/`.jpg`, grayscale, `board.jpg`, `metrics.json`;
  - `--quick` for half size.
- The workflow `.claude/workflows/art-ui-b-production.js`: look B by default; new jobs ambient, crystals, shardflight; a B2e sound batch (ambience, sfx).

What B0 added (no shipped art or game code changed):

- `tools/blender/studio/`: `stage.py` (Cycles/AgX scene, scale rules: 1.8 m hero = 104 u, 1 u = 1 px at 1080p, sprites at 2x; `rig_world` and flip-safe `rig_sprite`; ortho/perspective cameras; `render_layer`; `to_px`), `figure.py` (`skin_body` with Hook-driven FK joints; `plate`/`ring` fitted at rest then frozen rigid), `shapes.py` (crystals, clusters, displaced rocks, `sweep` profiles, `loft`, rounded primitives; seeded), `mats.py` (rock, crystal, surface, glass, emissive), `comp.py` (premultiplied sRGB compositing: `over`, `add`, `fog` with sky colour maps for aerial perspective, `blur`, `resize`, `rim_light`, `bloom`, `grade`, `vignette`, `grain`, `gray`, text and boards), `looks.py` (three looks: palette, rigs, fog, grade, HUD).
- `tools/blender/lookdev/`: `kes.py` (Kes v3: skin body, fitted plates, two-tone helmet with wrap visor and ORRIN line, twin-pod jetpack, blaster; poses `aim`, `idle`), `custodian.py` (Crawler v3: dark carapace, danger seams and eye, bladed legs; pose `alert`), `kepler.py` (cliff ledge sweep, one-way survey catwalk on an anti-gravity crystal, floating island, beacon, crystal forest, rock spires, mesas, Lantern wreck, foreground), `style_test.py` (renders each look's layers and composes the frame like the engine; writes frame, grayscale, value-contrast metrics, board), `char_sheet.py` (fast character close-ups).
- `npm run art:lookdev` (full quality, about 14 min on 4 cores), `python3 -I tools/blender/lookdev/style_test.py --quick B` (half size, about 40 s per look; also copies each layer for inspection), or `--board` (rebuilds `board.jpg` from the saved frames, about 1 min).
- Outputs: `docs/art/style-test/` (`look-A-hush.jpg`, `look-B-ember-dark.jpg`, `look-C-verdigris-dusk.jpg`, grayscale copies, `board.jpg`, `metrics.json`).
- `.claude/workflows/art-ui-b-production.js`: saved ultracode workflow (draft until B1).
- `tools/blender/studio/qa.py`: sheet checks (size and budget, frame count, feet line in grounded frames, clipping, alpha fringe, sha256). On the shipped `char_hero.png` it finds dash frames 20–22 clipped at the cell border (replaced by the B2a sheet).

Gotchas learned (Blender 5.3 `bpy` here):

- `bmesh` and `mathutils` import only after `bpy`.
- Bind Hook modifiers only after `view_layer.update()`, or the joints' world matrices are still identity.
- A live shrink-wrap re-fits every pose and grabs whatever passes in front (an aimed arm over the chest stretched a plate 4.5 m); plates are fitted once at rest, then frozen.
- Skin radii: vertical chains take (front-back, side), chains along x take (side, up-down).
- Real 3D volumetric fog costs about 60 s per 1080p frame here and stays noisy; fog is composited per layer instead (also what the engine does).

Next steps (B1, on the owner's pick): write docs/ART_BIBLE.md and the ADR replacing spec 9.1/9.2; move the picked look into shared style tokens (one JSON for Blender and `ThemePalette.ts`) and re-derive the CVD palettes with the test; asset spec sheet and QA script; build the engine-side pieces (rim-light filter, fog sheets, light shafts, post chain) and screenshot the test arena next to the lookdev frame; update the `cosmic-drift-art` skill to the new look; finalize the workflow's job specs.


What 2B-5 added:

- `input/Bindings.ts` (actions, defaults, `padFamily`, `conflicts`, `bind`, `normalizeCode`, `isBindableCode`); `KeyboardMouseControls.setBindings` (one code may drive several actions while flagged); `GamepadControls.setBindings` (per family), `captureNext`, `connectedFamilies`, and new menu intents `left`, `right`, `prevTab`, `nextTab` (`MenuNav`), handled by `NavStack` (slider steps, radio and tab moves, bumper tab switching).
- `settings/BindingsStore.ts` (`cd.bindings`); `main.ts` applies bindings live; the UI context's `bindings` host gives the screen the store, connected families, and pad capture.
- `ui/screens/BindingsScreen.tsx` and `bindingLabels.ts` (key and button names, all through translation keys).

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
- Controller browser tests press a mocked button until the game has polled it twice (`__CD_TEST__.gamepadPolls()`): the game reads pads once per rendered frame, and on CI's software renderer a 120 ms tap could fall between two frames.
- Screenshot-heavy browser tests: CI's software renderer needs seconds per full-page screenshot, so the pseudo-locale audit runs one test per Settings tab (and per rebinding tab) rather than one long sweep that ran past its time limit in CI.
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
