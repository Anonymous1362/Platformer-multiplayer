/**
 * Texture keys the level scene draws, in one Phaser-free module so tests can check them against the
 * asset manifest (every key must be listed there so real art can replace the procedural version).
 */
export const PARALLAX_TEXTURES = [
  'bg_nebula',
  'bg_starfield',
  'bg_dust',
  'bg_megastructure',
  'fx_glow',
] as const;

export const LEVEL_TEXTURES = [
  'terrain_side',
  'terrain_top',
  'terrain_front',
  'char_hero',
  'char_hero_accent',
  'enemy_crawler',
  'pickup_shard',
  'fx_bolt',
  'fx_glow',
  'fx_shadow',
  'fx_ring',
  'fx_beam',
  'fx_vignette',
] as const;
