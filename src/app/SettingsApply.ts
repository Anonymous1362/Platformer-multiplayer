import type Phaser from 'phaser';
import type { SoundEngine } from '../audio/SoundEngine';
import { busGains, fpsLimit, manualTier, stickTuning } from '../settings/Derived';
import { presetAutoFire } from '../input/TouchLayout';
import type { Settings } from '../settings/SettingsSchema';
import type { TouchLayoutStore } from '../settings/TouchLayoutStore';
import { semanticColors } from '../theme/ThemePalette';
import { glassAllowed } from '../ui/prefs';
import type { SettingsStore } from '../settings/SettingsStore';
import type { UiService } from '../ui/UiService';
import type { GameInput } from './GameInput';
import type { PerfBadge } from './PerfBadge';
import type { QualityGovernor } from './QualityGovernor';

export interface SettingsTargets {
  readonly audio: SoundEngine;
  readonly input: GameInput;
  readonly quality: QualityGovernor;
  readonly ui: UiService;
  readonly layouts: TouchLayoutStore;
  readonly game: Phaser.Game;
  readonly badge: () => PerfBadge | null;
  /** Safe Mode keeps the Battery tier whatever the preset says. */
  readonly safeMode: boolean;
}

/**
 * Live apply (spec 8.6): every change reaches the systems that exist now, the moment it is made.
 * Settings read only at a level start (difficulty, assists, particles, parallax, the level's reduced
 * motion) are read by the scene itself. Returns the unsubscribe function.
 */
export function applySettings(store: SettingsStore, t: SettingsTargets): () => void {
  let last: Settings | null = null;
  const applyTouch = (s: Settings): void => {
    const preset = s.controls.layoutPreset;
    t.input.setTouchPrefs({
      preset,
      floatingStick: s.controls.stickType === 'floating',
      buttonScale: s.controls.buttonSize / 100,
      opacity: s.controls.buttonOpacity,
      custom: (profile) => t.layouts.get(profile, preset),
    });
  };
  const offLayouts = t.layouts.subscribe(() => {
    applyTouch(store.get());
  });
  const apply = (): void => {
    const s = store.get();
    const prev = last;
    last = s;
    if (prev?.audio !== s.audio) {
      t.audio.setMix({ gains: busGains(s), mono: s.audio.mono, night: s.audio.dynamicRange === 'night' });
    }
    if (prev?.controls !== s.controls || prev.gameplay.autoFire !== s.gameplay.autoFire) {
      const tuning = stickTuning(s);
      t.input.touch.setTuning(tuning);
      t.input.gamepad.setTuning(tuning);
      applyTouch(s);
      t.input.router.setOptions({
        shoot: s.controls.shoot,
        // The Simple preset hides Shoot and fires on its own (spec 8.8).
        autoFire: s.gameplay.autoFire || presetAutoFire(s.controls.layoutPreset),
        aim: s.controls.aimMode,
      });
    }
    if (prev?.graphics !== s.graphics) {
      if (!t.safeMode) t.quality.setManual(manualTier(s), performance.now());
      t.game.loop.setFPSLimit(fpsLimit(s));
      t.badge()?.setVisible(s.graphics.showFps);
    }
    if (prev?.accessibility !== s.accessibility) {
      const a = s.accessibility;
      // High-contrast HUD also makes menu panels opaque with brighter outlines (spec 8.2 glass fallback).
      t.ui.prefs.patch({ motionMode: a.reduceMotion, highContrast: a.highContrastHud });
      if (a.highContrastHud) t.ui.prefs.patch({ glass: false });
      else t.ui.prefs.patch({ glass: glassAllowed(t.quality.tier, t.safeMode, false) });
      t.ui.setTextScale(a.textSize / 100);
      const colors = semanticColors(a.colorblind);
      t.ui.setSemantic(colors);
      t.input.touchView?.setColors(colors);
    }
  };
  apply();
  const offSettings = store.subscribe(apply);
  return () => {
    offSettings();
    offLayouts();
  };
}
