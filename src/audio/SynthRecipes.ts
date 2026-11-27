import type { Bus } from './AudioTypes';

/**
 * Procedural SFX (spec 10.5): every sound key has a Web Audio synth recipe, so the game is never silent
 * while real recordings do not exist yet. Recipes are plain data: oscillator and filtered-noise layers
 * with an attack and an exponential decay. Real files replace a key through the manifest later.
 */

export interface ToneLayer {
  readonly kind: 'tone';
  readonly wave: 'sine' | 'square' | 'sawtooth' | 'triangle';
  readonly freq: number;
  /** Frequency at the end of the layer (exponential glide). */
  readonly freqEnd?: number;
  readonly gain: number;
  readonly attack: number;
  readonly decay: number;
  readonly delay?: number;
}

export interface NoiseLayer {
  readonly kind: 'noise';
  readonly filter: 'lowpass' | 'highpass' | 'bandpass';
  readonly freq: number;
  readonly freqEnd?: number;
  readonly q?: number;
  readonly gain: number;
  readonly attack: number;
  readonly decay: number;
  readonly delay?: number;
}

export type Layer = ToneLayer | NoiseLayer;

export interface Recipe {
  readonly bus: Exclude<Bus, 'music'>;
  readonly layers: readonly Layer[];
  /** Sustains after the attack until stopped; `decay` is then the release. */
  readonly loop?: boolean;
  /** Random pitch variation (±fraction) for frequent sounds (spec 10.4: 3–5%). */
  readonly vary?: number;
}

const tone = (
  wave: ToneLayer['wave'],
  freq: number,
  freqEnd: number | undefined,
  gain: number,
  attack: number,
  decay: number,
  delay = 0,
): ToneLayer => ({
  kind: 'tone',
  wave,
  freq,
  ...(freqEnd === undefined ? {} : { freqEnd }),
  gain,
  attack,
  decay,
  delay,
});

const noise = (
  filter: NoiseLayer['filter'],
  freq: number,
  freqEnd: number | undefined,
  gain: number,
  attack: number,
  decay: number,
  q = 0.7,
  delay = 0,
): NoiseLayer => ({
  kind: 'noise',
  filter,
  freq,
  ...(freqEnd === undefined ? {} : { freqEnd }),
  q,
  gain,
  attack,
  decay,
  delay,
});

