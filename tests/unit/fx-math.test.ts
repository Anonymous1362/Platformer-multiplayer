import { describe, expect, it } from 'vitest';
import {
  BIG_LANDING_U,
  decayTrauma,
  followFactor,
  isLowHp,
  PARTICLE_CAPS,
  progress,
  SHAKE,
  shakeStrength,
} from '../../src/render/fx/FxMath';

describe('render-only feel (spec 13.6–13.8)', () => {
  it('trauma decays at 1.6 per second and never goes negative', () => {
    expect(decayTrauma(1, 0.1)).toBeCloseTo(0.84, 6);
    expect(decayTrauma(0.1, 1)).toBe(0);
  });

  it('shake is trauma squared, capped at 25% under reduced motion', () => {
    expect(shakeStrength(0.5, false)).toBeCloseTo(0.25, 6);
    expect(shakeStrength(1, false)).toBe(1);
    expect(shakeStrength(3, false)).toBe(1);
    expect(shakeStrength(1, true)).toBe(SHAKE.reducedMotionCap);
    expect(shakeStrength(0.4, true)).toBeCloseTo(0.16, 6);
    expect(SHAKE.maxOffsetU).toBe(18);
    expect(SHAKE.maxRotationDeg).toBe(1.5);
  });

  it('camera follow is frame-rate independent', () => {
    expect(followFactor(0.14, 0)).toBe(0);
    expect(followFactor(0.14, 1000 / 60)).toBeCloseTo(0.14, 6);
    const half = followFactor(0.14, 1000 / 120);
    expect(1 - (1 - half) ** 2).toBeCloseTo(0.14, 6);
  });

  it('low HP is below 25% and alive', () => {
    expect(isLowHp(24, 100)).toBe(true);
    expect(isLowHp(25, 100)).toBe(false);
    expect(isLowHp(0, 100)).toBe(false);
    expect(isLowHp(10, 0)).toBe(false);
  });

  it('particle caps per tier and the big-landing threshold match the spec', () => {
    expect(PARTICLE_CAPS).toEqual({ battery: 300, balanced: 600, high: 1200 });
    expect(BIG_LANDING_U).toBe(128);
  });

  it('progress is clamped to 0..1', () => {
    expect(progress(50, 0, 100)).toBe(0.5);
    expect(progress(-5, 0, 100)).toBe(0);
    expect(progress(500, 0, 100)).toBe(1);
    expect(progress(10, 0, 0)).toBe(1);
  });
});
