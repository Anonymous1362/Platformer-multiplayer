import { Button } from '../core/InputTypes';
import type { InputSource, SourceSample } from './InputRouter';

/**
 * Keyboard and mouse (spec sections 8.9 and 14.4). Both keyboard columns work at the same time. Only
 * physical down/up changes state: OS key repeat is ignored, so a key cleared by a blur stays released
 * until it is pressed again. Rebinding arrives in Pass 2B; these are the defaults.
 */
export type KeyAction = 'left' | 'right' | 'down' | 'jump' | 'shoot' | 'dash' | 'parry' | 'gadget' | 'pause';

export const DEFAULT_KEY_BINDINGS: Readonly<Record<KeyAction, readonly string[]>> = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  down: ['KeyS', 'ArrowDown'],
  jump: ['Space', 'KeyZ'],
  shoot: ['KeyX'],
  dash: ['ShiftLeft', 'ShiftRight', 'KeyC'],
  parry: ['KeyV'],
  gadget: ['KeyE', 'KeyB'],
  pause: ['Escape', 'KeyP'],
};

const ACTION_BITS: Partial<Readonly<Record<KeyAction, number>>> = {
  jump: Button.Jump,
  shoot: Button.Shoot,
  dash: Button.Dash,
  parry: Button.Parry,
  gadget: Button.Gadget,
};

/** Mouse buttons (MouseEvent.button): left shoots toward the cursor, right parries. */
const MOUSE_BITS: Readonly<Record<number, number>> = { 0: Button.Shoot, 2: Button.Parry };

export class KeyboardMouseControls implements InputSource {
  readonly kind = 'keyboard';
  private readonly codeToAction = new Map<string, KeyAction>();
  private readonly down = new Set<string>();
  private readonly mouseDown = new Set<number>();
  private latched = 0;
  private pauses = 0;
  private lastUseMs = Number.NEGATIVE_INFINITY;
  private cursor: { x: number; y: number } | null = null;
  private aimResolver: ((clientX: number, clientY: number) => number | null) | null = null;

  constructor(bindings: Readonly<Record<KeyAction, readonly string[]>> = DEFAULT_KEY_BINDINGS) {
    for (const [action, codes] of Object.entries(bindings) as [KeyAction, readonly string[]][]) {
      for (const code of codes) this.codeToAction.set(code, action);
    }
  }

  /** True when the key is bound (the caller then prevents the browser default). */
  keyDown(code: string, repeat: boolean, nowMs: number): boolean {
    const action = this.codeToAction.get(code);
    if (!action) return false;
    if (repeat || this.down.has(code)) return true;
    this.down.add(code);
    this.lastUseMs = nowMs;
    if (action === 'pause') this.pauses += 1;
    this.latched |= ACTION_BITS[action] ?? 0;
    return true;
  }

  keyUp(code: string): boolean {
    if (!this.codeToAction.has(code)) return false;
    this.down.delete(code);
    return true;
  }

  pointerDown(button: number, nowMs: number): void {
    const bit = MOUSE_BITS[button];
    if (bit === undefined) return;
    this.mouseDown.add(button);
    this.latched |= bit;
    this.lastUseMs = nowMs;
  }

  pointerUp(button: number): void {
    this.mouseDown.delete(button);
  }

  pointerMove(clientX: number, clientY: number): void {
    this.cursor = { x: clientX, y: clientY };
  }

  /** The scene turns a cursor position into an aim angle (player to cursor, world space). */
  setAimResolver(resolver: ((clientX: number, clientY: number) => number | null) | null): void {
    this.aimResolver = resolver;
  }

  releaseAll(): void {
    this.down.clear();
    this.mouseDown.clear();
    this.latched = 0;
  }

  private isActionDown(action: KeyAction): boolean {
    for (const code of this.down) if (this.codeToAction.get(code) === action) return true;
    return false;
  }

  sample(): SourceSample {
    let held = 0;
    for (const code of this.down) {
      const action = this.codeToAction.get(code);
      if (action) held |= ACTION_BITS[action] ?? 0;
    }
    for (const button of this.mouseDown) held |= MOUSE_BITS[button] ?? 0;
    let x = (this.isActionDown('right') ? 1 : 0) - (this.isActionDown('left') ? 1 : 0);
    let y = this.isActionDown('down') ? 1 : 0;
    const length = Math.hypot(x, y);
    if (length > 1) {
      // Diagonals are never faster (spec 14.3).
      x /= length;
      y /= length;
    }
    const mouseShooting = this.mouseDown.has(0);
    const aimMrad =
      mouseShooting && this.cursor && this.aimResolver
        ? this.aimResolver(this.cursor.x, this.cursor.y)
        : null;
    return { moveX: x, moveY: y, held, latched: this.latched, aimMrad, lastUseMs: this.lastUseMs };
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

/**
 * Window keyboard listeners and canvas mouse listeners. Modified keys (Ctrl, Cmd, Alt) are never
 * handled, so browser shortcuts such as Ctrl/Cmd + W, R, T, L, Q keep working (spec 8.13).
 */
export function attachKeyboardMouse(
  win: Window,
  canvas: HTMLElement,
  controls: KeyboardMouseControls,
  now: () => number,
): () => void {
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (controls.keyDown(e.code, e.repeat, now())) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (controls.keyUp(e.code)) e.preventDefault();
  };
  const onMouseDown = (e: MouseEvent): void => {
    controls.pointerMove(e.clientX, e.clientY);
    controls.pointerDown(e.button, now());
  };
  const onMouseUp = (e: MouseEvent): void => {
    controls.pointerUp(e.button);
  };
  const onMouseMove = (e: MouseEvent): void => {
    controls.pointerMove(e.clientX, e.clientY);
  };
  win.addEventListener('keydown', onKeyDown);
  win.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  win.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mousemove', onMouseMove);
  return () => {
    win.removeEventListener('keydown', onKeyDown);
    win.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousedown', onMouseDown);
    win.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('mousemove', onMouseMove);
  };
}
