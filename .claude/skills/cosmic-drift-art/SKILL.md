---
name: cosmic-drift-art
description: Use before making, importing, recoloring, or reviewing any Cosmic Drift art, VFX texture, or sound (procedural painters, CC0 packs, AI or Blender assets). Holds the Neo-Celestial rules, palette, and the asset pipeline for this repo.
---

# Cosmic Drift art and asset pipeline

The spec (docs/MASTER_SPEC.md §9, §10.5, §13.7–13.8) is the authority; this is the working summary.

## Look (Neo-Celestial, §9.1)
- High-resolution 2.5D vector/painted style. Never pixel art, thick cartoon outlines, noisy cyberpunk clutter, or flat neon everywhere.
- One key light from the upper left, cool ambient fill, restrained emissive accents, broad shapes with rounded bevels.
- Foreground tiles stay at least 40% apart in luminance from the parallax layers behind them.
- Slabs: lit top lip + planet rim, 14 u recessed back face, camera-driven side faces (`TerrainView`).

## Palette (§9.2)
Deep Cosmos #080B1A · Abyssal Navy #0F172A · Slate Hull #1E293B · Titanium Gunmetal #334155 · Cool Steel #64748B ·
Electric Cyan #00F5D4 (accent, player tech) · Starlight Gold #FFB703 (shards, currency) · Nebula Violet #A855F7 (cores) ·
Neon Crimson #FF2A85 (danger) · Magma Amber #FB923C (warning).
Planet rims: Kepler #00F5D4 · Vulcanis #F97316 · Cryos #7DD3FC · Aether #C084FC · Obsidian #FF2A85.
Use `Palette` / `PlanetRim` / `UiTokens` from `src/theme/ThemePalette.ts`; never hard-code a new color.

## Where art comes from (best first)
1. **Hero art** (Kes and crew, bosses, portraits, planet key art): custom or AI-generated images the owner approves, placed in
   `assets_src/` and listed in `public/assets/ASSET_MANIFEST.json` under the existing key. Reference sheets live in `assets_src/_reference/`.
2. **CC0 packs** from `tools/assets-fetch/packs.json` (`npm run assets:fetch`): particles, smoke, UI sounds, impacts, lasers.
   Always recolor to the palette (white/greyscale source × palette tint, additive for glows) and add a `LICENSES.csv` row.
   Add a pack by appending it to packs.json pinned to a commit, with its license checked in the pack's own license file.
3. **Procedural painters** (`src/assets/painters/NeoCelestial.ts`): the built-in fallback for every key. Keep them deterministic.
4. **Blender bakes** (24-frame spinners, props): only when Blender/bpy is installed; see the `blender-*` skills.

## Rules that keep it shippable
- Every drawn texture key is in the manifest (`tests/unit/procedural-art.test.ts` checks this).
- Replacing art never needs code: same key, same frame names (strips name frames "0".."N").
- Textures ≤ 2048 px; character height 2× density (§9.4); sparse effects as sprites, not full-screen layers.
- Effects: per-effect particle budgets, global caps 300/600/1200 (Battery/Balanced/High), render-side RNG only.
- Sound: synth recipes in `src/audio/SynthRecipes.ts` are the fallback per key; recorded files replace a key, normalized to −16 LUFS.
- Provenance for every shipped file in `assets_src/LICENSES.csv` (`key, source, author_or_tool, license, date, prompt_or_seed, notes`).
