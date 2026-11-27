import Phaser from 'phaser';
import { Random } from '../../core/Random';
import type { QualityTier } from '../fx/FxMath';
import { Depth } from './Depth';

/**
 * Five parallax layers (spec 9.3), depth factors 0.05 (nebula), 0.12 (stars, additive), 0.25 (dust),
 * 0.45 (megastructure silhouettes), 1.15 (foreground motes). Layers 1–4 are screen-fixed tile sprites
 * whose offsets follow the camera; layer 5 is a few loose sprites instead of a full-screen layer, so it
 * costs almost no fill rate. The Battery tier keeps layers 1, 4, and 5. Visual only; nothing is
 * allocated per frame.
 */

interface Layer {
  readonly sprite: Phaser.GameObjects.TileSprite;
  readonly factor: number;
  /** Silhouettes hug the bottom of the level instead of tiling vertically. */
  readonly bottomAnchored: boolean;
}

interface Mote {
  readonly image: Phaser.GameObjects.Image;
  readonly x: number;
  readonly y: number;
}

interface LayerDef {
  readonly key: string;
  readonly factor: number;
  readonly depth: number;
  readonly alpha: number;
  readonly additive: boolean;
  readonly bottom: boolean;
  /** Kept on the Battery tier. */
  readonly battery: boolean;
}

const LAYERS: readonly LayerDef[] = [
  {
    key: 'bg_nebula',
    factor: 0.05,
    depth: Depth.Sky,
    alpha: 1,
    additive: false,
    bottom: false,
    battery: true,
  },
  {
    key: 'bg_starfield',
    factor: 0.12,
    depth: Depth.Stars,
    alpha: 0.9,
    additive: true,
    bottom: false,
    battery: false,
  },
  {
    key: 'bg_dust',
    factor: 0.25,
    depth: Depth.Dust,
    alpha: 1,
    additive: true,
    bottom: false,
    battery: false,
  },
  {
    key: 'bg_megastructure',
    factor: 0.45,
    depth: Depth.Megastructure,
    alpha: 1,
    additive: false,
    bottom: true,
    battery: true,
  },
];
const MOTE_FACTOR = 1.15;
const MOTE_COUNT = 10;
/** Motes wrap inside a field this large (u), centered on the view. */
const MOTE_FIELD_U = { width: 2400, height: 1400 } as const;
/** Layers overscan the view so a shake rotation never shows a bare corner. */
const OVERSCAN = 1.04;

export class ParallaxView {
  private readonly layers: Layer[];
  private readonly motes: Mote[] = [];
  private readonly levelHeightU: number;
  private lastW = -1;
  private lastH = -1;

  /**
   * `layers` overrides the tier (Settings: Parallax layers 3 or 5; 3 keeps the Battery set) and
   * `intensity` (Settings: Background effects intensity, 0–1) scales every layer's opacity.
   */
  constructor(
    scene: Phaser.Scene,
    levelHeightU: number,
    tier: QualityTier,
    options: { readonly layers?: 3 | 5 | null; readonly intensity?: number } = {},
  ) {
    this.levelHeightU = levelHeightU;
    const few = options.layers === 3 || (options.layers == null && tier === 'battery');
    const intensity = Math.min(1, Math.max(0, options.intensity ?? 1));
    this.layers = LAYERS.filter((l) => !few || l.battery).map((l) => {
      const sprite = scene.add
        .tileSprite(0, 0, 16, 16, l.key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(l.depth)
        .setAlpha(l.alpha * (l.key === 'bg_nebula' ? Math.max(0.35, intensity) : intensity));
      if (l.additive) sprite.setBlendMode(Phaser.BlendModes.ADD);
      return { sprite, factor: l.factor, bottomAnchored: l.bottom };
    });
    const rng = new Random(0x0dd5);
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      const scale = 0.12 + rng.nextFloat() * 0.22;
      const image = scene.add
        .image(0, 0, 'fx_glow')
        .setScrollFactor(0)
        .setDepth(Depth.Foreground)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(rng.nextFloat() < 0.7 ? 0xffffff : 0x00f5d4)
        .setAlpha((0.12 + rng.nextFloat() * 0.12) * intensity)
        .setScale(scale);
      this.motes.push({
        image,
        x: rng.nextFloat() * MOTE_FIELD_U.width,
        y: rng.nextFloat() * MOTE_FIELD_U.height,
      });
    }
  }

  /** Per frame: cover the screen under the current zoom and offset each layer by its depth factor. */
  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    const zoom = camera.zoom;
    const w = (camera.width / zoom) * OVERSCAN;
    const h = (camera.height / zoom) * OVERSCAN;
    // Zoom scales around the camera center, so a screen-fixed sprite covering the view starts here.
    const x0 = (camera.width - w) / 2;
    const y0 = (camera.height - h) / 2;
    const maxScrollY = Math.max(0, this.levelHeightU - camera.height / zoom);
    const resized = w !== this.lastW || h !== this.lastH;
    this.lastW = w;
    this.lastH = h;
    for (const layer of this.layers) {
      const s = layer.sprite;
      s.tilePositionX = camera.scrollX * layer.factor;
      if (layer.bottomAnchored) {
        const texH = s.texture.getSourceImage().height;
        const sink = (maxScrollY - camera.scrollY) * layer.factor;
        s.setPosition(x0, y0 + h - texH + sink);
        if (resized) s.setSize(w, texH);
      } else {
        s.tilePositionY = camera.scrollY * layer.factor;
        if (resized) {
          s.setPosition(x0, y0);
          s.setSize(w, h);
        }
      }
    }
    const fw = MOTE_FIELD_U.width;
    const fh = MOTE_FIELD_U.height;
    for (const m of this.motes) {
      const mx = (((m.x - camera.scrollX * MOTE_FACTOR) % fw) + fw) % fw;
      const my = (((m.y - camera.scrollY * MOTE_FACTOR) % fh) + fh) % fh;
      m.image.setPosition(x0 + mx - (fw - w) / 2, y0 + my - (fh - h) / 2);
    }
  }
}
