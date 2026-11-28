import { Button } from '../core/InputTypes';
import { applyStick, DEFAULT_STICK_TUNING, type StickTuning } from './StickMath';
import type { InputSource, SourceSample } from './InputRouter';
import { MENU_STICK, MenuIntentQueue, type MenuIntent } from './MenuNav';
import {
  DEFAULT_PAD_BY_FAMILY,
  PAD_ACTIONS,
  padFamily,
  type PadAction,
  type PadBindings,
  type PadFamily,
} from './Bindings';

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

/** Gameplay bits per rebindable pad action (pause is handled on its own). */
const ACTION_BITS: Readonly<Record<Exclude<PadAction, 'pause'>, number>> = {
  jump: Button.Jump,
  shoot: Button.Shoot,
  dash: Button.Dash,
  parry: Button.Parry,
  gadget: Button.Gadget,
};

/** Standard mapping has 17 buttons (0–16); the Guide button (16) is never bound. */
const BUTTON_COUNT = 16;
const TRIGGER_THRESHOLD = 0.5;

/**
 * Menu intents per pad input (spec 8.13): D-pad or left stick steps (up, down, left, right), A
 * confirms, B goes back, the bumpers switch tabs. Menus never follow rebinding.
 */
const MENU_BITS: readonly (readonly [number, MenuIntent])[] = [
  [1, 'up'],
  [2, 'down'],
  [4, 'confirm'],
  [8, 'back'],
  [16, 'left'],
  [32, 'right'],
  [64, 'prevTab'],
  [128, 'nextTab'],
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
  private stickLeft = false;
  private stickRight = false;
  private tuning: StickTuning;
  private bindings: Readonly<Record<PadFamily, PadBindings>> = DEFAULT_PAD_BY_FAMILY;
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
  /** Raw button states per pad index, for press edges while capturing a rebind. */
  private readonly rawPrev = new Map<number, boolean[]>();
  private capture: ((button: number, family: PadFamily) => void) | null = null;
  private polls = 0;

  constructor(tuning: StickTuning = DEFAULT_STICK_TUNING) {
    this.tuning = tuning;
  }

  /** Deadzone, saturation, and curve from Settings (spec 14.3). */
  setTuning(tuning: StickTuning): void {
    this.tuning = tuning;
  }

  /** Per-family button bindings (Settings → Controls → Rebind, spec 8.13). */
  setBindings(bindings: Readonly<Record<PadFamily, PadBindings>>): void {
    this.bindings = bindings;
    this.suppressed |= this.held;
    this.held = 0;
  }

  /**
   * Rebinding: the next button newly pressed on any pad goes to `onButton` instead of the game or the
   * menus. Returns a function that cancels the capture.
   */
  captureNext(onButton: (button: number, family: PadFamily) => void): () => void {
    this.capture = onButton;
    return () => {
      if (this.capture === onButton) this.capture = null;
    };
  }

  get capturing(): boolean {
    return this.capture !== null;
  }

  /** Connected pad names, for the device record and glyph selection. */
  get connectedIds(): readonly string[] {
    return this.ids;
  }

  /** Families of the connected pads (the rebinding screen opens on the first one). */
  get connectedFamilies(): readonly PadFamily[] {
    return this.ids.map(padFamily);
  }

  /** How many times the pads were polled (tests wait on it instead of on wall time). */
  get pollCount(): number {
    return this.polls;
  }

  poll(pads: readonly (GamepadLike | null)[], nowMs: number): void {
    this.polls += 1;
    let held = 0;
    let pause = false;
    let best = { x: 0, y: 0, m: 0 };
    let aim: number | null = null;
    let menuRaw = 0;
    let stickX = 0;
    let stickY = 0;
    const ids: string[] = [];
    let captured: { button: number; family: PadFamily } | null = null;
    for (const pad of pads) {
      if (!pad?.connected) continue;
      ids.push(pad.id);
      const family = padFamily(pad.id);
      const prev = this.rawPrev.get(pad.index) ?? [];
      const now: boolean[] = [];
      for (let i = 0; i < BUTTON_COUNT; i += 1) {
        now[i] = isDown(pad, i);
        if (captured === null && now[i] === true && prev[i] !== true) captured = { button: i, family };
      }
      this.rawPrev.set(pad.index, now);
      if (isDown(pad, PadButton.DpadUp)) menuRaw |= 1;
      if (isDown(pad, PadButton.DpadDown)) menuRaw |= 2;
      if (isDown(pad, PadButton.South)) menuRaw |= 4;
      if (isDown(pad, PadButton.East)) menuRaw |= 8;
      if (isDown(pad, PadButton.DpadLeft)) menuRaw |= 16;
      if (isDown(pad, PadButton.DpadRight)) menuRaw |= 32;
      if (isDown(pad, PadButton.LeftBumper)) menuRaw |= 64;
      if (isDown(pad, PadButton.RightBumper)) menuRaw |= 128;
      const x = pad.axes[0] ?? 0;
      const y = pad.axes[1] ?? 0;
      if (Math.abs(x) > Math.abs(stickX)) stickX = x;
      if (Math.abs(y) > Math.abs(stickY)) stickY = y;
      const map = this.bindings[family];
      for (const action of PAD_ACTIONS) {
        for (const index of map[action]) {
          if (index === null || !isDown(pad, index)) continue;
          if (action === 'pause') pause = true;
          else held |= ACTION_BITS[action];
        }
      }

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

    if (this.capture) {
      // While capturing a rebind, nothing reaches the game or the menus; the press is ignored until
      // released afterwards, so it never fires the action it was just bound to.
      this.menuHeld = menuRaw;
      this.suppressed |= held;
      this.held = 0;
      this.moveX = 0;
      this.moveY = 0;
      this.aimMrad = null;
      this.pauseHeld = pause;
      if (captured) {
        const onButton = this.capture;
        this.capture = null;
        onButton(captured.button, captured.family);
      }
      return;
    }

    this.pollMenu(menuRaw, stickX, stickY);

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
  private pollMenu(raw: number, stickX: number, stickY: number): void {
    const hysteresis = (on: boolean, value: number): boolean =>
      on ? value > MENU_STICK.release : value > MENU_STICK.press;
    this.stickUp = hysteresis(this.stickUp, -stickY);
    this.stickDown = hysteresis(this.stickDown, stickY);
    this.stickLeft = hysteresis(this.stickLeft, -stickX);
    this.stickRight = hysteresis(this.stickRight, stickX);
    const bits =
      raw |
      (this.stickUp ? 1 : 0) |
      (this.stickDown ? 2 : 0) |
      (this.stickLeft ? 16 : 0) |
      (this.stickRight ? 32 : 0);
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
