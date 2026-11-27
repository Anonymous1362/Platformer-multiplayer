import { Button, type StickState } from '../core/InputTypes';
import { applyStick, DEFAULT_STICK_TUNING, type StickTuning } from './StickMath';
import { hitTest, TOUCH_METRICS, type TouchControlRole, type TouchLayout } from './TouchLayout';
import type { InputSource, SourceSample } from './InputRouter';

/** One finger and the control it owns (spec section 14.1). */
export interface ActiveTouch {
  readonly identifier: number;
  readonly role: TouchControlRole;
  readonly startX: number;
  readonly startY: number;
  currentX: number;
  currentY: number;
  readonly startedAtMs: number;
}

const ROLE_BITS: Readonly<Record<Exclude<TouchControlRole, 'move'>, number>> = {
  jump: Button.Jump,
  dash: Button.Dash,
  shoot: Button.Shoot,
  parry: Button.Parry,
  gadget: Button.Gadget,
};

const IDLE_STICK: StickState = { x: 0, y: 0, magnitude: 0, active: false };

/**
 * Multi-touch finger ownership (spec section 14.2). A finger owns at most one role and a role has at
 * most one finger: the control is chosen where the finger lands and never changes while it slides, and
 * a second finger on an owned control is ignored (first owner wins). Releasing one finger never
 * releases another finger's control. Pure logic: the DOM listeners are in `attachTouchListeners`.
 */
export class TouchControls implements InputSource {
  readonly kind = 'touch';
  private layout: TouchLayout;
  private readonly tuning: StickTuning;
  private readonly touches = new Map<number, ActiveTouch>();
  private readonly owners = new Map<TouchControlRole, number>();
  /** Origin of the stick finger (floating stick: where it landed). */
  private stickOrigin: { x: number; y: number } | null = null;
  private latched = 0;
  private pauses = 0;
  private lastUseMs = Number.NEGATIVE_INFINITY;

  constructor(layout: TouchLayout, tuning: StickTuning = DEFAULT_STICK_TUNING) {
    this.layout = layout;
    this.tuning = tuning;
  }

  /** New canvas size or safe area: controls move, but every finger keeps the control it owns. */
  setLayout(layout: TouchLayout): void {
    this.layout = layout;
  }

  get currentLayout(): TouchLayout {
    return this.layout;
  }

  begin(identifier: number, x: number, y: number, nowMs: number): void {
    if (this.touches.has(identifier)) return;
    this.lastUseMs = nowMs;
    const hit = hitTest(this.layout, x, y);
    if (hit === null) return;
    if (hit === 'pause') {
      this.pauses += 1;
      return;
    }
    if (this.owners.has(hit)) return; // first owner wins
    this.touches.set(identifier, {
      identifier,
      role: hit,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      startedAtMs: nowMs,
    });
    this.owners.set(hit, identifier);
    if (hit === 'move') {
      this.stickOrigin = this.layout.floatingStick
        ? { x, y }
        : { x: this.layout.fixedStick.cx, y: this.layout.fixedStick.cy };
    } else {
      this.latched |= ROLE_BITS[hit];
    }
  }

  move(identifier: number, x: number, y: number): void {
    const touch = this.touches.get(identifier);
    if (!touch) return;
    touch.currentX = x;
    touch.currentY = y;
  }

  /** `touchend` and `touchcancel`: only the identifiers in `changedTouches` are released. */
  end(identifier: number): void {
    const touch = this.touches.get(identifier);
    if (!touch) return;
    this.touches.delete(identifier);
    this.owners.delete(touch.role);
    if (touch.role === 'move') this.stickOrigin = null;
  }

  releaseAll(): void {
    this.touches.clear();
    this.owners.clear();
    this.stickOrigin = null;
    this.latched = 0;
  }

  stick(): StickState {
    const id = this.owners.get('move');
    const touch = id === undefined ? undefined : this.touches.get(id);
    if (!touch || !this.stickOrigin) return IDLE_STICK;
    return applyStick(
      touch.currentX - this.stickOrigin.x,
      touch.currentY - this.stickOrigin.y,
      TOUCH_METRICS.stickBaseRadiusPx,
      this.tuning,
    );
  }

  sample(): SourceSample {
    let held = 0;
    for (const role of this.owners.keys()) if (role !== 'move') held |= ROLE_BITS[role];
    const s = this.stick();
    return { moveX: s.x, moveY: s.y, held, latched: this.latched, aimMrad: null, lastUseMs: this.lastUseMs };
  }

  consumeLatched(): void {
    this.latched = 0;
  }

  takePause(): boolean {
    if (this.pauses === 0) return false;
    this.pauses = 0;
    return true;
  }

  /** For the on-screen view: who holds what, and where the stick sits. */
  view(): {
    readonly held: ReadonlySet<TouchControlRole>;
    readonly stickOrigin: { readonly x: number; readonly y: number } | null;
    readonly stickKnob: { readonly x: number; readonly y: number } | null;
  } {
    const s = this.stick();
    const origin = this.stickOrigin;
    const r = TOUCH_METRICS.stickBaseRadiusPx;
    return {
      held: new Set(this.owners.keys()),
      stickOrigin: origin,
      stickKnob: origin ? { x: origin.x + s.x * r, y: origin.y + s.y * r } : null,
    };
  }
}

/**
 * Touch Events on the game canvas only, non-passive so the browser never scrolls or zooms the game
 * (menus keep normal scrolling). Coordinates are relative to the canvas rectangle at event time.
 */
export function attachTouchListeners(
  canvas: HTMLElement,
  controls: TouchControls,
  now: () => number,
  onTouch?: () => void,
): () => void {
  const local = (t: Touch): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };
  const onStart = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const p = local(t);
      controls.begin(t.identifier, p.x, p.y, now());
    }
    onTouch?.();
  };
  const onMove = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const p = local(t);
      controls.move(t.identifier, p.x, p.y);
    }
  };
  const onEnd = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) controls.end(t.identifier);
  };
  const onPointerCancel = (): void => {
    controls.releaseAll();
  };
  const opts: AddEventListenerOptions = { passive: false };
  canvas.addEventListener('touchstart', onStart, opts);
  canvas.addEventListener('touchmove', onMove, opts);
  canvas.addEventListener('touchend', onEnd, opts);
  canvas.addEventListener('touchcancel', onEnd, opts);
  canvas.addEventListener('pointercancel', onPointerCancel);
  return () => {
    canvas.removeEventListener('touchstart', onStart);
    canvas.removeEventListener('touchmove', onMove);
    canvas.removeEventListener('touchend', onEnd);
    canvas.removeEventListener('touchcancel', onEnd);
    canvas.removeEventListener('pointercancel', onPointerCancel);
  };
}
