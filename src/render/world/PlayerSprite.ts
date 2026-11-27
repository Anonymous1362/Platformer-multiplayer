import Phaser from 'phaser';
import { Ticks } from '../../core/GameConfig';
import type { PlayerState } from '../../core/SimulationTypes';
import { Palette, slotColor } from '../../theme/ThemePalette';
import type { EntityFx } from '../fx/EntityFx';
import { Depth } from './Depth';
import type { RenderPose } from './Poses';

/**
 * One astronaut: a rim-light layer tinted by the planet (spec 9.3), the slot-tinted suit, untinted
 * details, and a jetpack flame. Hit flash, hit-stop freeze, landing squash, and recoil come from the
 * effects; invulnerability blinks, or shows a steady outline under reduced motion.
 */
export class PlayerSprite {
  private readonly rim: Phaser.GameObjects.Image;
  private readonly suit: Phaser.GameObjects.Image;
  private readonly detail: Phaser.GameObjects.Image;
  private readonly flame: Phaser.GameObjects.Image;
  private readonly color: number;
  private readonly rimColor: number;
  private readonly reducedMotion: boolean;
  private pose: RenderPose = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, slot: number, rimColor: number, reducedMotion: boolean) {
    this.color = slotColor(slot);
    this.rimColor = rimColor;
    this.reducedMotion = reducedMotion;
    this.flame = scene.add
      .image(0, 0, 'fx_glow')
      .setDepth(Depth.Players - 0.2)
      .setTint(Palette.starlightGold)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.rim = scene.add
      .image(0, 0, 'char_player_suit')
      .setOrigin(0.5, 1)
      .setDepth(Depth.Players - 0.1);
    this.suit = scene.add.image(0, 0, 'char_player_suit').setOrigin(0.5, 1).setDepth(Depth.Players);
    this.detail = scene.add
      .image(0, 0, 'char_player_detail')
      .setOrigin(0.5, 1)
      .setDepth(Depth.Players + 0.1);
  }

  get current(): RenderPose {
    return this.pose;
  }

  update(pose: RenderPose, p: PlayerState, fx: EntityFx, timeMs: number): void {
    if (!fx.frozen(p.id)) this.pose = pose; // hit-stop holds the last drawn pose
    const flip = p.facing < 0;
    const x = this.pose.x - p.facing * fx.recoil(p.id);
    const { sx, sy } = fx.squash(p.id);
    const flash = fx.flashing(p.id);
    const invuln = p.invulnTicks > 0 && p.mode !== 'dead';

    let alpha = 1;
    if (p.mode === 'dead') alpha = 0.25;
    else if (p.mode === 'hazardRespawn') {
      const half = Ticks.hazardRespawn / 2;
      alpha = Math.min(1, Math.abs(p.modeTicks - half) / half);
    } else if (invuln && !this.reducedMotion) alpha = Math.floor(p.invulnTicks / 4) % 2 === 0 ? 0.45 : 1;

    for (const img of [this.suit, this.detail]) {
      img.setPosition(x, this.pose.y).setScale(sx, sy).setFlipX(flip).setAlpha(alpha);
    }
    if (flash) {
      this.suit.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.detail.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    } else {
      this.suit.setTint(this.color).setTintMode(Phaser.TintModes.MULTIPLY);
      this.detail.clearTint();
    }

    // Rim light: a slightly larger silhouette behind the suit, nudged toward the back. Under reduced
    // motion, invulnerability shows as a steady white outline instead of a blink.
    const outline = invuln && this.reducedMotion;
    this.rim
      .setPosition(x + (flip ? 1.5 : -1.5), this.pose.y + 1)
      .setScale(sx * (outline ? 1.1 : 1.05), sy * (outline ? 1.06 : 1.03))
      .setFlipX(flip)
      .setTint(outline ? 0xffffff : this.rimColor)
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(alpha * (outline ? 0.95 : 0.55));

    const flameOn = p.jetpacking && p.mode !== 'dead';
    this.flame.setVisible(flameOn);
    if (flameOn) {
      const flicker = this.reducedMotion ? 0.42 : 0.36 + 0.08 * Math.sin(timeMs * 0.06);
      this.flame.setPosition(x - p.facing * 22, this.pose.y - 30).setScale(flicker, flicker * 1.5);
    }
  }
}
