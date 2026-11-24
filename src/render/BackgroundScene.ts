import Phaser from 'phaser';
import { SeededRandom } from '../core/Random';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export class BackgroundScene extends Phaser.Scene {
  constructor() {
    super('BackgroundScene');
  }

  create(): void {
    const canvas = this.game.canvas;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Cosmic Drift title screen artwork');

    const art = this.add.graphics();
    art.fillStyle(0x080c18, 1);
    art.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    art.fillStyle(0x111b35, 0.48);
    art.fillCircle(1450, 345, 420);
    art.fillStyle(0x102c42, 0.32);
    art.fillCircle(1450, 345, 290);
    art.lineStyle(3, 0x50d9e8, 0.48);
    art.strokeCircle(1450, 345, 214);
    art.lineStyle(1, 0xa5f6ff, 0.2);
    art.strokeCircle(1450, 345, 244);

    const random = new SeededRandom(0xc05c1c);
    for (let index = 0; index < 180; index += 1) {
      const x = random.nextFloat() * CANVAS_WIDTH;
      const y = random.nextFloat() * CANVAS_HEIGHT;
      const radius = random.nextFloat() > 0.92 ? 2.2 : 1.1;
      const alpha = 0.25 + random.nextFloat() * 0.65;
      art.fillStyle(0xd6f5ff, alpha);
      art.fillCircle(x, y, radius);
    }

    this.add
      .text(190, 390, 'COSMIC DRIFT', {
        color: '#eaf6ff',
        fontFamily: 'Arial, sans-serif',
        fontSize: '78px',
        fontStyle: 'bold',
        letterSpacing: 5,
      })
      .setOrigin(0, 0.5);

    this.add
      .text(196, 472, 'NO ONE DRIFTS ALONE', {
        color: '#75dbe8',
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        letterSpacing: 7,
      })
      .setOrigin(0, 0.5);

    this.add
      .text(196, 716, 'A signal is still out there.', {
        color: '#a5b6ce',
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
      })
      .setOrigin(0, 0.5);

    art.lineStyle(2, 0x50d9e8, 0.7);
    art.lineBetween(196, 526, 390, 526);
  }
}
