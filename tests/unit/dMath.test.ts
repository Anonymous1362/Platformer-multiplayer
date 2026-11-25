import { describe, expect, it } from 'vitest';
import { atan2, cos, sin } from '../../src/core/DMath';

describe('DMath', () => {
  it('uses a 4096-entry trig table with bounded approximation error', () => {
    for (let index = 0; index < 256; index += 1) {
      const angle = (index / 256) * Math.PI * 2;
      expect(Math.abs(sin(angle) - Math.sin(angle))).toBeLessThan(0.001);
      expect(Math.abs(cos(angle) - Math.cos(angle))).toBeLessThan(0.001);
    }
  });

  it('approximates atan2 across quadrants and defines the zero vector', () => {
    for (const y of [-7, -1, -0.25, 0.25, 1, 7]) {
      for (const x of [-7, -1, -0.25, 0.25, 1, 7]) {
        expect(Math.abs(atan2(y, x) - Math.atan2(y, x))).toBeLessThan(0.0002);
      }
    }
    expect(atan2(0, 0)).toBe(0);
  });

  it('rejects non-finite inputs', () => {
    expect(() => sin(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => atan2(Number.NaN, 1)).toThrow(RangeError);
  });
});
