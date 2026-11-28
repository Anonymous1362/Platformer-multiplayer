# Art & UI B: Production Plan

Owner-requested milestone, out of the §23 order. It gives Cosmic Drift its premium look: a dark, realistic, atmospheric sci-fi style. Owner references (for feel only): Metroid Dread's readable action and hard light, Inside's fog and silhouettes, Little Nightmares 2's dusk and depth. Nothing is copied: no shapes, characters, designs or palettes are taken from those games.

This plan runs like a small studio. The owner is the **Art Director** and approves every gate. Claude on **max** is the **Lead**: it makes the decisions, builds the tools, makes the first asset of each kind, and reviews. **Ultracode** workflows are the **production crew**: they make many assets in parallel on the Lead's rails, and reviewers check every asset before it ships.

## 1. Phases and gates

| Phase | Mode | What happens | Owner gate |
| --- | --- | --- | --- |
| **B0 Pre-production** (done) | max | Studio kit, new hero and Crawler designs, the style test (one Kepler scene in looks A, B, C, built from engine-style layers), this plan, the workflow script draft. | Done: the owner picked **look B "Ember Dark"** (2026-11-28). |
| **B1a Look lock** (done, waits for approval) | max | The style test redone with the owner's feedback (`docs/art/look-lock/`). `docs/ART_BIBLE.md` and an ADR replacing spec §9.1/§9.2. The `cosmic-drift-art` skill rewritten for look B. This plan updated with the feedback map (§9). | Approve look B v2 and **pick Kes's colour key**. |
| **Craft pass** (Step 2 in `docs/ROADMAP.md`) | max | The owner's second round of feedback: a designed platform (chiselled rock blocks, crisp bevels, an overhanging lip, hairline cracks only on the walk top, no gravel, cliff face as in B0) in two finishes (sculpted and textured, or inked hand-drawn with Grease Pencil line art); big rocks and crystal shards in front of and behind the walk line; Kes as a man in darker B0 colours with crisper armour and no glow or outline; dim, randomly flickering crystals with a burst event (cracks glow, the tip shatters open, it stays broken); an idle GIF; Gemini's fixes (mist in the chasm, truss catwalk with shard light on the deck, chunky survey pylon, Heartstar corona with angled rays, crystal internal depth, misty background cliffs, *Lantern* hull plates in the ground). | Pick a finish and Kes's colours. |
| **B1b Engine proof** | max or extra | The test arena in the real game in look B, side by side with the lookdev frame, plus a short video from the game. It brings the engine pieces: screen-space rim, fog sheets, shafts, motes, per-foot contact shadows, the post chain per quality tier, and the crystal flicker and flare system. It also brings the in-game palette and tokens (`ThemePalette.ts`, `tokens.css`, slot colours, CVD alternates and their test) and one shared style-token file read by Blender and the game. | Approve the in-game screenshot and video against the lookdev frame. **Then switch to ultracode.** |
| **B2 Production** | ultracode, medium | Five batches, one per step: **B2a** characters, **B2b** environment kit, parallax and ambient life, **B2c** effects and post (code), **B2d** UI, **B2e** sound. Each batch runs build → automatic QA → three-lens review → fix loop → one integrator → verify → CI. | Review each batch (screenshots, web build, APK). |
| **B3 Polish and release** | max | Performance on the Mid device (atlas sizes, memory, frame time), reduced motion and photosensitivity, colour-blind check, grayscale readability pass, device test, release 0.0.6. | Play the release. |

**Owner decisions of 2026-11-28 (Step 1)** also shape these batches: Kes is a man; four touch buttons (Jump/jetpack, Shoot, Dash, Action); invisible checkpoints (no checkpoint beacon art); world moments, thoughts and hints (spec §7.7); tension audio (breathing, heartbeat, music drop-out) and layered foley in B2e; parry glint and enemy shell debris in B2c. The full step order is in `docs/ROADMAP.md`.

**Effort levels:** "Extra" (one step below Max) suits most steps. Max is for look decisions, stubborn bugs and final reviews. Ultracode agents run at whatever level the session uses.

Manual mode applies to every row: each step is green locally and in CI, docs are updated and pushed, then the step stops for the owner.

## 2. Why max and ultracode split this way

- **Max (one strong agent, deep reasoning)** does what needs taste and one consistent mind:
  - art direction choices and the style test;
  - the shared tools;
  - the first asset of each kind, which becomes the template;
  - integration architecture;
  - final review.
- **Ultracode (many agents, adversarial review)** does volume: many similar, separable assets built in parallel, each checked by independent reviewers through different lenses.

Max writes the rails, and ultracode runs on them. Without rails (a locked look, shared tools, templates, automatic checks), parallel agents drift apart in style. That drift is exactly the "AI look" the owner wants to avoid.

Machine note: this container has 4 CPU cores. Workflow concurrency is min(16, CPUs − 2) = **2 agents at a time**, and Blender renders use every core. Ultracode therefore buys review depth and consistency here more than speed.

