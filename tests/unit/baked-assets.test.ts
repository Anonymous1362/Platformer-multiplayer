import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GameAudio, type SfxPlayer } from '../../src/audio/GameAudio';
import { isSfxKey, sampleSources } from '../../src/audio/SampleManifest';
import type { SfxKey } from '../../src/audio/SynthRecipes';
import type { AssetManifestEntry } from '../../src/assets/AssetTypes';
import { createWorld, setupFor } from '../../src/core/WorldSimulation';
import { HERO_ANIMS, heroAnimFor, heroFrame, SHEETS } from '../../src/render/world/SpriteSheets';
import { flatLevel } from '../fixtures/levels';

const manifest = JSON.parse(readFileSync('public/assets/ASSET_MANIFEST.json', 'utf8')) as {
  entries: AssetManifestEntry[];
};
const entry = (key: string): AssetManifestEntry | undefined => manifest.entries.find((e) => e.key === key);

function player() {
  const level = flatLevel();
  const world = createWorld(setupFor(level, { seed: 1, difficulty: 'normal', playerCount: 1 }), level);
  const p = world.players[0];
  if (!p) throw new Error('no player');
  return { world, level, p };
}

describe('baked frame sheets', () => {
  it('every sheet in the manifest has the frame count and a size that fits its cells', () => {
    for (const [key, def] of Object.entries(SHEETS)) {
      const e = entry(key);
      expect(e, key).toBeDefined();
      const file = e?.files[0];
      expect(e?.frames?.count, key).toBe(def.count);
      expect((file?.width ?? 0) % def.frameWidth, key).toBe(0);
      expect((file?.height ?? 0) % def.frameHeight, key).toBe(0);
      const cells = ((file?.width ?? 0) / def.frameWidth) * ((file?.height ?? 0) / def.frameHeight);
      expect(cells, key).toBeGreaterThanOrEqual(def.count);
    }
  });

  it('hero clips tile the sheet without gaps or overlaps', () => {
    const clips = Object.values(HERO_ANIMS).sort((a, b) => a.start - b.start);
    let next = 0;
    for (const c of clips) {
      expect(c.start).toBe(next);
      next += c.count;
    }
    expect(next).toBe(SHEETS['char_hero']?.count);
  });

  it('picks the clip from the player state (render-only)', () => {
    const { p } = player();
    p.mode = 'ground';
    p.grounded = true;
    p.vx = 0;
    expect(heroAnimFor(p)).toBe('idle');
    p.vx = 400;
    expect(heroAnimFor(p)).toBe('run');
    p.grounded = false;
    p.mode = 'air';
    p.vy = -300;
    expect(heroAnimFor(p)).toBe('rise');
    p.vy = 300;
    expect(heroAnimFor(p)).toBe('fall');
    p.jetpacking = true;
    expect(heroAnimFor(p)).toBe('jet');
    p.mode = 'dash';
    expect(heroAnimFor(p)).toBe('dash');
    p.mode = 'wallSlide';
    expect(heroAnimFor(p)).toBe('wall');
    p.mode = 'dead';
    expect(heroAnimFor(p)).toBe('hurt');
  });

  it('frame names stay inside the clip at any time', () => {
    const { p } = player();
    p.mode = 'ground';
    p.grounded = true;
    p.vx = 600;
    for (let t = 0; t < 5000; t += 37) {
      const f = Number(heroFrame(p, t));
      expect(f).toBeGreaterThanOrEqual(HERO_ANIMS.run.start);
      expect(f).toBeLessThan(HERO_ANIMS.run.start + HERO_ANIMS.run.count);
    }
  });
});

describe('recorded sounds', () => {
  it('every audio entry names a sound key and pairs each variation in two codecs', () => {
    const audio = manifest.entries.filter((e) => e.kind === 'audio');
    expect(audio.length).toBeGreaterThan(10);
    for (const e of audio) expect(isSfxKey(e.key), e.key).toBe(true);
    const sources = sampleSources(manifest.entries, 'assets/');
    expect(sources.length).toBe(audio.length);
    for (const s of sources) {
      for (const v of s.variants) {
        expect(v.opus, s.key).toMatch(/^assets\/audio\/.+\.webm$/);
        expect(v.aac, s.key).toMatch(/^assets\/audio\/.+\.m4a$/);
      }
    }
  });

  it('plays footsteps while running on the ground, at a stride rate', () => {
    const calls: SfxKey[] = [];
    const engine: SfxPlayer = {
      play: (key: SfxKey) => {
        calls.push(key);
        return 1;
      },
      stop: () => undefined,
      duck: () => undefined,
      setListener: () => undefined,
    };
    const { world, level, p } = player();
    const audio = new GameAudio(engine, level);
    p.mode = 'ground';
    p.grounded = true;
    p.vx = 420;
    for (let i = 0; i < 60; i += 1) audio.frame(world, p.x, 1280, false, 1000 / 60);
    const steps = calls.filter((k) => k === 'sfx_footstep').length;
    expect(steps).toBeGreaterThanOrEqual(3);
    expect(steps).toBeLessThanOrEqual(5);
    calls.length = 0;
    p.vx = 0;
    for (let i = 0; i < 60; i += 1) audio.frame(world, p.x, 1280, false, 1000 / 60);
    expect(calls.filter((k) => k === 'sfx_footstep').length).toBe(0);
  });
});
