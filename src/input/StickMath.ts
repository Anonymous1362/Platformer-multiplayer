import type { StickState } from '../core/InputTypes';

export interface StickTuning {
  /** Inner deadzone as a fraction of the stick radius (default 0.14). */
  readonly inner: number;
  /** Outer saturation as a fraction of the stick radius (default 0.88). */
  readonly outer: number;
  /** Response curve exponent (default 1.6). */
  readonly exponent: number;
}

export const DEFAULT_STICK_TUNING: StickTuning = { inner: 0.14, outer: 0.88, exponent: 1.6 };

const INACTIVE: StickState = { x: 0, y: 0, magnitude: 0, active: false };

/**
 * Radial deadzone with saturation and response curve (spec section 14.3).
 * `dx`/`dy` are the finger offset from the stick origin in the same units as `radius`; +y is down.
 */
export function applyStick(
  dx: number,
  dy: number,
  radius: number,
  tuning: StickTuning = DEFAULT_STICK_TUNING,
): StickState {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !(radius > 0)) return INACTIVE;
  if (!(tuning.inner >= 0 && tuning.outer > tuning.inner && tuning.outer <= 1 && tuning.exponent > 0)) {
    throw new RangeError('invalid stick tuning');
  }

  const dist = Math.hypot(dx, dy);
  const r = Math.min(1, dist / radius);
  if (r <= tuning.inner || dist === 0) return INACTIVE;

  const m = Math.min(1, Math.max(0, (r - tuning.inner) / (tuning.outer - tuning.inner)));
  const magnitude = Math.min(1, m ** tuning.exponent);
  if (magnitude === 0) return INACTIVE;

  return { x: (dx / dist) * magnitude, y: (dy / dist) * magnitude, magnitude, active: true };
}

/** `moveY >= 0.6` counts as Down for drop-through and slam. */
export function isDown(moveY: number): boolean {
  return moveY >= 0.6;
}
