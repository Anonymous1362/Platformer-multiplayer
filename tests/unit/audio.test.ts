import { describe, expect, it } from 'vitest';
import { LIMITER, MIN_REPEAT_MS, VOICE_CAPS } from '../../src/audio/AudioTypes';
import { GameAudio, type SfxPlayer } from '../../src/audio/GameAudio';
import type { PlayOptions } from '../../src/audio/SoundEngine';
import { PitchChain, spatial } from '../../src/audio/Spatial';
import { RECIPES, recipeDuration, type SfxKey } from '../../src/audio/SynthRecipes';
import { VoicePool } from '../../src/audio/VoicePool';
import type { SimulationEvent } from '../../src/core/SimulationTypes';
import { createWorld, setupFor } from '../../src/core/WorldSimulation';
import { flatLevel } from '../fixtures/levels';

describe('mixer constants (spec 10.4, N12)', () => {
  it('match the spec', () => {
    expect(VOICE_CAPS).toEqual({ sfx: 24, ui: 6, ambience: 4, voice: 2 });
    expect(MIN_REPEAT_MS).toBe(40);
    expect(LIMITER).toMatchObject({ thresholdDb: -3, ratio: 20, attackS: 0.003, releaseS: 0.25 });
  });
});

describe('voice pool (N12)', () => {
  const voice = (id: number, key: string, startS: number, level = 1, endS = startS + 1) => ({
    id,
    key,
    startS,
    endS,
    level,
  });

  it('blocks a repeat of the same sound within 40 ms, not other sounds', () => {
    const pool = new VoicePool(4);
    pool.add(voice(1, 'a', 0));
    expect(pool.admit('a', 0.039)).toEqual({ ok: false, reason: 'repeat' });
    expect(pool.admit('a', 0.041).ok).toBe(true);
    expect(pool.admit('b', 0.001).ok).toBe(true);
  });

  it('when full, steals the quietest voice, the oldest among equals', () => {
    const pool = new VoicePool(3);
    pool.add(voice(1, 'a', 0, 0.8));
    pool.add(voice(2, 'b', 0.1, 0.3));
    pool.add(voice(3, 'c', 0.2, 0.3));
    const admission = pool.admit('d', 0.3);
    expect(admission).toEqual({ ok: true, steal: expect.objectContaining({ id: 2 }) as unknown });
  });

  it('frees voices that have finished', () => {
    const pool = new VoicePool(2);
    pool.add(voice(1, 'a', 0, 1, 0.2));
    pool.add(voice(2, 'b', 0, 1, 5));
    pool.prune(0.5);
    expect(pool.size).toBe(1);
    expect(pool.admit('c', 0.5)).toEqual({ ok: true, steal: null });
  });
});

describe('space (spec 10.4)', () => {
  it('pans with screen position up to ±0.6 and attenuates 6 dB per screen width off screen', () => {
    expect(spatial(0, 0, 1920)).toEqual({ pan: 0, gain: 1 });
    expect(spatial(960, 0, 1920).pan).toBeCloseTo(0.6, 6);
    expect(spatial(-960, 0, 1920).pan).toBeCloseTo(-0.6, 6);
    expect(spatial(480, 0, 1920).pan).toBeCloseTo(0.3, 6);
    expect(spatial(960, 0, 1920).gain).toBe(1);
    expect(20 * Math.log10(spatial(960 + 1920, 0, 1920).gain)).toBeCloseTo(-6, 6);
    expect(spatial(Number.NaN, 0, 1920)).toEqual({ pan: 0, gain: 1 });
  });

  it('shard pitch rises a semitone per pickup in a chain, up to an octave, and resets after a gap', () => {
    const chain = new PitchChain(1200);
    expect(chain.next(0)).toBe(1);
    expect(chain.next(500)).toBeCloseTo(2 ** (1 / 12), 9);
    let p = 1;
    for (let i = 0; i < 20; i += 1) p = chain.next(600 + i * 10);
    expect(p).toBe(2);
    expect(chain.next(5000)).toBe(1);
  });
});

