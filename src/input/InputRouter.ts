import { Button, type InputFrame } from '../core/InputTypes';

/** What every input adapter (touch, keyboard and mouse, gamepad) reports. */
export interface SourceSample {
  /** -1..1 after deadzone and curve; +y is down. */
  readonly moveX: number;
  readonly moveY: number;
  /** Buttons held right now. */
  readonly held: number;
  /** Buttons pressed at any moment since the last tick, even if already released. */
  readonly latched: number;
  /** Aim angle (world space, +y down) when this device is aiming, else null. */
  readonly aimMrad: number | null;
  /** When this device was last used (for on-screen glyphs). */
  readonly lastUseMs: number;
}

export interface InputSource {
  readonly kind: 'touch' | 'keyboard' | 'gamepad';
  sample(): SourceSample;
  consumeLatched(): void;
  releaseAll(): void;
  takePause(): boolean;
}

const AIM_LIMIT_MRAD = 3142;

/**
 * Merges every adapter into one `InputFrame` per simulation tick (spec section 14.1). Buttons are
 * OR-ed and latched: a press that started and ended between two ticks still reaches the next tick.
 * Movement takes the strongest stick, so keyboard and touch can be used at the same time.
 */
export class InputRouter {
  private readonly sources: readonly InputSource[];
  private last: InputFrame = { moveX: 0, moveY: 0, held: 0, aimMrad: 0 };
  private releases = 0;

  constructor(sources: readonly InputSource[]) {
    this.sources = sources;
  }

  /** Call exactly once per simulation tick. */
  nextFrame(): InputFrame {
    let held = 0;
    let moveX = 0;
    let moveY = 0;
    let best = 0;
    let aim: number | null = null;
    for (const source of this.sources) {
      const s = source.sample();
      held |= s.held | s.latched;
      const m = Math.hypot(s.moveX, s.moveY);
      if (m > best) {
        best = m;
        moveX = s.moveX;
        moveY = s.moveY;
      }
      if (aim === null && s.aimMrad !== null) aim = s.aimMrad;
      source.consumeLatched();
    }
    // A device aiming on purpose (mouse shooting, right stick) sets AimManual; otherwise the
    // simulation auto-aims (spec 4.2).
    if (aim !== null) held |= Button.AimManual;
    const aimMrad =
      aim === null ? this.last.aimMrad : Math.max(-AIM_LIMIT_MRAD, Math.min(AIM_LIMIT_MRAD, aim));
    this.last = { moveX, moveY, held, aimMrad };
    return this.last;
  }

  /** The last frame handed to the simulation (debug overlay and tests). */
  get lastFrame(): InputFrame {
    return this.last;
  }

  /** The most recently used device kind, for on-screen glyphs. */
  lastDevice(): InputSource['kind'] | null {
    let kind: InputSource['kind'] | null = null;
    let latest = Number.NEGATIVE_INFINITY;
    for (const source of this.sources) {
      const t = source.sample().lastUseMs;
      if (t > latest) {
        latest = t;
        kind = source.kind;
      }
    }
    return kind;
  }

  /** True once per pause press from any device. */
  takePause(): boolean {
    let any = false;
    for (const source of this.sources) if (source.takePause()) any = true;
    return any;
  }

  /**
   * M6: release every touch, clear held keys and buttons, reset edges, zero the stick. Called on blur,
   * hidden visibility, pointer cancel, orientation change, pause, panel open, and scene change.
   */
  releaseAll(): void {
    for (const source of this.sources) source.releaseAll();
    this.last = { moveX: 0, moveY: 0, held: 0, aimMrad: this.last.aimMrad };
    this.releases += 1;
  }

  /** How many times input was released (tests and the debug overlay). */
  get releaseCount(): number {
    return this.releases;
  }
}

/** Page events that release all input (M6); hidden visibility is handled separately. */
const WINDOW_RELEASE_EVENTS = ['blur', 'pagehide', 'orientationchange', 'pointercancel'] as const;

export interface CleanupTargets {
  readonly window: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  readonly document: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> & {
    readonly visibilityState: string;
  };
}

/**
 * Installs the M6 cleanup triggers that come from the page: blur, hidden visibility, page hide,
 * orientation change, and pointer cancel. `onInterrupted` lets the scene pause and reset its loop.
 * Returns an uninstall function.
 */
export function installInputCleanup(
  router: InputRouter,
  targets: CleanupTargets,
  onInterrupted: (reason: string) => void = () => undefined,
): () => void {
  const release = (reason: string): void => {
    router.releaseAll();
    onInterrupted(reason);
  };
  type Target = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  const handlers: [Target, string, () => void][] = WINDOW_RELEASE_EVENTS.map((type) => [
    targets.window,
    type,
    () => {
      release(type);
    },
  ]);
  handlers.push([
    targets.document,
    'visibilitychange',
    () => {
      if (targets.document.visibilityState === 'hidden') release('hidden');
    },
  ]);
  for (const [target, type, handler] of handlers) target.addEventListener(type, handler);
  return () => {
    for (const [target, type, handler] of handlers) target.removeEventListener(type, handler);
  };
}
