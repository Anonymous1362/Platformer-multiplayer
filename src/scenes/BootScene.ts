import Phaser from 'phaser';
import { SeededRandom } from '../core/Random';
import { AssetRegistry, type AssetManifestEntry } from '../assets/AssetRegistry';
import { minimalBootManifest } from '../assets/minimalManifest';
import { ThemePalette } from '../theme/ThemePalette';

const BACKGROUND_WIDTH = 1920;
const BACKGROUND_HEIGHT = 1080;

function colorNumber(hexColor: string): number {
  return Number.parseInt(hexColor.slice(1), 16);
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    const registry = new AssetRegistry<string>(
      minimalBootManifest,
      (entry) => this.loadImage(entry),
      (entry) => this.createProceduralFallback(entry),
      { onWarning: (message) => console.warn(message) },
    );
    this.registry.set('assetRegistry', registry);

    void registry
      .loadScope('boot')
      .then((assets) => {
        const background = assets.get('title_background');
        if (background?.value === undefined) {
          throw new Error('The title background could not be prepared.');
        }

        registry.commitSceneBoundary();
        this.registry.set('titleBackgroundTexture', background.value);
        this.registry.set('assetStatuses', [...registry.getStatuses()]);
        this.scene.start('BackgroundScene');
      })
      .catch(() => this.showBootError());
  }

  private loadImage(entry: AssetManifestEntry): Promise<string> {
    const file = entry.files[0];
    if (entry.kind !== 'image' || file === undefined) {
      return Promise.reject(new Error(`Boot asset ${entry.key} is not a loadable image.`));
    }

    const textureKey = `asset_${entry.key}`;
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        image.onload = null;
        image.onerror = null;
        try {
          if (!this.textures.exists(textureKey)) {
            this.textures.addImage(textureKey, image);
          }
          resolve(textureKey);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Image texture registration failed.'));
        }
      };
      image.onerror = () => {
        image.onload = null;
        image.onerror = null;
        reject(new Error(`Boot asset ${entry.key} could not be decoded.`));
      };
      image.src = new URL(`/${file.path}`, window.location.href).toString();
    });
  }

  private createProceduralFallback(entry: AssetManifestEntry): string {
    const textureKey = `procedural_${entry.key}`;
    if (this.textures.exists(textureKey)) {
      return textureKey;
    }

    const art = this.make.graphics({ x: 0, y: 0 });
    art.fillStyle(colorNumber(ThemePalette.background.deepSpace), 1);
    art.fillRect(0, 0, BACKGROUND_WIDTH, BACKGROUND_HEIGHT);
    art.fillStyle(colorNumber(ThemePalette.background.abyssalNavy), 0.76);
    art.fillCircle(1460, 350, 440);
    art.fillStyle(colorNumber(ThemePalette.planets.kepler), 0.1);
    art.fillCircle(1460, 350, 315);
    art.lineStyle(3, colorNumber(ThemePalette.friendly.energy), 0.42);
    art.strokeCircle(1460, 350, 220);
    art.lineStyle(1, colorNumber(ThemePalette.text.primary), 0.22);
    art.strokeCircle(1460, 350, 252);

    const random = new SeededRandom(0xc05c1c);
    for (let index = 0; index < 180; index += 1) {
      const x = random.nextFloat() * BACKGROUND_WIDTH;
      const y = random.nextFloat() * BACKGROUND_HEIGHT;
      const radius = random.nextFloat() > 0.92 ? 2.2 : 1.1;
      const alpha = 0.25 + random.nextFloat() * 0.65;
      art.fillStyle(colorNumber(ThemePalette.text.primary), alpha);
      art.fillCircle(x, y, radius);
    }

    art.generateTexture(textureKey, BACKGROUND_WIDTH, BACKGROUND_HEIGHT);
    art.destroy();
    return textureKey;
  }

  private showBootError(): void {
    this.add
      .text(
        BACKGROUND_WIDTH / 2,
        BACKGROUND_HEIGHT / 2,
        'Cosmic Drift could not start.\nPlease refresh to try again.',
        {
          align: 'center',
          color: ThemePalette.text.primary,
          fontFamily: 'Arial, sans-serif',
          fontSize: '28px',
          lineSpacing: 12,
        },
      )
      .setOrigin(0.5);
  }
}
