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

  it('rejects a non-finite seed', () => {
    expect(() => new SeededRandom(Number.NaN)).toThrow(RangeError);
  });
});