describe('synth recipes (spec 10.5)', () => {
  it('every recipe is short, quiet enough to mix, and on a voice-limited bus', () => {
    for (const [key, r] of Object.entries(RECIPES)) {
      expect(r.layers.length, key).toBeGreaterThan(0);
      for (const l of r.layers) {
        expect(l.gain, key).toBeLessThanOrEqual(0.35);
        expect(l.attack, key).toBeGreaterThan(0);
        expect(l.decay, key).toBeGreaterThan(0);
      }
      expect(recipeDuration(r), key).toBeLessThanOrEqual(2);
      expect(['sfx', 'ui', 'ambience', 'voice']).toContain(r.bus);
      if ('vary' in r) expect(r.vary, key).toBeLessThanOrEqual(0.05);
    }
  });
});

class Recorder implements SfxPlayer {
  readonly plays: { key: SfxKey; options: PlayOptions }[] = [];
  readonly stops: number[] = [];
  ducks = 0;
  private next = 1;
  play(key: SfxKey, options: PlayOptions = {}): number {
    this.plays.push({ key, options });
    this.next += 1;
    return this.next;
  }
  stop(id: number): void {
    this.stops.push(id);
  }
  duck(): void {
    this.ducks += 1;
  }
  setListener(): void {
    // not needed here
  }
}

describe('game audio: events to sounds, once per tick', () => {
  const level = flatLevel();
  const fresh = () => createWorld(setupFor(level, { seed: 1, difficulty: 'normal', playerCount: 1 }), level);

  it('maps events to keys with positions; landings below 40 u are silent', () => {
    const rec = new Recorder();
    const audio = new GameAudio(rec, level);
    const world = fresh();
    const id = world.players[0]?.id ?? 0;
    const events: SimulationEvent[] = [
      { type: 'jumped', playerId: id, tick: 1 },
      { type: 'shotFired', playerId: id, tick: 1, x: 300, y: 500, dirX: 1, dirY: 0 },
      { type: 'projectileHit', tick: 1, x: 700, y: 500, targetId: 0 },
      { type: 'enemyAlert', enemyId: 999, tick: 1 },
      { type: 'landed', playerId: id, tick: 1 },
    ];
    audio.onTick(events, world, new Map([[id, 20]]));
    expect(rec.plays.map((p) => p.key)).toEqual([
      'sfx_jump',
      'sfx_shoot_pulse_blaster',
      'sfx_impact_metal',
      'sfx_crawler_alert',
    ]);
    expect(rec.plays[1]?.options.x).toBe(300);
    expect(rec.ducks).toBe(1);
    audio.onTick([{ type: 'landed', playerId: id, tick: 2 }], world, new Map([[id, 200]]));
    expect(rec.plays.at(-1)).toEqual({ key: 'sfx_land', options: { x: world.players[0]?.x, gain: 1 } });
  });

  it('shard pickups in a chain rise in pitch', () => {
    const rec = new Recorder();
    const audio = new GameAudio(rec, level);
    const world = fresh();
    const id = world.players[0]?.id ?? 0;
    const shard = (tick: number): SimulationEvent => ({
      type: 'shardCollected',
      playerId: id,
      tick,
      x: 0,
      y: 0,
    });
    audio.onTick([shard(1)], world, new Map());
    audio.frame(world, 0, 1920, false, 100);
    audio.onTick([shard(2)], world, new Map());
    const pitches = rec.plays.map((p) => p.options.pitch ?? 1);
    expect(pitches[1]).toBeGreaterThan(pitches[0] ?? 1);
  });

  it('the jetpack loop follows the state; pause stops it; the heartbeat beats while HP is low', () => {
    const rec = new Recorder();
    const audio = new GameAudio(rec, level);
    const world = fresh();
    const p = world.players[0];
    if (!p) throw new Error('no player');
    p.jetpacking = true;
    audio.frame(world, 0, 1920, false, 16);
    audio.frame(world, 0, 1920, false, 16);
    expect(rec.plays.filter((x) => x.key === 'sfx_jetpack_loop')).toHaveLength(1);
    p.jetpacking = false;
    audio.frame(world, 0, 1920, false, 16);
    expect(rec.stops).toHaveLength(1);
    p.jetpacking = true;
    audio.frame(world, 0, 1920, false, 16);
    audio.pause();
    expect(rec.stops).toHaveLength(2);

    p.jetpacking = false;
    for (let i = 0; i < 120; i += 1) audio.frame(world, 0, 1920, true, 16);
    const beats = rec.plays.filter((x) => x.key === 'sfx_heartbeat').length;
    expect(beats).toBe(3); // 1.92 s at one beat per 900 ms, the first one immediately
  });
});
