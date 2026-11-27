import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateManifest } from '../../src/assets/ManifestValidation';
import { NEO_CELESTIAL_PAINTERS, SHARD_FRAMES } from '../../src/assets/painters/NeoCelestial';
import { LEVEL_TEXTURES, PARALLAX_TEXTURES } from '../../src/render/world/TextureKeys';

const manifest = validateManifest(
  JSON.parse(
    readFileSync(new URL('../../public/assets/ASSET_MANIFEST.json', import.meta.url), 'utf8'),
  ) as unknown,
);
const keys = new Set(manifest.entries.map((e) => e.key));

describe('procedural Neo-Celestial art (spec 9.1–9.3)', () => {
  it('every painter has a manifest entry, so real art can replace it by key', () => {
    for (const key of Object.keys(NEO_CELESTIAL_PAINTERS)) expect(keys.has(key), key).toBe(true);
  });

  it('every texture the level scene draws is in the manifest', () => {
    for (const key of [...PARALLAX_TEXTURES, ...LEVEL_TEXTURES]) expect(keys.has(key), key).toBe(true);
  });

  it('textures stay small enough for any WebGL device (≤ 2048 px)', () => {
    for (const [key, spec] of Object.entries(NEO_CELESTIAL_PAINTERS)) {
      expect(spec.width, key).toBeLessThanOrEqual(2048);
      expect(spec.height, key).toBeLessThanOrEqual(2048);
    }
  });

  it('the Star Shard spinner is a 24-frame strip (spec 9.3)', () => {
    const shard = NEO_CELESTIAL_PAINTERS['pickup_shard'];
    expect(SHARD_FRAMES).toBe(24);
    expect(shard?.frames).toEqual({ width: 32, height: 32, count: 24 });
    expect(shard?.width).toBe(32 * 24);
  });
});
