import Phaser from 'phaser';
import { BOOT_READY_EVENT, type GameServices } from '../app/GameServices';
import { cameraZoomFor } from '../app/Viewport';
import { Palette, PlanetRim } from '../theme/ThemePalette';

const TEXTURES = ['bg_starfield', 'fx_soft_dot'] as const;

/** Placeholder screen until the Title screen arrives in Pass 2A: star field, planet, and a size readout. */
export class HoldingScene extends Phaser.Scene {
  private readonly services: GameServices;
  private label: Phaser.GameObjects.Text | undefined;

  constructor(services: GameServices) {
    super('HoldingScene');
    this.services = services;
  }

  init(): void {
    // Scene boundary: the only place late-arriving textures replace their fallbacks (M3).
    this.services.assets.applyPendingSwaps();
  }

  create(): void {
    this.services.assets.ensure(TEXTURES);
    this.cameras.main.setBackgroundColor(Palette.deepCosmos);

    // Wide enough for 21:9 at 1080 world units tall.
    this.add.tileSprite(0, -200, 2800, 1600, 'bg_starfield').setOrigin(0.5);
    this.add.image(680, -240, 'fx_soft_dot').setScale(9).setTint(Palette.magmaAmber).setAlpha(0.35);

    const art = this.add.graphics();
    art.fillStyle(Palette.slateHull, 1).fillRect(-1600, 300, 3200, 600);
    art.fillStyle(PlanetRim.kepler, 0.9).fillRect(-1600, 296, 3200, 4);
    art.fillStyle(Palette.starlightGold, 0.95).fillCircle(680, -240, 150);
    art.fillStyle(Palette.deepCosmos, 0.28).fillCircle(726, -272, 138);

    this.add
      .text(0, -40, 'COSMIC DRIFT', { fontFamily: 'sans-serif', fontSize: '96px', color: '#E2E8F0' })
      .setOrigin(0.5);
    this.label = this.add
      .text(0, 80, '', { fontFamily: 'monospace', fontSize: '30px', color: '#00F5D4' })
      .setOrigin(0.5);

    const onResize = (): void => {
      this.layout();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
    this.layout();
    this.game.events.emit(BOOT_READY_EVENT);
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const zoom = cameraZoomFor(height);
    this.cameras.main.setZoom(zoom).centerOn(0, 0);
    this.label?.setText(
      `${String(width)}x${String(height)}  aspect ${(width / height).toFixed(2)}  zoom ${zoom.toFixed(3)}`,
    );
  }
}
