/** One input sample per player per simulation tick (contract, spec section 13.4). */
export interface InputFrame {
  /** -1..1 after deadzone and response curve. */
  readonly moveX: number;
  /** -1..1, +1 = down (screen space). */
  readonly moveY: number;
  /** Bitmask of held buttons; see {@link Button}. */
  readonly held: number;
  /** Aim angle in milliradians, Int16 range. */
  readonly aimMrad: number;
}

export const Button = {
  Jump: 1 << 0,
  Dash: 1 << 1,
  Shoot: 1 << 2,
  Parry: 1 << 3,
  Gadget: 1 << 4,
  Interact: 1 << 5,
  /**
   * Not a button: set while the device aims on purpose (mouse shooting, right stick, Manual touch aim).
   * Without it the simulation auto-aims (spec 4.2).
   */
  AimManual: 1 << 6,
} as const;

/** Thumbstick output after deadzone, saturation, and response curve. */
export interface StickState {
  readonly x: number;
  /** +1 = down. */
  readonly y: number;
  /** 0..1 */
  readonly magnitude: number;
  readonly active: boolean;
}
