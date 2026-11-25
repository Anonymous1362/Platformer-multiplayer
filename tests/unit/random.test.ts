import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Random } from '../../src/core/Random';

function take(rng: Random, n: number): number[] {
  return Array.from({ length: n }, () => rng.nextU32());
}

describe('Random (sfc32)', () => {
  it('produces the same sequence for the same seed', () => {
    expect(take(new Random(12345), 100)).toEqual(take(new Random(12345), 100));
  });

  it('produces different sequences for different seeds', () => {
    expect(take(new Random(1), 16)).not.toEqual(take(new Random(2), 16));
  });

  it('matches the public sfc32 reference implementation', () => {
    // Expected values come from bryc's public-domain sfc32 run independently with state (1, 2, 3, 4).
    expect(take(Random.fromState([1, 2, 3, 4]), 4)).toEqual([7, 34, 56623200, 188882296]);
  });

  it('is pinned for seed 0 so seeding cannot change silently', () => {
    // Regression pin; changing it invalidates every replay on purpose.
    expect(take(new Random(0), 4)).toEqual([1664216021, 3479288465, 3033988455, 3613202701]);
  });

  it('nextFloat is in [0, 1)', () => {
    const rng = new Random(7);
    for (let i = 0; i < 10000; i += 1) {
      const f = rng.nextFloat();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('nextInt stays in range and covers every value', () => {
    const rng = new Random(99);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i += 1) {
      const v = rng.nextInt(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it('is roughly uniform', () => {
    const rng = new Random(2024);
    const buckets = new Array<number>(10).fill(0);
    const n = 100000;
    for (let i = 0; i < n; i += 1) {
      const idx = rng.nextInt(10);
      buckets[idx] = (buckets[idx] ?? 0) + 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(n / 10 - 600);
      expect(count).toBeLessThan(n / 10 + 600);
    }
  });

  it('rejects invalid nextInt bounds', () => {
    const rng = new Random(1);
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-3)).toThrow(RangeError);
    expect(() => rng.nextInt(1.5)).toThrow(RangeError);
  });

  it('can be saved and restored mid-sequence', () => {
    const rng = new Random(555);
    take(rng, 37);
    const restored = Random.fromState(rng.state());
    expect(take(restored, 50)).toEqual(take(rng, 50));
  });

  it('is deterministic for any seed (property)', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const a = take(new Random(seed), 8);
        const b = take(new Random(seed), 8);
        return a.every((v, i) => v === b[i]);
      }),
    );
  });
});
