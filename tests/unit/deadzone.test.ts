import { describe, expect, it } from 'vitest';
import { applyRadialDeadzone } from '../../src/input/deadzone';

describe('applyRadialDeadzone', () => {
  it('zeros stick drift inside the radial deadzone', () => {
    expect(applyRadialDeadzone(0.1, 0.1)).toEqual({ x: 0, y: 0 });
  });

  it('maps the threshold to zero and full deflection to unit magnitude', () => {
    expect(applyRadialDeadzone(0.18, 0)).toEqual({ x: 0, y: 0 });
    const full = applyRadialDeadzone(1, 0);
    expect(full.x).toBeCloseTo(1);
    expect(full.y).toBe(0);
  });

  it('preserves direction and normalizes diagonal input', () => {
    const result = applyRadialDeadzone(1, 1);
    expect(result.x).toBeCloseTo(result.y);
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(1);
  });

  it('sanitizes non-finite input and clamps the deadzone', () => {
    expect(applyRadialDeadzone(Number.NaN, 1)).toEqual({ x: 0, y: 0 });
    expect(applyRadialDeadzone(1, 0, 1)).toEqual({ x: 0, y: 0 });
  });
});
