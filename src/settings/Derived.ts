import type { Bus } from '../audio/AudioTypes';
import type { DifficultyId } from '../core/Ids';
import type { StickTuning } from '../input/StickMath';
import type { FxPrefs, QualityTier } from '../render/fx/FxMath';
import type { Settings } from './SettingsSchema';

/**
 * Pure mappings from stored settings to what each system consumes. Kept apart from the systems so the
 * mapping is unit-tested and the systems never read the settings document directly.
 */

/** Slider value 0–100 → linear gain (80 → 0.8, matching the Pass 1E mix). */
export function busGains(s: Settings): Readonly<Record<Bus | 'master', number>> {
  const g = (v: number): number => Math.min(1, Math.max(0, v / 100));
  return {
    master: g(s.audio.master),
    music: g(s.audio.music),
    sfx: g(s.audio.sfx),
    ui: g(s.audio.ui),
    voice: g(s.audio.voice),
    // Ambience has no slider of its own; it follows the SFX level (Pass 1E ratio 0.6 / 0.8).
    ambience: g(s.audio.sfx) * 0.75,
  };
}

export function stickTuning(s: Settings): StickTuning {
  return {
    inner: s.controls.deadzone / 100,
    outer: s.controls.saturation / 100,
    exponent: s.controls.curve / 10,
  };
}

export function fxPrefs(s: Settings): FxPrefs {
  return {
    shake: s.gameplay.cameraShake / 100,
    hitStop: s.gameplay.hitStop,
    flashes: s.gameplay.screenFlashes,
    damageNumbers: s.gameplay.damageNumbers,
  };
}

/** The quality preset: null means automatic (the governor decides). */
export function manualTier(s: Settings): QualityTier | null {
  return s.graphics.preset === 'auto' ? null : s.graphics.preset;
}

/** Frame-rate cap in frames per second; 0 means the display's maximum. */
export function fpsLimit(s: Settings): number {
  return s.graphics.fpsCap === 'max' ? 0 : Number(s.graphics.fpsCap);
}

/** Drift+ unlocks after the campaign (not built yet), so until then it plays as Hard. */
export function levelDifficulty(s: Settings, driftPlusUnlocked: boolean): DifficultyId {
  const d = s.gameplay.difficulty;
  return d === 'drift_plus' && !driftPlusUnlocked ? 'hard' : d;
}

export function resolvedReducedMotion(s: Settings, systemReduced: boolean): boolean {
  const mode = s.accessibility.reduceMotion;
  return mode === 'system' ? systemReduced : mode === 'on';
}
