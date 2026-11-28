---
name: cosmic-drift-art
description: Use before making, importing, recoloring, or reviewing any Cosmic Drift art, VFX texture, or sound (Blender bakes, procedural painters, CC0 packs). Holds the locked look B "Ember Dark" rules, palette, readability rules, ambient-life rules, and the asset pipeline for this repo.
---

# Cosmic Drift art and asset pipeline

The authority is **docs/ART_BIBLE.md** (look B "Ember Dark", locked 2026-11-28; it replaces spec §9.1–§9.2). Also read spec §9.3–§9.9, §10.5 and §13.7–13.8. Production steps are in docs/ART_UI_B_PLAN.md. This file is the working summary.

## Look (Art Bible §1–§4)
- **Overall:** dark, lonely, realistic sci-fi at night. Never neon or flat cyberpunk colour.
- **Light:** a warm star key from the upper left; cool teal crystal light; small warm human lamps.
- **Atmosphere:** aerial perspective (far layers fade toward the sky), ground fog, soft light shafts, sparse warm motes, bloom on emitters only, grain very fine or off.
- **Target frame:** `docs/art/look-lock/look-B-v2.png`. Check every asset against it.

## Palette (Art Bible §2)
- Sky `#04070B`→`#13303A`; fog `#0F2229`; rock `#14181B`/`#21272B`, lit tops `#4D5653`.
- Crystal glow `#3FE0C8`; human lamps `#FF9E3D`; star key `#FFD9A0`.
- Friendly tech and ORRIN `#4FF0D8`; shards `#FFC24A`; cores `#A855F7`.
- **Danger `#FF3B2E` is for threats only.**
- Kes: rust suit `#9A5430` with graphite armour `#454A50` (recommended key; the owner picks).
- Until B1b moves `src/theme/ThemePalette.ts` and `tokens.css` to look B, game code still uses the old palette. Never hard-code colours in game code: use the theme modules.

## Rules that are easy to break
- **No all-round outlines or glows on characters.**
  - The sprite rig is flip-safe (no left/right light).
  - Side light is a screen-space rim on the edge facing the star, applied by the engine (or `comp.rim_light_dir` in lookdev).
- **Feet are planted:**
  - Both soles flat (`kes.plant`).
  - A soft contact pool plus a dark core under each foot.
  - Feet sink 1 px into the grit.
- **Nothing in sync:** flicker, blinking and idles get per-instance random timing. The kit gives each crystal cluster its own `glow`.
- **Ambient life stays off walkable tops and away from the player's path:** mites, roots, smoke, the far giant. It never uses the danger red and never collides. Under reduced motion it holds still or is absent.
- **Readability:**
  - Kes reads warm on cool.
  - Every enemy shows the danger red.
  - Pickups are gold and spinning.
  - Walkable tops are lit; one-way platforms look thin (grates and rails).
  - Telegraphs last at least 300 ms and change shape and value.
  - Every frame reads in grayscale.

## Where art comes from (best first)
1. **Blender with the studio kit** (`tools/blender/studio/`: stage, figure, shapes, mats, comp, looks, qa). It is deterministic (seeded; `zlib.crc32`, never Python's `hash`).
   - Characters: `figure.skin_body` plus plates fitted at rest.
   - Lookdev: `npm run art:lookdev`.
   - Bakes: `npm run art:bake`.
   - `bpy` 5.3: import `bpy` before `bmesh` or `mathutils`.
2. **CC0 packs** from `tools/assets-fetch/packs.json` (`npm run assets:fetch`): particles, smoke, UI sounds, impacts.
   - Recolour to the palette (greyscale source × tint, additive for glows).
   - Add a `LICENSES.csv` row.
3. **Procedural painters** (`src/assets/painters/NeoCelestial.ts`): the built-in fallback for every key. Keep them deterministic.
4. **No AI-generated images** (Art Bible §11).

## Shipping rules
- Every drawn texture key is in the manifest (`tests/unit/procedural-art.test.ts` checks this).
- Replacing art needs no code: same key, same frame names (strips name frames "0".."N").
- Run `python3 -I tools/blender/studio/qa.py SHEET --cell WxH --frames N --feet 3 --grounded RANGES` on every sheet. It checks size and budget, frames, feet line, clipping, fringe and hash.
- Textures ≤ 2048 px a side. Characters render at 2× density.
- Effects:
  - Per-effect particle budgets.
  - Global caps 300/600/1200 (Battery/Balanced/High).
  - Render-side RNG only (never the simulation's).
- Sound:
  - Synth recipes in `src/audio/SynthRecipes.ts` are the fallback per key.
  - A recorded file replaces a key, normalized to −16 LUFS.
  - Ambience uses a reverb send for echo.
- Provenance for every shipped file goes in `assets_src/LICENSES.csv` (`key, source, author_or_tool, license, date, prompt_or_seed, notes`).
