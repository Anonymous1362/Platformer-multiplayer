export const INPUT_BUTTONS = {
  jump: 1 << 0,
  dash: 1 << 1,
  shoot: 1 << 2,
  parry: 1 << 3,
  gadget: 1 << 4,
  interact: 1 << 5,
} as const;

export const INPUT_BUTTON_MASK = (1 << 6) - 1;

/** One canonical local or remote controller sample for a simulation tick. */
export interface InputFrame {
  readonly moveX: number;
  readonly moveY: number;
  readonly held: number;
  readonly aimMrad: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Narrows untrusted input and clamps it to the simulation's contracted ranges. */
export function sanitizeInputFrame(input: unknown): InputFrame {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('InputFrame must be an object.');
  }

  const values = input as Record<string, unknown>;
  const heldValue = finiteOrZero(values.held);
  const aimValue = finiteOrZero(values.aimMrad);

  return {
    moveX: clamp(finiteOrZero(values.moveX), -1, 1),
    moveY: clamp(finiteOrZero(values.moveY), -1, 1),
    held: Math.trunc(clamp(heldValue, 0, INPUT_BUTTON_MASK)),
    aimMrad: Math.trunc(clamp(Math.round(aimValue), -0x8000, 0x7fff)),
  };
}
