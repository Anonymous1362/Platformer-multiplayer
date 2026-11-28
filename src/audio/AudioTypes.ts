/** Mixer buses (spec 10.4, M4): master → {music, sfx, ui, voice, ambience}. */
export const BUSES = ['music', 'sfx', 'ui', 'voice', 'ambience'] as const;
export type Bus = (typeof BUSES)[number];

/** Voices per bus (N12). Music streams through its own path and is not voice-limited. */
export const VOICE_CAPS: Readonly<Record<Exclude<Bus, 'music'>, number>> = {
  sfx: 24,
  ui: 6,
  ambience: 4,
  voice: 2,
};

/** Minimum time between two starts of the same sound (N12). */
export const MIN_REPEAT_MS = 40;

/** Master limiter (spec 10.4): a compressor used as a limiter. */
export const LIMITER = { thresholdDb: -3, kneeDb: 0, ratio: 20, attackS: 0.003, releaseS: 0.25 } as const;

/**
 * Default levels until Settings (Pass 2B) stores the player's own. The master stays below unity so
 * a full mix reaches the limiter with headroom.
 */
export const DEFAULT_GAINS: Readonly<Record<Bus | 'master', number>> = {
  master: 0.8,
  music: 0.7,
  sfx: 0.8,
  ui: 0.6,
  voice: 1,
  ambience: 0.6,
};

/**
 * Night mode (spec 8.6 "Dynamic range"): a gentle compressor before the limiter plus make-up gain, so
 * quiet sounds come up and loud ones come down. Full mode leaves the stage transparent.
 */
export const NIGHT = {
  thresholdDb: -30,
  kneeDb: 10,
  ratio: 4,
  attackS: 0.01,
  releaseS: 0.3,
  makeupGain: 1.6,
} as const;

/** What the player's audio settings ask the mixer for (gains 0–1). */
export interface MixSettings {
  readonly gains: Readonly<Record<Bus | 'master', number>>;
  readonly mono: boolean;
  readonly night: boolean;
}

/** Stereo pan from screen position is at most ±0.6; off-screen sounds lose about 6 dB per screen width. */
export const SPACE = { maxPan: 0.6, offscreenDbPerScreen: -6 } as const;

/** Music ducking (spec 10.4): attack and release times. */
export const DUCK = { attackMs: 80, releaseMs: 400 } as const;
