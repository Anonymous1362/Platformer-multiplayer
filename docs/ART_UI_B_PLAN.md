# Art & UI B: Production Plan

Owner-requested milestone, out of the §23 order. It gives Cosmic Drift its premium look: a dark, realistic, atmospheric sci-fi style. Owner references (for feel only): Metroid Dread's readable action and hard light, Inside's fog and silhouettes, Little Nightmares 2's dusk and depth. Nothing is copied: no shapes, characters, designs or palettes are taken from those games.

This plan runs like a small studio. The owner is the **Art Director** and approves every gate. Claude on **max** is the **Lead**: it makes the decisions, builds the tools, makes the first asset of each kind, and reviews. **Ultracode** workflows are the **production crew**: they make many assets in parallel on the Lead's rails, and reviewers check every asset before it ships.

## 1. Phases and gates

| Phase | Mode | What happens | Owner gate |
| --- | --- | --- | --- |
| **B0 Pre-production** (done) | max | Studio kit, new hero and Crawler designs, the style test (one Kepler scene in looks A, B, C, built from engine-style layers), this plan, the workflow script draft. | **Pick a look** (or a mix, naming the parts). |
| **B1 Look lock** | max | Art Bible v2 (`docs/ART_BIBLE.md`). An ADR replacing spec §9.1/§9.2 with the picked look. Colour-blind palettes recomputed and tested. Shared style tokens (one JSON read by Blender and `ThemePalette.ts`). Asset spec sheet. QA thresholds. **Engine proof:** the test arena in the real game, with the engine-side pieces built (rim-light filter, fog sheets, light shafts, post chain), screenshotted next to the lookdev frame. | Approve the in-game screenshot against the lookdev frame. |
| **B2 Production** | ultracode, medium | Four batches, one per step: **B2a** characters, **B2b** environment kit and parallax, **B2c** effects and post (code), **B2d** UI. Each batch runs build → automatic QA → three-lens review → fix loop → one integrator → verify → CI. | Review each batch (screenshots, web build, APK). |
| **B3 Polish and release** | max | Performance on the Mid device (atlas sizes, memory, frame time), reduced motion and photosensitivity, colour-blind check, grayscale readability pass, device test, release 0.0.6. | Play the release. |

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
| B2d | UI | Title screen (Blender backdrop and logo), HUD (thin segmented bars as in lookdev), menu skin via `tokens.css`, touch-controls skin, icon set (SVG), button feedback and UI sounds. |

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

`.claude/workflows/art-ui-b-production.js` is a saved workflow. It's a draft until B1 locks the look. It runs one batch per call:

```text
ultracode medium, Art & UI B production batch B2a with look <picked>
```

Or run the saved workflow `art-ui-b-production` with args `{ "batch": "B2a", "look": "B" }`. Its stages:

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

## 8. What the owner decides now

1. **Pick a look: A Hush, B Ember Dark, or C Verdigris Dusk.** You can also mix them, for example "B's lighting with A's fog".
2. Hero and Crawler designs: keep, or list changes. These are lookdev v3 and get refined in B1 and B2.
3. Say "go B1" when ready.
