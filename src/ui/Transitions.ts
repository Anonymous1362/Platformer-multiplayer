import { Duration, Easing } from './motion';

export type TransitionKind = 'fade' | 'iris';

export interface TransitionOptions {
  readonly kind: TransitionKind;
  readonly reduced: boolean;
  /** Iris centre in CSS pixels relative to the host (default: the middle). */
  readonly origin?: { readonly x: number; readonly y: number };
}

/** Phases of a transition in milliseconds (spec 8.4): menu fade 300 total, iris 450 total. */
export function transitionTimings(kind: TransitionKind, reduced: boolean): { cover: number; reveal: number } {
  if (reduced) return { cover: 150, reveal: 150 };
  return kind === 'iris' ? { cover: 300, reveal: 150 } : { cover: 150, reveal: 150 };
}

/** Radius of a circle centred on `origin` that covers a width x height rectangle. */
export function coverRadius(width: number, height: number, origin: { x: number; y: number }): number {
  const dx = Math.max(origin.x, width - origin.x);
  const dy = Math.max(origin.y, height - origin.y);
  return Math.ceil(Math.hypot(dx, dy)) + 2;
}

function animate(
  element: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Promise<void> {
  if (typeof element.animate !== 'function') {
    return new Promise((resolve) => {
      window.setTimeout(resolve, Number(options.duration ?? 0));
    });
  }
  return element.animate(keyframes, options).finished.then(
    () => undefined,
    () => undefined,
  );
}

/**
 * Scene transitions as a DOM overlay: a fade through `bg.deep`, or an iris wipe (a disc scaled up from the
 * origin, then a fade). Only transform and opacity animate. The overlay swallows input while it runs, and
 * `midpoint` runs when the screen is fully covered (that is where the scene switches).
 */
export class Transitions {
  private readonly host: HTMLElement;
  private phase: 'idle' | 'cover' | 'reveal' = 'idle';
  private tail: Promise<void> = Promise.resolve();

  constructor(host: HTMLElement) {
    this.host = host;
  }

  /** The screen is being covered: input must wait. During the reveal the new screen already takes input. */
  get covering(): boolean {
    return this.phase === 'cover';
  }

  get busy(): boolean {
    return this.phase !== 'idle';
  }

  /** Runs after any transition already in progress, so two never overlap. */
  run(options: TransitionOptions, midpoint: () => void | Promise<void>): Promise<void> {
    const next = this.tail.then(() => this.runOne(options, midpoint));
    this.tail = next.catch(() => undefined);
    return next;
  }

  private async runOne(options: TransitionOptions, midpoint: () => void | Promise<void>): Promise<void> {
    this.phase = 'cover';
    const overlay = document.createElement('div');
    overlay.className = 'cd-transition';
    overlay.dataset['role'] = 'transition';
    overlay.setAttribute('aria-hidden', 'true');
    const fade = document.createElement('div');
    fade.className = 'cd-transition-fade';
    overlay.append(fade);
    this.host.append(overlay);
    const { cover, reveal } = transitionTimings(options.kind, options.reduced);
    try {
      if (options.kind === 'iris' && !options.reduced) {
        const rect = this.host.getBoundingClientRect();
        const origin = options.origin ?? { x: rect.width / 2, y: rect.height / 2 };
        const radius = coverRadius(rect.width, rect.height, origin);
        const disc = document.createElement('div');
        disc.className = 'cd-transition-disc';
        Object.assign(disc.style, {
          width: `${String(radius * 2)}px`,
          height: `${String(radius * 2)}px`,
          left: `${String(origin.x - radius)}px`,
          top: `${String(origin.y - radius)}px`,
        });
        overlay.append(disc);
        await animate(disc, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], {
          duration: cover,
          easing: Easing.standard,
          fill: 'forwards',
        });
        fade.style.opacity = '1';
        disc.remove();
      } else {
        await animate(fade, [{ opacity: 0 }, { opacity: 1 }], {
          duration: cover,
          easing: Easing.linear,
          fill: 'forwards',
        });
      }
      await midpoint();
      // The new screen is live from here: taps and keys reach it while the veil fades.
      this.phase = 'reveal';
      overlay.style.pointerEvents = 'none';
      await animate(fade, [{ opacity: 1 }, { opacity: 0 }], {
        duration: Math.max(reveal, Duration.instant),
        easing: Easing.linear,
        fill: 'forwards',
      });
    } finally {
      overlay.remove();
      this.phase = 'idle';
    }
  }
}
