/**
 * Pure helpers for render-only feel (spec 13.6–13.8). No Phaser, so they are unit-tested in Node.
 */

/** Camera shake (spec 13.6): offset = trauma² × 18 u, rotation trauma² × 1.5°, trauma decays 1.6/s. */
export const SHAKE = {
  maxOffsetU: 18,
  maxRotationDeg: 1.5,
  decayPerS: 1.6,
  /** Under reduced motion, shake is capped at 25%. */
  reducedMotionCap: 0.25,
} as const;

/** Hit-stop (spec 13.7): involved sprites freeze and the camera kicks for 45 ms. */
export const HIT_STOP_MS = 45;
/** Hit flash on the target (spec 13.8). */
export const HIT_FLASH_MS = 60;

/** Particle caps by quality tier (spec 13.8). Adaptive quality picks the tier in 1F; Balanced until then. */
export const PARTICLE_CAPS = { battery: 300, balanced: 600, high: 1200 } as const;
export type QualityTier = keyof typeof PARTICLE_CAPS;

export function decayTrauma(trauma: number, dtS: number): number {
  return Math.max(0, trauma - SHAKE.decayPerS * dtS);
}

/** 0..1 shake strength for a trauma level; capped under reduced motion. */
export function shakeStrength(trauma: number, reducedMotion: boolean): number {
  const t = Math.min(1, Math.max(0, trauma));
  const s = t * t;
  return reducedMotion ? Math.min(s, SHAKE.reducedMotionCap) : s;
}

/** Frame-rate independent exponential follow: `perFrame` is the 60 fps lerp factor. */
export function followFactor(perFrame: number, dtMs: number): number {
  if (dtMs <= 0) return 0;
  return 1 - (1 - perFrame) ** (dtMs / (1000 / 60));
}

/** Low-HP warning threshold (spec 8.7): below 25% HP. */
export function isLowHp(hp: number, maxHp: number): boolean {
  return maxHp > 0 && hp > 0 && hp / maxHp < 0.25;
}

/** Landing dust and squash play only for falls above 2 tiles (spec 13.8). */
export const BIG_LANDING_U = 128;

/** Linear 0..1 progress of an effect that started at `startMs` and lasts `durationMs`. */
export function progress(nowMs: number, startMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, (nowMs - startMs) / durationMs));
}

/** Player effect settings (spec 8.6 Gameplay), read live every frame so changes apply at once. */
export interface FxPrefs {
  /** Camera shake scale, 0 to 1 (Settings: 0–100). */
  readonly shake: number;
  readonly hitStop: boolean;
  /**
   * Full: as designed. Reduced (default): the damage vignette at half strength. Off: no vignette and no
   * white hit flash on sprites (a hit still shows sparks, knockback, and the sound).
   */
  readonly flashes: 'full' | 'reduced' | 'off';
  readonly damageNumbers: boolean;
}

export const DEFAULT_FX_PREFS: FxPrefs = { shake: 1, hitStop: true, flashes: 'reduced', damageNumbers: true };

/** Damage vignette strength for the flash setting. */
export function flashScale(flashes: FxPrefs['flashes']): number {
  return flashes === 'full' ? 1 : flashes === 'reduced' ? 0.5 : 0;
}
