import { GameConfig } from './GameConfig';
import type { InputFrame } from './InputTypes';

const { axisSteps, heldMask, aimLimitMrad } = GameConfig.input;

/** Neutral input: no movement, nothing held, aiming right. */
export const NEUTRAL_INPUT: InputFrame = { moveX: 0, moveY: 0, held: 0, aimMrad: 0 };

/** Axis value as the integer the network sends (-127..127). Non-finite values become 0. */
export function quantizeAxis(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(1, Math.max(-1, value));
  const q = Math.round(clamped * axisSteps);
  return q === 0 ? 0 : q; // never -0
}

export function sanitizeHeld(value: number): number {
  return Number.isInteger(value) ? value & heldMask : 0;
}

export function sanitizeAim(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const q = Math.round(Math.min(aimLimitMrad, Math.max(-aimLimitMrad, value)));
  return q === 0 ? 0 : q;
}

/**
 * The simulation's input boundary (N11): finite checks, clamps, and the same quantization the network
 * uses, so local play, replays, and online matches see identical numbers. Idempotent.
 */
export function sanitizeInputFrame(frame: InputFrame | undefined): InputFrame {
  if (!frame) return NEUTRAL_INPUT;
  return {
    moveX: quantizeAxis(frame.moveX) / axisSteps,
    moveY: quantizeAxis(frame.moveY) / axisSteps,
    held: sanitizeHeld(frame.held),
    aimMrad: sanitizeAim(frame.aimMrad),
  };
}
