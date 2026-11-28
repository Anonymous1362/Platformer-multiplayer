import type Phaser from 'phaser';
import { DEFAULT_WORLD_COLORS, type WorldColors } from '../../theme/ThemePalette';
import { Depth } from '../world/Depth';
import { DEFAULT_FX_PREFS, flashScale, type FxPrefs } from './FxMath';

const DAMAGE_FLASH_MS = 350;
const DAMAGE_FLASH_ALPHA = 0.5;
const LOW_HP_PERIOD_MS = 1100;
const OUTLINE_U = 6;

/**
 * Full-screen feedback (spec 8.7): a damage vignette on every hit and, below 25% HP, a slow vignette
 * pulse; under reduced motion the pulse becomes a steady red outline. Hidden when idle, so it costs
 * no fill rate most of the time.
 */
export class ScreenFx {
  private readonly vignette: Phaser.GameObjects.Image;
  private readonly outline: Phaser.GameObjects.Graphics;
  private readonly reducedMotion: boolean;
  private flashLeftMs = 0;
  private timeMs = 0;
  private outlineKey = '';

  private readonly prefs: () => FxPrefs;
  private readonly danger: number;

  constructor(
    scene: Phaser.Scene,
    reducedMotion: boolean,
    prefs: () => FxPrefs = () => DEFAULT_FX_PREFS,
    colors: WorldColors = DEFAULT_WORLD_COLORS,
  ) {
    this.danger = colors.danger;
    this.reducedMotion = reducedMotion;
    this.prefs = prefs;
    this.vignette = scene.add
      .image(0, 0, 'fx_vignette')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(Depth.Screen)
      .setTint(this.danger)
      .setVisible(false);
    this.outline = scene.add.graphics().setScrollFactor(0).setDepth(Depth.Screen).setVisible(false);
  }

  flashDamage(): void {
    this.flashLeftMs = DAMAGE_FLASH_MS;
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, dtMs: number, lowHp: boolean): void {
    this.timeMs += dtMs;
    this.flashLeftMs = Math.max(0, this.flashLeftMs - dtMs);
    const flash =
      (this.flashLeftMs / DAMAGE_FLASH_MS) * DAMAGE_FLASH_ALPHA * flashScale(this.prefs().flashes);
    const pulse =
      lowHp && !this.reducedMotion
        ? 0.16 + 0.14 * (0.5 + 0.5 * Math.sin((this.timeMs / LOW_HP_PERIOD_MS) * Math.PI * 2))
        : 0;
    const alpha = Math.max(flash, pulse);

    // Screen-fixed objects still scale with zoom around the view center: cover the zoomed view.
    const w = camera.width / camera.zoom;
    const h = camera.height / camera.zoom;
    const x0 = (camera.width - w) / 2;
    const y0 = (camera.height - h) / 2;
    this.vignette.setVisible(alpha > 0.01);
    if (alpha > 0.01) this.vignette.setPosition(x0, y0).setDisplaySize(w, h).setAlpha(alpha);

    const showOutline = lowHp && this.reducedMotion;
    this.outline.setVisible(showOutline);
    const key = `${String(x0)},${String(y0)},${String(w)},${String(h)}`;
    if (showOutline && key !== this.outlineKey) {
      this.outlineKey = key;
      const t = OUTLINE_U / camera.zoom;
      this.outline
        .clear()
        .lineStyle(t, this.danger, 0.9)
        .strokeRect(x0 + t / 2, y0 + t / 2, w - t, h - t);
    }
  }
}
