import { describe, expect, it } from 'vitest';
import { FrameStats } from '../../src/app/FrameStats';

describe('FrameStats', () => {
  it('starts empty', () => {
    const s = new FrameStats();
    expect(s.fps).toBe(0);
    expect(s.emaMs).toBe(0);
    expect(s.p95Ms()).toBe(0);
  });

  it('uses the first sample directly, then converges toward steady frames', () => {
    const s = new FrameStats(0.1);
    s.record(33.3);
    expect(s.emaMs).toBeCloseTo(33.3, 6);
    for (let i = 0; i < 200; i += 1) s.record(1000 / 60);
    expect(s.fps).toBeGreaterThan(59.5);
    expect(s.fps).toBeLessThan(60.5);
  });

  it('computes p95 by nearest rank over the buffer', () => {
    const s = new FrameStats(0.1, 100);
    for (let i = 1; i <= 100; i += 1) s.record(i);
    expect(s.p95Ms()).toBe(95);
  });

  it('keeps only the most recent samples', () => {
    const s = new FrameStats(0.1, 10);
    for (let i = 0; i < 10; i += 1) s.record(100);
    for (let i = 0; i < 10; i += 1) s.record(10);
    expect(s.p95Ms()).toBe(10);
    expect(s.sampleCount).toBe(10);
  });

  it('ignores invalid samples and clamps huge ones', () => {
    const s = new FrameStats();
    for (const v of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) s.record(v);
    expect(s.sampleCount).toBe(0);
    s.record(5000);
    expect(s.emaMs).toBe(1000);
  });

  it('resets', () => {
    const s = new FrameStats();
    s.record(16);
    s.reset();
    expect(s.sampleCount).toBe(0);
    expect(s.fps).toBe(0);
  });

  it('validates its parameters', () => {
    expect(() => new FrameStats(0)).toThrow(RangeError);
    expect(() => new FrameStats(1.5)).toThrow(RangeError);
    expect(() => new FrameStats(0.1, 0)).toThrow(RangeError);
  });
});
