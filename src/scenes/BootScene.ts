import Phaser from 'phaser';
import { Random } from '../core/Random';
import { cameraZoomFor } from '../app/Viewport';

export const BOOT_READY_EVENT = 'cd-boot-ready';

const SKY = 0x0b1020;
const HORIZON = 0x1b2a55;
const GROUND = 0x14182c;
const PLANET = 0xf59e0b;
const STAR = 0xdbeafe;

/** Pass 0 placeholder: a fallback space background and a size readout. Real boot work starts in Pass 1A. */
export class BootScene extends Phaser.Scene {
  private label: Phaser.GameObjects.Text | undefined;

  constructor() {
    super('BootScene');
  }

  create(): void {
    const camera = this.cameras.main;
    camera.setBackgroundColor(SKY);

    const art = this.add.graphics();
    art.fillStyle(HORIZON, 1).fillRect(-4000, -200, 8000, 800);
    art.fillStyle(PLANET, 0.9).fillCircle(520, -160, 150);
    art.fillStyle(0x000000, 0.25).fillCircle(560, -190, 140);
    art.fillStyle(GROUND, 1).fillRect(-4000, 300, 8000, 600);

    // Render-side randomness only; this generator never touches the simulation.
    const rng = new Random(20260101);
    for (let i = 0; i < 160; i += 1) {
      const x = rng.nextFloat() * 4000 - 2000;
      const y = rng.nextFloat() * 620 - 540;
      const size = 1 + rng.nextInt(3);
      art.fillStyle(STAR, 0.4 + rng.nextFloat() * 0.6).fillRect(x, y, size, size);
    }

    this.add
      .text(0, -40, 'COSMIC DRIFT', { fontFamily: 'sans-serif', fontSize: '96px', color: '#e0f2fe' })
      .setOrigin(0.5);
    this.label = this.add
      .text(0, 80, '', { fontFamily: 'monospace', fontSize: '30px', color: '#8be9ff' })
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
    const camera = this.cameras.main;
    camera.setZoom(zoom);
    camera.centerOn(0, 0);
    this.label?.setText(
      `${String(width)}x${String(height)}  aspect ${(width / height).toFixed(2)}  zoom ${zoom.toFixed(3)}`,
    );
  }
}
