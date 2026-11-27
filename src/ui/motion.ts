/**
 * Motion system (spec 8.4): tokens, spring easings, and one spec per transition with a reduced-motion
 * variant. Everything animates only `transform` and `opacity`; the pure parts are unit-tested.
 */

export const Duration = { instant: 80, fast: 140, base: 220, slow: 360, cinematic: 700 } as const;

export const Easing = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasizedDecel: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  accel: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
  linear: 'linear',
} as const;

export interface SpringSpec {
  readonly stiffness: number;
  readonly damping: number;
}

/** Springs have mass 1. */
export const Spring = {
  snappy: { stiffness: 420, damping: 32 },
  gentle: { stiffness: 220, damping: 26 },
  bouncy: { stiffness: 300, damping: 18 },
} as const satisfies Readonly<Record<string, SpringSpec>>;

/** Position of a unit step response at `t` seconds (0 at t = 0, settles at 1). */
export function springPosition(spring: SpringSpec, t: number): number {
  const { stiffness: k, damping: c } = spring;
  const w0 = Math.sqrt(k);
  const zeta = c / (2 * w0);
  if (t <= 0) return 0;
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  if (zeta === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const s = w0 * Math.sqrt(zeta * zeta - 1);
  const r1 = -zeta * w0 + s;
  const r2 = -zeta * w0 - s;
  return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

/** Milliseconds until the spring stays within 0.2% of its target (capped at 1.5 s). */
export function springDurationMs(spring: SpringSpec): number {
  let last = 0;
  for (let ms = 0; ms <= 1500; ms += 4) {
    if (Math.abs(springPosition(spring, ms / 1000) - 1) > 0.002) last = ms;
  }
  return Math.min(1500, last + 4);
}

/** A CSS `linear()` easing sampled from the spring, so springs run on the compositor. */
export function springEasing(spring: SpringSpec, samples = 24): string {
  const duration = springDurationMs(spring) / 1000;
  const points: string[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const value = i === samples ? 1 : springPosition(spring, (duration * i) / samples);
    points.push((Math.round(value * 1000) / 1000).toString());
  }
  return `linear(${points.join(', ')})`;
}

export interface MotionSpec {
  readonly keyframes: Keyframe[];
  readonly options: KeyframeAnimationOptions;
}

/** The properties a keyframe list touches (everything except offset, easing, composite). */
export function animatedProperties(keyframes: readonly Keyframe[]): string[] {
  const props = new Set<string>();
  for (const frame of keyframes) {
    for (const key of Object.keys(frame)) {
      if (key !== 'offset' && key !== 'easing' && key !== 'composite') props.add(key);
    }
  }
  return [...props].sort();
}

const fade = (duration: number, from = 0, to = 1): MotionSpec => ({
  keyframes: [{ opacity: from }, { opacity: to }],
  options: { duration, easing: Easing.linear, fill: 'both' },
});

export interface MotionParams {
  /** Direction of travel for tab switches: 1 forward, -1 back. */
  readonly direction?: 1 | -1;
  /** Stagger index for list entrances. */
  readonly index?: number;
  /** Transform origin for the settings pop-up, e.g. "92% 8%". */
  readonly origin?: string;
}

export type MotionKind =
  | 'backdropIn'
  | 'backdropOut'
  | 'panelOpen'
  | 'panelClose'
  | 'sideSheetOpen'
  | 'sideSheetClose'
  | 'settingsPopup'
  | 'tabSwitch'
  | 'listEntrance'
  | 'buttonPress'
  | 'buttonRelease'
  | 'toastIn'
  | 'toastOut'
  | 'logoAssemble';

/** Stagger between list items (ms) and how many items stagger. */
export const LIST_STAGGER_MS = 30;
export const LIST_STAGGER_MAX = 8;

type Builder = (reduced: boolean, params: MotionParams) => MotionSpec;

export const MOTIONS: Readonly<Record<MotionKind, Builder>> = {
  backdropIn: () => fade(160),
  backdropOut: () => fade(140, 1, 0),
  panelOpen: (reduced) =>
    reduced
      ? fade(120)
      : {
          keyframes: [
            { opacity: 0, transform: 'translateY(12px) scale(0.94)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' },
          ],
          options: { duration: Duration.base, easing: Easing.emphasizedDecel, fill: 'both' },
        },
  panelClose: (reduced) =>
    reduced
      ? fade(120, 1, 0)
      : {
          keyframes: [
            { opacity: 1, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(0.97)' },
          ],
          options: { duration: Duration.fast, easing: Easing.accel, fill: 'both' },
        },
  sideSheetOpen: (reduced) =>
    reduced
      ? fade(120)
      : {
          keyframes: [
            { opacity: 0.4, transform: 'translateX(100%)' },
            { opacity: 1, transform: 'translateX(0)' },
          ],
          options: {
            duration: springDurationMs(Spring.gentle),
            easing: springEasing(Spring.gentle),
            fill: 'both',
          },
        },
  sideSheetClose: (reduced) =>
    reduced
      ? fade(120, 1, 0)
      : {
          keyframes: [
            { opacity: 1, transform: 'translateX(0)' },
            { opacity: 0, transform: 'translateX(100%)' },
          ],
          options: { duration: Duration.base, easing: Easing.accel, fill: 'both' },
        },
  settingsPopup: (reduced, params) =>
    reduced
      ? fade(120)
      : {
          keyframes: [
            { opacity: 0, transform: 'scale(0.4)', transformOrigin: params.origin ?? '50% 50%' },
            { opacity: 1, transform: 'scale(1)', transformOrigin: params.origin ?? '50% 50%' },
          ],
          options: {
            duration: springDurationMs(Spring.snappy),
            easing: springEasing(Spring.snappy),
            fill: 'both',
          },
        },
  tabSwitch: (reduced, params) =>
    reduced
      ? fade(180)
      : {
          keyframes: [
            { opacity: 0, transform: `translateX(${String(16 * (params.direction ?? 1))}px)` },
            { opacity: 1, transform: 'translateX(0)' },
          ],
          options: { duration: 180, easing: Easing.standard, fill: 'both' },
        },
  listEntrance: (reduced, params) => {
    if (reduced) return fade(120);
    const index = Math.min(params.index ?? 0, LIST_STAGGER_MAX - 1);
    return {
      keyframes: [
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      options: {
        duration: Duration.base,
        easing: Easing.emphasizedDecel,
        delay: index * LIST_STAGGER_MS,
        fill: 'both',
      },
    };
  },
  // Reduced motion: colour change only, which CSS handles; the animation itself is a no-op.
  buttonPress: (reduced) =>
    reduced
      ? { keyframes: [{ opacity: 1 }, { opacity: 1 }], options: { duration: 1, fill: 'both' } }
      : {
          keyframes: [{ transform: 'scale(1)' }, { transform: 'scale(0.93)' }],
          options: { duration: Duration.instant, easing: Easing.standard, fill: 'both' },
        },
  buttonRelease: (reduced) =>
    reduced
      ? { keyframes: [{ opacity: 1 }, { opacity: 1 }], options: { duration: 1, fill: 'both' } }
      : {
          keyframes: [{ transform: 'scale(0.93)' }, { transform: 'scale(1)' }],
          options: {
            duration: springDurationMs(Spring.bouncy),
            easing: springEasing(Spring.bouncy),
            fill: 'both',
          },
        },
  toastIn: (reduced) =>
    reduced
      ? fade(120)
      : {
          keyframes: [
            { opacity: 0, transform: 'translateY(-24px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          options: { duration: Duration.base, easing: Easing.emphasizedDecel, fill: 'both' },
        },
  toastOut: () => fade(Duration.fast, 1, 0),
  // The logo assembles from shards over 1.2 s; the reduced variant is a quick fade.
  logoAssemble: (reduced, params) => {
    if (reduced) return fade(120);
    const index = params.index ?? 0;
    return {
      keyframes: [
        {
          opacity: 0,
          transform: 'translate(var(--dx, 0px), var(--dy, 0px)) rotate(var(--rot, 0deg)) scale(0.6)',
        },
        { opacity: 1, transform: 'translate(0, 0) rotate(0deg) scale(1)' },
      ],
      options: {
        duration: 800,
        delay: Math.min(index, 12) * 32,
        easing: Easing.emphasizedDecel,
        fill: 'both',
      },
    };
  },
};

/** Total time (ms) of a motion including its delay, for scheduling removals. */
export function motionTotalMs(spec: MotionSpec): number {
  const duration = typeof spec.options.duration === 'number' ? spec.options.duration : 0;
  const delay = typeof spec.options.delay === 'number' ? spec.options.delay : 0;
  return duration + delay;
}

/** Plays a motion; returns the animation, or null where the Web Animations API is missing. */
export function play(
  element: Element | null,
  kind: MotionKind,
  reduced: boolean,
  params: MotionParams = {},
): Animation | null {
  if (!element || typeof element.animate !== 'function') return null;
  const spec = MOTIONS[kind](reduced, params);
  return element.animate(spec.keyframes, spec.options);
}

/** Counter roll (spec 8.4): 600 ms ease-out from `from` to `to`; instant under reduced motion. */
export const COUNTER_MS = 600;

export function counterValue(from: number, to: number, elapsedMs: number, reduced: boolean): number {
  if (reduced || elapsedMs >= COUNTER_MS) return to;
  if (elapsedMs <= 0) return from;
  const t = elapsedMs / COUNTER_MS;
  const eased = 1 - (1 - t) * (1 - t) * (1 - t);
  return Math.round(from + (to - from) * eased);
}

/** Deterministic offsets for the logo shards (visual only, so no simulation RNG is involved). */
export function logoShardOffset(index: number): { dx: number; dy: number; rot: number } {
  const a = Math.sin((index + 1) * 12.9898) * 43758.5453;
  const b = Math.sin((index + 1) * 78.233) * 12345.6789;
  const fa = a - Math.floor(a);
  const fb = b - Math.floor(b);
  return {
    dx: Math.round((fa - 0.5) * 240),
    dy: Math.round((fb - 0.5) * 160),
    rot: Math.round((fa - fb) * 180),
  };
}
