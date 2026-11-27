import { Button } from '../core/InputTypes';
import { applyStick, DEFAULT_STICK_TUNING, type StickTuning } from './StickMath';
import type { InputSource, SourceSample } from './InputRouter';
import { MENU_STICK, MenuIntentQueue, type MenuIntent } from './MenuNav';

/** The parts of the Gamepad API this adapter reads (lets tests pass plain objects). */
export interface GamepadLike {
  readonly index: number;
  readonly id: string;
  readonly connected: boolean;
  readonly mapping: string;
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
  readonly axes: readonly number[];
}

/** Standard-mapping button indexes (W3C Gamepad "standard" layout). */
export const PadButton = {
  South: 0,
  East: 1,
  West: 2,
  North: 3,
  LeftBumper: 4,
  RightBumper: 5,
  LeftTrigger: 6,
  RightTrigger: 7,
  Select: 8,
  Start: 9,
  DpadUp: 12,
  DpadDown: 13,
  DpadLeft: 14,
  DpadRight: 15,
} as const;

/** Spec 8.9 gamepad column: A jump, X or RT shoot, B dash, RB parry, Y gadget, Start pause. */
const BUTTON_BITS: readonly (readonly [number, number])[] = [
  [PadButton.South, Button.Jump],
  [PadButton.West, Button.Shoot],
  [PadButton.RightTrigger, Button.Shoot],
  [PadButton.East, Button.Dash],
  [PadButton.RightBumper, Button.Parry],
  [PadButton.North, Button.Gadget],
];
const TRIGGER_THRESHOLD = 0.5;

/** Menu intents per pad input: D-pad or left stick steps, A confirms, B goes back. */
const MENU_BITS: readonly (readonly [number, MenuIntent])[] = [
  [1, 'up'],
  [2, 'down'],
  [4, 'confirm'],
  [8, 'back'],
];

function isDown(pad: GamepadLike, index: number): boolean {
  const b = pad.buttons[index];
  if (!b) return false;
  return index === PadButton.RightTrigger || index === PadButton.LeftTrigger
    ? b.value >= TRIGGER_THRESHOLD || b.pressed
    : b.pressed;
}

/**
 * Gamepads through the Gamepad API (spec 14.4), polled once per frame. Every connected pad counts
 * (hot-plug included); a pad that reports a non-standard mapping is read with the standard indexes
 * (calibration arrives in Pass 6C). After `releaseAll`, buttons still physically held are ignored until
 * they are released, so a refocus never fires a press nobody made.
 */
export class GamepadControls implements InputSource {
  readonly kind = 'gamepad';
  /** Menu intents from every pad; drained by whichever menu is open. */
  readonly menu = new MenuIntentQueue();
  private menuHeld = 0;
  private stickUp = false;
  private stickDown = false;
  private tuning: StickTuning;
  private held = 0;
  private latched = 0;
  private suppressed = 0;
  private pauseHeld = false;
  private pauses = 0;
  private moveX = 0;
  private moveY = 0;
  private aimMrad: number | null = null;
  private lastUseMs = Number.NEGATIVE_INFINITY;
  private ids: string[] = [];

  constructor(tuning: StickTuning = DEFAULT_STICK_TUNING) {
    this.tuning = tuning;
  }

  /** Deadzone, saturation, and curve from Settings (spec 14.3); per controller arrives in 2B-5. */
  setTuning(tuning: StickTuning): void {
    this.tuning = tuning;
  }

  /** Connected pad names, for the device record and glyph selection. */
  get connectedIds(): readonly string[] {
    return this.ids;
  }

  poll(pads: readonly (GamepadLike | null)[], nowMs: number): void {
    let held = 0;
    let pause = false;
    let best = { x: 0, y: 0, m: 0 };
    let aim: number | null = null;
    let menuRaw = 0;
    let stickY = 0;
    const ids: string[] = [];
    for (const pad of pads) {
      if (!pad?.connected) continue;
      ids.push(pad.id);
      if (isDown(pad, PadButton.DpadUp)) menuRaw |= 1;
      if (isDown(pad, PadButton.DpadDown)) menuRaw |= 2;
      if (isDown(pad, PadButton.South)) menuRaw |= 4;
      if (isDown(pad, PadButton.East)) menuRaw |= 8;
      const y = pad.axes[1] ?? 0;
      if (Math.abs(y) > Math.abs(stickY)) stickY = y;
      for (const [index, bit] of BUTTON_BITS) if (isDown(pad, index)) held |= bit;
      if (isDown(pad, PadButton.Start)) pause = true;

      const stick = applyStick(pad.axes[0] ?? 0, pad.axes[1] ?? 0, 1, this.tuning);
      const dx = (isDown(pad, PadButton.DpadRight) ? 1 : 0) - (isDown(pad, PadButton.DpadLeft) ? 1 : 0);
      const dy = isDown(pad, PadButton.DpadDown) ? 1 : 0;
      const dLen = Math.hypot(dx, dy);
      const dpad = dLen > 0 ? { x: dx / dLen, y: dy / dLen, m: 1 } : { x: 0, y: 0, m: 0 };
      for (const v of [{ x: stick.x, y: stick.y, m: stick.magnitude }, dpad]) if (v.m > best.m) best = v;

      const right = applyStick(pad.axes[2] ?? 0, pad.axes[3] ?? 0, 1, this.tuning);
      // World convention: +y is down, so aiming down is +pi/2.
      if (right.active && aim === null) aim = Math.round(Math.atan2(right.y, right.x) * 1000);
    }
    this.ids = ids;
    this.pollMenu(menuRaw, stickY);

    // Buttons held through a reset stay ignored until released.
    this.suppressed &= held;
    const effective = held & ~this.suppressed;
    const pressed = effective & ~this.held;
    if (pressed !== 0 || best.m > 0) this.lastUseMs = nowMs;
    this.latched |= pressed;
    this.held = effective;
    if (pause && !this.pauseHeld) this.pauses += 1;
    this.pauseHeld = pause;
    this.moveX = best.x;
    this.moveY = best.y;
    this.aimMrad = aim;
  }

  /** Edge-triggered menu intents from the raw pad state (independent of gameplay suppression). */
  private pollMenu(raw: number, stickY: number): void {
    if (this.stickUp ? stickY > -MENU_STICK.release : stickY < -MENU_STICK.press)
      this.stickUp = !this.stickUp;
    if (this.stickDown ? stickY < MENU_STICK.release : stickY > MENU_STICK.press)
      this.stickDown = !this.stickDown;
    const bits = raw | (this.stickUp ? 1 : 0) | (this.stickDown ? 2 : 0);
    const pressed = bits & ~this.menuHeld;
    this.menuHeld = bits;
    for (const [bit, intent] of MENU_BITS) if ((pressed & bit) !== 0) this.menu.push(intent);
  }

  releaseAll(): void {
    this.menu.clear();
    this.suppressed |= this.held;
    this.held = 0;
    this.latched = 0;
    this.moveX = 0;
    this.moveY = 0;
    this.aimMrad = null;
  }

  sample(): SourceSample {
    return {
      moveX: this.moveX,
      moveY: this.moveY,
      held: this.held,
      latched: this.latched,
      aimMrad: this.aimMrad,
      lastUseMs: this.lastUseMs,
    };
  }

  consumeLatched(): void {
    this.latched = 0;
  }

  takePause(): boolean {
    if (this.pauses === 0) return false;
    this.pauses = 0;
    return true;
  }
}
