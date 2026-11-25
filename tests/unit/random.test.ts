import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../../src/core/Random';

describe('SeededRandom', () => {
  it('reproduces the same sequence for the same seed', () => {
    const first = new SeededRandom(123456);
    const second = new SeededRandom(123456);

    expect(Array.from({ length: 8 }, () => first.nextUint32())).toEqual(
      Array.from({ length: 8 }, () => second.nextUint32()),
    );
  });

  it('changes its output for different seeds and returns floats in [0, 1)', () => {
    expect(new SeededRandom(1).nextUint32()).not.toBe(new SeededRandom(2).nextUint32());

    const random = new SeededRandom(98);
    for (let index = 0; index < 100; index += 1) {
      const value = random.nextFloat();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('restores serialized xoshiro state exactly and rejects invalid state', () => {
    const original = new SeededRandom(0x0badc0de);
    original.nextUint32();
    const snapshot = original.snapshot();
    const restored = new SeededRandom(1);
    restored.restore(snapshot);

    expect(Array.from({ length: 12 }, () => original.nextUint32())).toEqual(
      Array.from({ length: 12 }, () => restored.nextUint32()),
    );
    expect(() => restored.restore([0, 0, 0, 0])).toThrow(RangeError);
    expect(() => restored.restore([1, Number.NaN, 3, 4])).toThrow(TypeError);
  });

  it('rejects a non-finite seed', () => {
    expect(() => new SeededRandom(Number.NaN)).toThrow(RangeError);
  });
});