export const RECIPES = {
  sfx_jump: {
    bus: 'sfx',
    vary: 0.04,
    layers: [
      tone('square', 330, 620, 0.12, 0.004, 0.12),
      noise('highpass', 3000, undefined, 0.05, 0.002, 0.05),
    ],
  },
  sfx_land: {
    bus: 'sfx',
    vary: 0.05,
    layers: [noise('lowpass', 900, 200, 0.3, 0.002, 0.16), tone('sine', 120, 60, 0.26, 0.002, 0.12)],
  },
  sfx_dash: {
    bus: 'sfx',
    vary: 0.03,
    layers: [
      noise('bandpass', 1200, 4000, 0.32, 0.01, 0.22, 0.8),
      tone('sawtooth', 220, 110, 0.06, 0.005, 0.15),
    ],
  },
  sfx_jetpack_loop: {
    bus: 'sfx',
    loop: true,
    layers: [
      noise('bandpass', 900, undefined, 0.14, 0.06, 0.08, 0.7),
      noise('lowpass', 300, undefined, 0.1, 0.06, 0.08),
    ],
  },
  sfx_shoot_pulse_blaster: {
    bus: 'sfx',
    vary: 0.04,
    layers: [tone('square', 880, 220, 0.11, 0.002, 0.09), tone('sine', 1760, 440, 0.06, 0.002, 0.06)],
  },
  sfx_overheat_vent: {
    bus: 'sfx',
    layers: [noise('highpass', 2000, 600, 0.26, 0.02, 0.7), tone('sawtooth', 140, 70, 0.05, 0.01, 0.4)],
  },
  sfx_impact_metal: {
    bus: 'sfx',
    vary: 0.05,
    layers: [
      noise('bandpass', 3200, undefined, 0.2, 0.001, 0.08, 3),
      tone('triangle', 1400, 900, 0.06, 0.001, 0.1),
    ],
  },
  sfx_crawler_alert: {
    bus: 'sfx',
    layers: [
      tone('square', 660, undefined, 0.1, 0.004, 0.08),
      tone('square', 990, undefined, 0.1, 0.004, 0.09, 0.07),
    ],
  },
  sfx_crawler_windup: {
    bus: 'sfx',
    layers: [tone('sawtooth', 90, 260, 0.1, 0.25, 0.12), noise('lowpass', 400, 1200, 0.1, 0.25, 0.1)],
  },
  sfx_crawler_hurt: {
    bus: 'sfx',
    vary: 0.05,
    layers: [
      tone('square', 300, 150, 0.12, 0.002, 0.08),
      noise('bandpass', 2000, undefined, 0.1, 0.001, 0.05, 1.2),
    ],
  },
  sfx_crawler_death: {
    bus: 'sfx',
    vary: 0.03,
    layers: [
      noise('lowpass', 2000, 150, 0.3, 0.002, 0.45),
      tone('sawtooth', 400, 60, 0.1, 0.002, 0.4),
      tone('sine', 1200, 2400, 0.05, 0.02, 0.3, 0.05),
    ],
  },
  sfx_hurt: {
    bus: 'sfx',
    vary: 0.03,
    layers: [
      tone('sawtooth', 240, 120, 0.16, 0.003, 0.18),
      noise('lowpass', 1500, undefined, 0.18, 0.002, 0.1),
    ],
  },
  sfx_death: {
    bus: 'sfx',
    layers: [tone('sawtooth', 300, 40, 0.18, 0.01, 0.9), noise('lowpass', 1200, 100, 0.22, 0.005, 0.8)],
  },
  sfx_revive: {
    bus: 'sfx',
    layers: [tone('sine', 440, 880, 0.12, 0.05, 0.35), tone('triangle', 660, 1320, 0.07, 0.05, 0.3, 0.08)],
  },
  sfx_shard_pickup: {
    bus: 'sfx',
    layers: [
      tone('sine', 1320, undefined, 0.12, 0.002, 0.12),
      tone('triangle', 1980, undefined, 0.06, 0.002, 0.1, 0.03),
    ],
  },
  sfx_checkpoint: {
    bus: 'sfx',
    layers: [
      tone('sine', 523, undefined, 0.12, 0.01, 0.4),
      tone('sine', 659, undefined, 0.12, 0.01, 0.4, 0.08),
      tone('sine', 784, undefined, 0.12, 0.01, 0.5, 0.16),
    ],
  },
  sfx_level_complete: {
    bus: 'sfx',
    layers: [
      tone('triangle', 523, undefined, 0.12, 0.01, 0.5),
      tone('triangle', 659, undefined, 0.12, 0.01, 0.5, 0.12),
      tone('triangle', 784, undefined, 0.12, 0.01, 0.5, 0.24),
      tone('sine', 1046, undefined, 0.14, 0.01, 0.8, 0.36),
    ],
  },
  sfx_heartbeat: {
    bus: 'sfx',
    layers: [tone('sine', 62, 45, 0.3, 0.005, 0.12), tone('sine', 58, 42, 0.22, 0.005, 0.12, 0.18)],
  },
  sfx_footstep: {
    bus: 'sfx',
    vary: 0.05,
    layers: [noise('lowpass', 900, 300, 0.08, 0.002, 0.07)],
  },
  sfx_ui_tap: { bus: 'ui', layers: [tone('triangle', 1000, undefined, 0.08, 0.002, 0.05)] },
  sfx_ui_back: { bus: 'ui', layers: [tone('triangle', 700, 500, 0.08, 0.002, 0.07)] },
  sfx_ui_toggle: {
    bus: 'ui',
    layers: [
      tone('triangle', 820, undefined, 0.07, 0.002, 0.04),
      tone('triangle', 1230, undefined, 0.07, 0.002, 0.05, 0.04),
    ],
  },
  sfx_ui_error: { bus: 'ui', layers: [tone('square', 180, 130, 0.07, 0.002, 0.14)] },
} as const satisfies Readonly<Record<string, Recipe>>;

export type SfxKey = keyof typeof RECIPES;

export function recipeFor(key: SfxKey): Recipe {
  return RECIPES[key];
}

/** Seconds until a one-shot recipe is silent (loops: attack only, they sustain until stopped). */
export function recipeDuration(recipe: Recipe): number {
  let end = 0;
  for (const l of recipe.layers) end = Math.max(end, (l.delay ?? 0) + l.attack + (recipe.loop ? 0 : l.decay));
  return end;
}
