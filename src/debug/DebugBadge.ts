import Phaser from 'phaser';
import type { FrameTelemetry } from '../render/FrameTelemetry';

export class DebugBadge {
  private readonly label: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    private readonly telemetry: FrameTelemetry,
  ) {
    this.label = scene.add
      .text(16, 14, 'FPS —  ·  EMA — ms', {
        color: '#d9f6ff',
        backgroundColor: 'rgba(5, 11, 27, 0.8)',
        fontFamily: 'monospace',
        fontSize: '14px',
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(1000);
  }

  update(): void {
    const { frameDeltaMs } = this.telemetry.snapshot();
    const fps = frameDeltaMs.emaMs > 0 ? 1000 / frameDeltaMs.emaMs : 0;
    this.label.setText(`FPS ${fps.toFixed(0)}  ·  EMA ${frameDeltaMs.emaMs.toFixed(1)} ms`);
  }

  destroy(): void {
    this.label.destroy();
  }
}