## 3. The studio kit (`tools/blender/studio/`)

Every asset is made with one shared pipeline, so everything matches:

| Module | Role |
| --- | --- |
| `looks.py` | The style anchor: palette, both light rigs, fog, grade, HUD colours per look. Becomes shared JSON in B1. |
| `stage.py` | Scene setup (Cycles, AgX), scale rules (1.8 m hero = 104 u; 1 u = 1 px at 1080p; sprites at 2×), cameras, per-layer renders. Two rigs: `rig_world` (dramatic; environments are never mirrored) and `rig_sprite` (flip-safe: high frontal key, rim straight behind, so `flipX` sprites still match). |
| `figure.py` | Characters: one continuous Skin-modifier body driven by FK joints through Hook modifiers, plus armour plates fitted (shrink-wrapped) once at rest and then rigid. No gaps at joints, and every pose stays on-model. |
| `shapes.py` | Deterministic modelling: crystals, clusters, displaced rocks, swept cliff profiles, lofts, rounded primitives. |
| `mats.py` | One material language: rock (lit walkable tops, strata), crystal (veins, fresnel, tip glow), hard surfaces (edge wear, cavity darkening), glass, emissive. |
| `comp.py` | 2D compositing with the same maths the game uses (premultiplied alpha, sRGB). Covers fog and aerial perspective, additive light, rim-light layer, bloom, grade, vignette, grain, and QA images (grayscale, boards). |

Lookdev lives in `tools/blender/lookdev/`. Run it with `npm run art:lookdev` (full quality) or `python3 -I tools/blender/lookdev/style_test.py --quick B`.

**The engine-faithful rule.** A lookdev frame may only use what the game can draw:

- a painted sky;
- fogged parallax layers;
- the gameplay layer;
- sprites, mirrored with `flipX`;
- contact shadows;
- additive shafts and motes;
- a blurred foreground;
- the post chain;
- the HUD.

Live 3D volumetrics are not allowed. This keeps every frame a promise the engine can keep.

## 4. Asset list for B2 (sizes in game units; textures at 2×)

| Batch | Asset | Spec |
| --- | --- | --- |
| B2a | Kes body sheet plus slot-accent mask | All player clips in §9.4 that sprites can cover now: idle, run, jump rise/apex, fall, land, wall slide, wall jump, jetpack, dash, hurt, death, revive. Feet on the bottom row. Same layout family as `HERO_ANIMS`. PartRig stays a later milestone. |
| B2a | Crawler sheet | walk 8, alert 4, telegraph 4 (≥ 300 ms read), charge 6, hurt 2, death 8. |
| B2a | Pickups | Star Shard spinner (24 frames), checkpoint beacon (idle, activate), exit gate. |
| B2b | Kepler tileset | Solid slab tiles (top, face, edges, corners, extruded side faces per §9.3), one-way grate set (left, mid, right) with a different silhouette and material from solid rock. |
| B2b | Set pieces | Floating islands (3), crystal decor (5), survey beacon, wreck debris. |
| B2b | Parallax | Sky with the Heartstar (colour per act, §2.7), far, mid and near layers tiling horizontally, foreground props, fog sheets, mote sprites. Five layers at the §9.3 depth factors. |
| B2c | Effects and post (code) | Rim-light filter, fog sheets, light shafts, contact shadows, thruster ribbon, dash streak, muzzle flash, hit sparks, shard burst; bloom, grade, vignette and grain per quality tier. Reduced-motion variants and photosensitivity limits for all of them. |
| B2b | Ground detail | Cracks, lichen, grit and loose stones on tops; a crumbling broken edge with rubble; hanging roots. All in the tiles and props, as in look B v2. |
| B2b | Ambient life | Crystal mites (sprites plus crawl paths on faces and undersides), the Lantern wreck (mid layer, smoke, fire glow, stuttering lamps), the giant in the haze (far layer, rare and silent). Art Bible §8. |
| B2c | Crystal system | Per-crystal flicker (own noise, never in step), rare random flares with sparks (also when Kes lands nearby), a cap of one flare on screen, reduced-motion variants. |
| B2c | Shard pickup | The 3D spin slowed to one turn every 2 s; pickup burst; a light streak flies to the HUD counter; the counter pops. |
| B2d | UI | Title screen (Blender backdrop and logo), HUD (thin segmented bars as in lookdev; the shard counter receives the pickup streak), menu skin via `tokens.css`, touch-controls skin, icon set (SVG), button feedback and UI sounds. |
| B2e | Sound | Ambience bed (wind, distant hum, cave room tone) with a reverb send for echo. Mite clicks, drips, crystal chime and flare. A recorded jetpack loop (only synthesized today). A shard pickup chain with rising pitch. Footsteps per surface (gravel, metal grate). Existing recorded keys stay: footsteps, jump, land, shoot, dash, Crawler alert, hurt and death, shard pickup. |

## 5. Quality gates (every asset)

Automatic, in `tools/blender/studio/qa.py` now:

