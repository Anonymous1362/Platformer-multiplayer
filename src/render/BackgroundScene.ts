import Phaser from 'phaser';
import { FrameTelemetry } from './FrameTelemetry';

interface DebugBadgeController {
  update(): void;
  destroy(): void;
}

export class BackgroundScene extends Phaser.Scene {
  private readonly telemetry = new FrameTelemetry();
  private background: Phaser.GameObjects.Image | undefined;
  private title: Phaser.GameObjects.Text | undefined;
  private tagline: Phaser.GameObjects.Text | undefined;
  private signal: Phaser.GameObjects.Text | undefined;
  private debugBadge: DebugBadgeController | undefined;
  private renderStartedAt: number | undefined;
  private isShuttingDown = false;

  private readonly measureRenderStart = (): void => {
    this.renderStartedAt = performance.now();
  };

  private readonly measureRenderEnd = (): void => {
    if (this.renderStartedAt === undefined) {
      return;
    }
    this.telemetry.record('render', performance.now() - this.renderStartedAt);
    this.renderStartedAt = undefined;
  };

  constructor() {
    super('BackgroundScene');
  }

  create(): void {
    const textureKey = this.registry.get('titleBackgroundTexture');
    if (typeof textureKey !== 'string' || !this.textures.exists(textureKey)) {
      throw new Error('The boot scene did not provide a valid background texture.');
    }

    this.game.canvas.setAttribute('role', 'img');
    this.game.canvas.setAttribute('aria-label', 'Cosmic Drift title screen artwork');

    this.background = this.add.image(0, 0, textureKey).setOrigin(0);
    this.title = this.add
      .text(0, 0, 'COSMIC DRIFT', {
        color: '#EAF6FF',
        fontFamily: 'Arial, sans-serif',
        fontSize: '78px',
        fontStyle: 'bold',
        letterSpacing: 5,
      })
      .setOrigin(0, 0.5);
    this.tagline = this.add
      .text(0, 0, 'NO ONE DRIFTS ALONE', {
        color: '#00F5D4',
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        letterSpacing: 7,
      })
      .setOrigin(0, 0.5);
    this.signal = this.add
      .text(0, 0, 'A signal is still out there.', {
        color: '#A5B6CE',
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
      })
      .setOrigin(0, 0.5);

    this.resizeContent();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeContent, this);
    this.game.events.on(Phaser.Core.Events.PRE_RENDER, this.measureRenderStart);
    this.game.events.on(Phaser.Core.Events.POST_RENDER, this.measureRenderEnd);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    if (import.meta.env.DEV) {
      void import('../debug/DebugBadge').then(({ DebugBadge }) => {
        if (!this.isShuttingDown) {
          this.debugBadge = new DebugBadge(this, this.telemetry);
        }
      });
    }
  }

  override update(_time: number, delta: number): void {
    const updateStartedAt = performance.now();
    this.telemetry.recordFrameDelta(delta);
    this.telemetry.record('update', performance.now() - updateStartedAt);
    this.debugBadge?.update();
  }

  private resizeContent(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.background?.setPosition(0, 0).setDisplaySize(width, height);
    this.title?.setPosition(width * 0.12, height * 0.39);
    this.tagline?.setPosition(width * 0.125, height * 0.47);
    this.signal?.setPosition(width * 0.125, height * 0.68);
  }

  private shutdown(): void {
    this.isShuttingDown = true;
    this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeContent, this);
    this.game.events.off(Phaser.Core.Events.PRE_RENDER, this.measureRenderStart);
    this.game.events.off(Phaser.Core.Events.POST_RENDER, this.measureRenderEnd);
    this.debugBadge?.destroy();
    this.debugBadge = undefined;
  }
}
