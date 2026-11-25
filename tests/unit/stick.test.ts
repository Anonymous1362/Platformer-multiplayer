import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyStick, DEFAULT_STICK_TUNING, isDown } from '../../src/input/StickMath';

const R = 100;

describe('applyStick', () => {
  it('outputs exactly zero inside the deadzone (no drift, no negative zero)', () => {
    for (const [dx, dy] of [
      [0, 0],
      [5, -5],
      [-14, 0],
      [0, 14],
    ] as const) {
      const s = applyStick(dx, dy, R);
      expect(Object.is(s.x, 0)).toBe(true);
      expect(Object.is(s.y, 0)).toBe(true);
      expect(s.magnitude).toBe(0);
      expect(s.active).toBe(false);
    }
  });

  it('is active just outside the deadzone and small', () => {
    const s = applyStick(15, 0, R);
    expect(s.active).toBe(true);
    expect(s.magnitude).toBeGreaterThan(0);
    expect(s.magnitude).toBeLessThan(0.01);
  });

  it('saturates to magnitude 1 at the outer radius and beyond', () => {
    expect(applyStick(88, 0, R).magnitude).toBeCloseTo(1, 10);
    expect(applyStick(500, 0, R).magnitude).toBe(1);
    expect(applyStick(500, 500, R).magnitude).toBeLessThanOrEqual(1);
  });

  it('applies the response exponent', () => {
    // r = 0.51 -> m = (0.51 - 0.14) / (0.88 - 0.14) = 0.5 -> 0.5^1.6
    const s = applyStick(51, 0, R);
    expect(s.magnitude).toBeCloseTo(0.5 ** 1.6, 10);
  });

  it('keeps direction and never makes diagonals faster', () => {
    const s = applyStick(300, 300, R);
    expect(s.x).toBeCloseTo(Math.SQRT1_2, 10);
    expect(s.y).toBeCloseTo(Math.SQRT1_2, 10);
    expect(Math.hypot(s.x, s.y)).toBeLessThanOrEqual(1 + 1e-12);
  });

  it('treats +y as down', () => {
    expect(applyStick(0, 90, R).y).toBeGreaterThan(0.9);
    expect(applyStick(0, -90, R).y).toBeLessThan(-0.9);
  });

  it('returns inactive for non-finite input or a bad radius', () => {
    expect(applyStick(Number.NaN, 0, R).active).toBe(false);
    expect(applyStick(0, Number.POSITIVE_INFINITY, R).active).toBe(false);
    expect(applyStick(10, 10, 0).active).toBe(false);
    expect(applyStick(10, 10, -5).active).toBe(false);
  });

  it('rejects invalid tuning', () => {
    expect(() => applyStick(50, 0, R, { inner: 0.5, outer: 0.4, exponent: 1 })).toThrow(RangeError);
    expect(() => applyStick(50, 0, R, { inner: 0.1, outer: 1.2, exponent: 1 })).toThrow(RangeError);
    expect(() => applyStick(50, 0, R, { inner: 0.1, outer: 0.9, exponent: 0 })).toThrow(RangeError);
  });

  it('never exceeds magnitude 1 for any finger position (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e4, max: 1e4, noNaN: true }),
        fc.double({ min: -1e4, max: 1e4, noNaN: true }),
        (dx, dy) => {
          const s = applyStick(dx, dy, R, DEFAULT_STICK_TUNING);
          return (
            s.magnitude <= 1 && Math.hypot(s.x, s.y) <= 1 + 1e-9 && (s.active || (s.x === 0 && s.y === 0))
          );
        },
      ),
    );
  });

  it('magnitude never decreases as the finger moves outward (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 200, noNaN: true }),
        fc.double({ min: 0, max: 200, noNaN: true }),
        (a, b) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          return applyStick(lo, 0, R).magnitude <= applyStick(hi, 0, R).magnitude;
        },
      ),
    );
  });
});

describe('isDown', () => {
  it('counts moveY >= 0.6 as Down', () => {
    expect(isDown(0.6)).toBe(true);
    expect(isDown(0.59)).toBe(false);
    expect(isDown(-1)).toBe(false);
  });
});
