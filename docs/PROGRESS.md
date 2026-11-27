# Progress

| Pass | Status |
| --- | --- |
| 0 | DONE, approved. |
| APK pipeline test (slice of 7B, approved early) | Debug APK builds in CI on every push. Signing secrets added by the owner. Releases start from Actions → Release → Run workflow (the agent cannot push tags). `0.0.1` published 2026-11-25 (release run 45609929624, signed APK 3.66 MB). |
| 1A | DONE, approved. |
| 1B | DONE, approved (CI run 45607110857). |
| 1C | DONE and green in CI (run 45620958633: verify, perf:bench, Chromium and WebKit browser tests, Android debug build). |
| 1D | DONE and green in CI (run 45951307716). Released as `0.0.2` (release run 2, signed APK 3.68 MB). Device checks (2–3 fingers on a real phone, controller in the Android app) pending with the owner. |
| 1E | DONE and green in CI (1E-1 run 45953613318, 1E-2 run 45958847738, 1E-3 run 45961388044 after a fix: CI's Chromium 159 needs `startRendering` to tell offline audio contexts apart). Parry and slam are deferred to 3A, where the spec schedules them in full. Release notes for `0.0.3` are ready; the owner can run the Release workflow. |
| 1F | DONE (CI green, run 45994813905). Every automated Pass 1 checklist item passes; three items need the owner's phone (marked below). |
| Art & sound A (owner-requested, between 1F and 2A) | DONE (CI green, run 46025975171). Blender-baked animated hero, Crawler walk cycle, shard spinner, slab panels, skyline; 18 recorded CC0 sounds plus footsteps. Version 0.0.4 with release notes. |
| 2A | DONE (CI green, run 46045057262; merged as #4). Awaiting the owner's OK for 2B. Preact UI layer, tokens, components, motion, Title, Pause, photosensitivity notice, fade and iris transitions, dev gallery. |
| 2B-1 | DONE locally (CI pending). Settings model (Zod, per-field fallback, per device), Settings screen with every §8.6 tab, live apply, simulation assists. |
| 2B-2 … 2B-5 | Not started |

## Pass 2B-1 evidence (2026-11-27)

- `npm run verify`: passes (371 unit, input, property, and simulation tests incl. settings schema/store/derived and assists; 7 golden replays unchanged; `levels:lint`; build). Bundle 458 KB gzipped (budget 900 KB); Vite warns that the main chunk is over its 1500 kB minified warning size (Zod).
- `npm run test:e2e` (Chrome, local): 59 of 59, including 11 settings tests (tests/e2e/settings.spec.ts). WebKit runs in CI.
- Persists and applies: master volume change reaches the mixer at once and survives a reload; mono and night reach the mixer; frame-rate cap applies at once; text size scales the UI; shoot toggle keeps firing until the next tap; difficulty (Easy) and infinite fuel apply at the restart; one invalid stored value falls back alone and is logged; Restore defaults resets only its tab; Esc closes only the pop-up (Title and Pause), focus returns to the opener.
- axe (WCAG 2.1 A/AA, `meta-viewport` excluded by owner decision) passes on all 8 Settings tabs, from the Title, and at 844 × 390, where the dialog fits the screen and scrolls inside.
- Simulation assists (tests/sim/assists.test.ts): hazard respawn without damage and invulnerability spare HP and shield; infinite fuel never drains; no assists hash exactly as before; replays carry assists and re-simulate to the same hash; malformed assists are refused. `perf:bench` 0.011 ms mean per tick.

## Pass 2A evidence (2026-11-27)

- `npm run verify`: passes (347 unit, input, property, and simulation tests incl. new UI tests; 7 golden replays unchanged; `levels:lint`; build). Bundle 436 KB gzipped (budget 900 KB).
- `npm run test:e2e` (Chrome, local): 48 of 48, including 12 new UI tests (tests/e2e/ui.spec.ts). WebKit runs in CI.
- "axe passes on every screen": WCAG 2.1 A/AA on the photosensitivity notice, Title, Pause, the quit confirmation, the gallery (every component and screen preview), the gallery modal, and the side sheet. No violations except the owner-approved `meta-viewport` exclusion (spec N14 keeps zoom off; DECISIONS 2026-11-27).
- "Every animation has a reduced-motion variant": unit test over every motion (reduced variants are opacity-only; full variants touch only transform and opacity); browser test: under `prefers-reduced-motion` the pause screen runs opacity-only animations and the iris falls back to a fade.
- "Transitions show no long tasks": the fade and iris run in the gallery with no long task over 100 ms (Chrome, software WebGL). **Mid-device check pending the owner's phone.**
- Flow: first launch shows the notice (focused Continue), then Title (focused Start, version string), Start fades into the level; the notice is remembered (`cd.photoNotice`). Pause → Quit asks first (Cancel focused), Escape closes only the dialog, Quit fades back to Title. Fonts load from this origin only. Touch targets ≥ 48 px at 844 × 390.

## Pass 1F evidence and the Pass 1 checklist (2026-11-27)

- `npm run verify`: passes (317 unit, input, property, and simulation tests; 7 golden replays incl. `arena_autopilot`; `levels:lint`; build).
- `npm run test:e2e` (Chrome, local): 36 of 36, including the acceptance run, replay export → headless re-simulation, 50 restarts, Safe Mode, error recovery, background/resume, and the overlay toggle.
- Replays v3 store a hash every 60 ticks; a changed input at ticks 130–159 is reported as first diverging at tick 180 (unit test).
- Device record: docs/DEVICES.md.

| Pass 1 checklist item | Status | Evidence |
| --- | --- | --- |
| `npm ci`, `npm run verify` pass | Pass | Above; CI on every push |
| Tests cover loop, collision, input, determinism | Pass | tests/sim, tests/input, property tests, goldens |
| Responsive canvas on desktop and mobile browser | Desktop pass; **mobile browser pending owner** | boot.spec (phone and desktop sizes in Chrome and WebKit) |
| No required-asset 404s; logged fallbacks | Pass | boot.spec (zero failed requests; broken manifest boots with fallbacks) |
| 60 fixed ticks/s; interpolation never changes outcomes | Pass | FixedLoop tests; acceptance replay renders and matches the headless hash |
| Background/resume pauses safely | Pass | hardening.spec (no tick burst, no teleport), blur test |
| Multi-touch combos | Automated pass; **real-device pending owner** | touch tests, CDP multi-finger tests |
| One finger never releases another; no ownership stealing | Automated pass; **real-device pending owner** | per-finger ownership tests, single-finger lift test |
| Deadzone, saturation, diagonals, no drift | Automated pass; **real-device pending owner** | input tests |
| Keyboard gives the same gameplay through `InputFrame` | Pass | devices tests, keyboard e2e, exported replay re-simulates |
| Full verb set, finish or restart the arena | Pass | arena autopilot (Normal and Hard), restart tests |
| Same seed + inputs ⇒ same hash; rendering/audio don't change it | Pass | goldens; in-browser playback of `arena_autopilot` matches |
| No uncaught errors, rejections, or unexplained requests | Pass | acceptance run: no page errors, no error log lines, no foreign requests |
| Handoff records devices, frame times, memory, limitations | Pass for what can be measured here; **owner phone numbers pending** | docs/DEVICES.md |

## Pass 1E-3 evidence and 1E acceptance (2026-11-27)

- `npm run verify`: passes (307 unit, input, property, and simulation tests; 5 golden replays unchanged; `levels:lint`; build).
- "The arena plays start to finish" (tests/sim/arena-run.test.ts): a closed-loop autopilot using only normal inputs finishes `test_arena` on Normal in 1691 ticks (28.2 s) with both checkpoints, all 3 Crawlers defeated, 13 shards banked, and no deaths; it also finishes on Hard; repeated runs are identical.
- "Restarts cleanly": ten restarts from the pause menu leave one HUD, no menus, and the same sprite count (browser test).
- "Audio never clips" (tests/e2e/audio.spec.ts): an offline render through the real engine graph of 198 sound starts in 0.5 s (every SFX at once, eleven times) peaks at 0.61 of full scale (−4.3 dBFS); the 24-voice SFX cap held and 174 voices were stolen. The limiter is built with threshold −3 dB, ratio 20, attack 3 ms, release 250 ms. The engine stays "locked" until the first key press, then runs; game events play sounds.
- "Reduced motion is respected": camera shake never above 25% (browser test); steady outlines instead of blinks and pulses; opacity-only pause menu; no floating damage numbers.
- Unit tests: voice pool (40 ms repeat guard, quietest-then-oldest stealing, pruning), stereo space (±0.6 pan, −6 dB per screen width off screen), shard pitch chain (semitone steps up to an octave, reset after 1.2 s), synth recipes (layer gains ≤ 0.35, ≤ 2 s, voice-limited buses, variation ≤ 5%), event → sound mapping (keys, positions, ducking on alerts, quiet small landings, jetpack loop start/stop, heartbeat every 900 ms at low HP, pause stops loops).
- `npm run test:e2e` (Chrome, local): 29 of 29.

## Pass 1E-2 evidence (2026-11-27)

- `npm run verify`: passes (294 unit, input, property, and simulation tests; golden replays unchanged, since nothing in the simulation changed; `levels:lint`; build). Layer rules: no violations, no cycles.
- New unit tests: menu intents from keys and pads (repeat rules, one step per press, stick hysteresis, held buttons ignored after a menu opens), menu selection, HUD model (percentages, low HP below 25%, heat, vent, dash cooldown, shards = banked + carried), FX math (trauma decay 1.6/s, shake = trauma², 25% cap under reduced motion, frame-rate independent follow, particle caps 300/600/1200), `groundDistance` (floor, pit, one-way, edge samples, moving platforms), procedural art vs. manifest (every painter and every drawn texture has a manifest key; 24-frame shard strip), software-renderer detection.
- `npm run test:e2e` (Chrome, local, software WebGL): 27 of 27, including: HUD at 280 × 18 with full bars and 0 shards; pause menu with arrows + Enter restarting the arena (player back at spawn, one HUD); mouse Resume; ten restarts in a row with no leftover HUD, menu, touch layer, or sprites; `WEBGL_lose_context` lose → paused with a notice → restore → resumes with no page errors; reduced motion detected with camera shake never above 0.25.
- Screenshots reviewed at 1280 × 720 and 844 × 390 (start, combat, pause menu, Battery look): slabs with rims and side faces, parallax, spinning shards, Crawler alert, HUD, pause panel.
- Software WebGL (SwiftShader, 2 cores): 17 ticks/s at 1280 × 720 and 55 at 844 × 390 after merging terrain rectangles and replacing the full-screen mote layer with 10 sprites (was 10 and 33). GPUs are not limited this way; real-device numbers come with the owner's checks.
- Bundle: 409 KB gzipped (budget 900 KB).

## Pass 1E-1 evidence (2026-11-27)

- `npm run verify`: passes (269 unit, input, property, and simulation tests; 5 golden replays re-recorded for the new arena and config; `levels:lint`; build). Layer rules: no violations, no cycles.
- Combat (tests/sim/combat.test.ts): 5 shots per second while held; 750 u/s bolts; heat +4 per shot, -12/s firing, -40/s idle; vent at 100 for exactly 72 ticks, then firing resumes; continuous fire overheats after about 12.5 s; bolts stop at walls and vanish after 1200 u; manual aim; auto aim picks the nearest enemy in the 30° cone with line of sight and fires straight otherwise (outside the cone, beyond 900 u, behind a wall); property test: no bolt ever crosses a wall at any angle.
- Crawler (tests/sim/enemies.test.ts): patrols at 120 u/s inside its bounds; turns at ledges and walls; sleeps beyond 1400 u, wakes inside it, sleeps again beyond 2200 u; 0.4 s alert, then the 21-tick telegraph, then a 260 u/s charge; the charge deals 15 damage shield-first with knockback, once per invulnerability window; jumping over the charge avoids it; three blaster hits defeat it and its 3 drops land and can be collected; difficulty scales HP (Easy 24, Hard 35), damage (Easy 8), and telegraphs (Hard 19 ticks, never under 18).
- Progress (tests/sim/progress.test.ts): magnet and pickup radii; shard lines; checkpoint banks shards, restores health, moves the respawn; death loses carried shards, returns them to the level, removes drops, resets enemies (fresh IDs), respawns at the checkpoint; with sections only the respawn section resets; the exit completes once and banks shards; parser rejects elites and `requires` until they exist.
- `npm run test:e2e` (Chrome, local): play tests 6 of 6, including X firing the blaster in the arena.
- `perf:bench` (4 players, 3 Crawlers, shards, moving platform, bolts): 0.009 ms mean per tick (budget 2 ms).

## Pass 1D evidence (2026-11-26)

- `npm run verify`: passes (244 unit, input, property, and simulation tests; 5 golden replay tests; `levels:lint`; build).
- `npm run test:e2e` (Chrome, local): 20 of 20 pass, including the new play tests: keyboard run/jump/pause/resume; blur releases a held key and pauses, nothing moves until the key is pressed again; a mocked standard gamepad moves with the stick and jumps with A; real CDP touches hold the stick and Jump together and release-all clears both; lifting only the Jump finger keeps the stick moving, and touchcancel stops it.
- Spec 14.5 unit tests (tests/input): two and three fingers; releasing Jump while moving; touch cancel per finger; a finger sliding across another control keeps its own; resize mid-touch keeps ownership; orientation change releases everything and old fingers stay released; two fingers on one button (first owner wins); no-drift deadzone; diagonal normalization; sub-tick tap latching; blur, page hide, orientation change, pointer cancel, and hidden visibility each release everything; a panel-open release; keyboard and touch together. Plus keyboard columns, key repeat, mouse aim, Esc/P/Start pause, gamepad standard mapping, D-pad, right-stick aim, refocus suppression, and hot-unplug.
- Not yet verified (needs the owner's devices): 2–3 simultaneous touches on a real phone; a controller inside the Android app; the iPhone PWA (spec 8.13 records).

## Pass 1C evidence (2026-11-25)

- `npm run verify`: passes (206 unit, property, and simulation tests; 5 golden replay tests; `levels:lint` 1 level, 0 failed; build).
- `npm run test:e2e` (Chrome, local): 15 of 15 pass (no app-side changes in 1C).
- Derived reach (spec 4.1) reproduced on all five planets, every column: full-jump apex within 0.7 u, flat distance exact, base jetpack apex within 0.2 u, jetpack distance exact (Kepler 201.5 / 392 / 343.0 / 910 u). Tap jump 77 u at 1.0x gravity and above 64 u on every planet. Dash 183.3 u.
- Every 4.1 rule has a scripted headless test: coyote (7 ticks yes, 8 no, no double jump), jump buffer (7 ticks before landing yes, 8 no, no auto-repeat), jump cut (0.45, once, after 3 ticks), wall slide (260 u/s, refreshes air dash, recharges fuel), wall jump (520 / -980 x sqrt(g), 7-tick stick lock, same height on Kepler and Vulcanis within 4 u), jetpack (engages at the apex, exactly 60 ticks of thrust, approaches -140 u/s, 0.55/s ground recharge), dash (10 ticks, no gravity, one air dash, 57-tick cooldown, 8 i-frames, walls end it), corner correction (8 u slips, 12 u bonks, never into a wall), ledge forgiveness (10 u pops, 15 u blocks, also while dashing), one-way (jump through, catch at terminal speed, drop-through with grace, then the lower platform catches), ice (0.25x deceleration).
- Moving platforms: ping-pong with end waits, riders carried, jump inherits velocity capped at 300 u/s, elevators lift, crushing against the floor or a wall gives a hazard respawn and never leaves the player inside geometry.
- Hazards (spec 4.3): spikes, lava, pits, kill planes; 25 damage shield-first; 0.5 s fade with the move at the midpoint; respawn on safe ground at least 1 s old, 2 tiles from hazards, never inside `no_safe_ground`; invulnerability blocks damage but not the respawn; death at 0 HP restores at the spawn after 1.2 s; shield recharges 20/s after 3 s; dash i-frames block hazard damage.
- No tunneling (property tests, fixed seeds): 400 random maps x moves of up to 400 u per axis never cross a solid tile or a one-way top; 100 random maps with random inputs and injected velocities up to 3000 u/s, plus 15 random four-player runs of the test arena, never end a tick with a player inside solid geometry.
- Robustness: NaN, Infinity, and 1e300 velocities neither hang a tick nor slip past the N11 assertion; the level parser never throws on 500 random JSON values and rejects 19 classes of bad level files with readable errors.
- `perf:bench` (4 players, test arena, moving platform): 0.005 ms mean per tick (budget 2 ms).

## Pass 1B evidence (2026-11-25)

- `npm run verify`: passes (117 unit, property, and simulation tests; 5 golden replay tests; layer rules 0 errors).
- Same seed and inputs give identical state hashes every 60 ticks in two scripted scenarios (2 players on Kepler, 4 players on Vulcanis Hard); a different seed changes the hash; a mid-run snapshot resumes to the identical final hash.
- dt spike: a 5 s frame runs exactly 4 ticks (no teleport) and the dropped backlog never returns; pause and resume never simulate paused time; 60 Hz, 144 Hz, 30 Hz, and uneven frame timing all reach the identical hash at tick 600.
- Spec 4.1 derived reach reproduced on all five planets (full-jump apex within ±2 u, flat jump distance within ±2 u).
- Golden replays reproduce their hashes through `npm run test:golden` and the CLI (`npm run replay:run -- tests/golden/replays/basic_movement_kepler.json`).
- `perf:bench`: 0.001 ms mean per tick with 4 players (budget 2 ms; players only so far).
- Negative checks: a Phaser import planted in `src/core` fails `deps:check` (now a permanent canary test); `Math.random`, `Math.sin`, `Math.pow`, `**`, `window`, `Date.now`, and `performance.now` in `src/core` all fail ESLint.

## Pass 1A evidence (2026-11-25)

- `npm run verify`: passes (format, lint, typecheck, layer rules, stub scan, 74 unit and property tests, golden placeholder, levels guard, build).
- Browser tests in Chrome (sandbox): 15 of 15 pass.
  - Boots cleanly at 844x390 (phone 19.5:9) and 1280x720 with zero failed requests, zero page errors, zero asset warnings.
  - A stalled star-field file falls back after the 1500 ms per-file timer (whole boot under 5 s), with exactly one warning, in Chromium and WebKit.
  - A 404, a corrupt PNG, and a malformed manifest all fall back with no errors.
  - With WebGL blocked, the "Graphics are not available" screen shows, its button is focused, and no canvas is created.
  - `?debug=1` shows the rounded FPS badge (FPS, EMA frame time, p95).
  - Ctrl+wheel, Ctrl+plus, and double-click zoom are blocked; plain wheel is not.
  - Earlier canvas checks (5 aspect ratios and live resize) still pass.
- Bundle: about 374 KB gzipped (budget 900 KB).

## Not verified yet

- Real phones (Android app, iPhone Safari). Owner to install the APK once the release is published.
- WebKit (Safari engine) runs in CI only (passing).

Distribution plan: Android sideload APK (built in GitHub Actions) plus an installable PWA for iPhone/iPad. Native iOS is optional and paid.