- sheet size within the atlas budget (≤ 2048 px a side) and frame count;
- feet line on the bottom row in grounded frames (±1 px);
- no frame clipped at its cell border;
- no dark alpha fringe;
- file hash, so a re-bake proves determinism.

Added in B1:

- seamless loops;
- the whole-set memory budget for the Mid device;
- value contrast of characters against their surroundings (from the lookdev metrics).

The readability lens checks that the danger colour is used only on threats.

Review lenses, one agent each:

1. **Bible:** matches the Art Bible and the locked lookdev frame (palette, light, materials, shape language).
2. **Readability:** grayscale silhouette at gameplay scale (1×), value separation, facing reads at a glance, telegraphs visible.
3. **Technical:** QA output, the engine's import rules, frame timing.

P0 and P1 issues loop back to a fixer, at most twice. Anything still open is reported to the Lead, never shipped silently.

## 6. The ultracode workflow

`.claude/workflows/art-ui-b-production.js` is a saved workflow. Look B is locked; the job specs follow the Art Bible. It runs one batch per call, after B1b is approved:

```text
ultracode medium, Art & UI B production batch B2a
```

Or run the saved workflow `art-ui-b-production` with args `{ "batch": "B2a" }` (batches B2a to B2e). Its stages:

1. **Build:** one agent per asset job. Each agent owns disjoint files and never edits shared files.
2. **QA:** three review lenses in parallel.
3. **Fix:** at most two rounds per asset.
4. **Integrate:** one integrator is the only writer of shared files (manifest, `SpriteSheets.ts`, `TextureKeys.ts`, `ThemePalette.ts`, credits) and runs `npm run verify`.
5. **Verify:** adversarial checks:
   - an engine screenshot against the lookdev frame;
   - regression (verify, e2e, golden replays unchanged);
   - performance;
   - cross-asset consistency.

The Lead reviews the result, commits, opens the PR and stops for the owner.

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Assets drift in style across agents | One look file, one kit, templates first (max), and the bible lens on every asset. |
| The "AI look" | No generative images. Everything is modelled and lit in Blender from code under one rig, then reviewed against the lookdev frame. |
| Mirrored sprites contradict the light | Flip-safe sprite rig; directional drama lives in environments, which are never mirrored. |
| The frame can't be reached in-engine | The engine-faithful rule, plus the B1 engine proof before any volume work. |
| Phone performance | Pre-rendered sprites, atlas budgets, post effects gated by quality tier, and the Battery preset keeping 3 parallax layers (§9.3). |
| Slow renders (4 cores) | Quick mode for iteration; full renders only for finals. |

## 8. What the owner decides now (B1a)

1. **Approve look B v2** (`docs/art/look-lock/board.jpg`), or list changes.
2. **Pick Kes's colour key:** Rust (recommended), Mustard, or the B0 colours.
3. Say **"go B1b"**: the real game in the new look, with a screenshot and a short video.

## 9. Owner feedback map (2026-11-28, on the style test)

| Request | Where | Status |
| --- | --- | --- |
| Look B | B1a | Locked (Art Bible v1). |
| Grainy or soft image | B1a | Grain cut to very fine; play plane supersampled; PNG master. The game draws sharp at the display's refresh rate. |
| Kes "pasted on", white or blue outline, colour off-theme | B1a | Warm human colour keys; the outline removed; rim only toward the star; feet planted (the back foot used to float about 4 cm); per-foot shadows. |
| Floor needs cracks; sharp edge | B1a (look), B2b (tiles) | Cracks, lichen, grit, stones, crumbling edge with rubble, roots. |
| "What's the ship?" (two cylinders) | B1a (look), B2b (asset) | It's the *Lantern*, Kes's crashed ship (story prologue). Rebuilt to read as a ship, with fire and smoke. |
| Crystals glow and flicker at random times, sometimes burst | B1a (still), B1b (engine), B2c (system) | Each crystal glows at its own level; the catwalk crystal shown mid-flare. |
| Shard spin, pickup flying to the counter, crisp sound | B2a, B2c, B2d, B2e | It is a real 3D spin already (24 frames); it gets slower, with the flight to the counter and a chain sound. |
| Many smooth animation frames | B2a | Frame targets in Art Bible §9 (for example run 16, idle 16, death 12). |
| Sounds: footsteps, jump, fly, shoot, kill, pickup, shard burst | B2e | Footsteps, jump, land, shoot, dash, Crawler death and shard pickup exist (recorded). Jetpack is synthesized only. The crystal burst sound is new. |
| Tiny bugs with crawl sounds and echo | B1a (still), B2b, B2e | Crystal mites on the cliff face; clicks with echo. |
| A huge shape moving far away in the fog | B1a (still), B2b | The giant in the haze near the star: silent, rare, never an entity. |
| The failed release | Checked | Release #8 refused to re-release 0.0.5 at its first step; nothing was built or tagged, and nothing needs fixing. The next APK needs a version bump (0.0.6). |
