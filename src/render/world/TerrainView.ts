import type Phaser from 'phaser';
import { GameConfig } from '../../core/GameConfig';
import { TileFlag, type Level } from '../../core/level/LevelTypes';
import { Palette, PlanetRim } from '../../theme/ThemePalette';
import { Depth } from './Depth';

const TILE = GameConfig.world.tileSizeU;
/** Depth of the recessed back face drawn above every exposed top (spec 9.3). */
const BACK_FACE_U = 14;
/** Side faces: width = clamp((edgeX - cameraCenterX) * 0.035, -24, 24) (spec 9.3). */
const SIDE_FACTOR = 0.035;
const SIDE_MAX_U = 24;

interface SideFace {
  readonly image: Phaser.GameObjects.Image;
  readonly edgeX: number;
  /** -1: the face on the slab's left edge (seen when the edge is right of the camera). */
  readonly side: -1 | 1;
}

function solidAt(level: Level, col: number, row: number): boolean {
  if (col < 0 || col >= level.widthTiles || row < 0 || row >= level.heightTiles) return false;
  return ((level.tiles[row * level.widthTiles + col] ?? 0) & TileFlag.Solid) !== 0;
}

function iceAt(level: Level, col: number, row: number): boolean {
  return ((level.tiles[row * level.widthTiles + col] ?? 0) & TileFlag.Ice) !== 0;
}

/**
 * Neo-Celestial slabs (spec 9.3): front faces with a lit top lip and the planet-tinted rim, a recessed
 * back face above every exposed top, and side faces whose drawn width follows the camera. Static
 * geometry is drawn once; per frame only the side faces' display widths change (no tessellation).
 * Hazards and one-way platforms are drawn here too, in the same layer.
 */
export class TerrainView {
  private readonly sides: SideFace[] = [];

  /** `danger` is the spike color (the colorblind palette's danger). */
  private readonly danger: number;

  constructor(scene: Phaser.Scene, level: Level, danger: number = Palette.neonCrimson) {
    this.danger = danger;
    const rim = PlanetRim[level.planet];
    const back = scene.add.container(0, 0).setDepth(Depth.TerrainBack);
    const front = scene.add.graphics().setDepth(Depth.TerrainFront);

    for (let row = 0; row < level.heightTiles; row += 1) {
      let col = 0;
      while (col < level.widthTiles) {
        if (!solidAt(level, col, row)) {
          col += 1;
          continue;
        }
        const start = col;
        while (col < level.widthTiles && solidAt(level, col, row)) col += 1;
        this.drawRun(scene, level, row, start, col - 1, front, back, rim);
      }
    }
    this.drawSpecialTiles(level, front, rim);
  }

  private drawRun(
    scene: Phaser.Scene,
    level: Level,
    row: number,
    c0: number,
    c1: number,
    front: Phaser.GameObjects.Graphics,
    back: Phaser.GameObjects.Container,
    rim: number,
  ): void {
    const y = row * TILE;
    // Front faces, merged into one rectangle per stretch of tiles that look the same (exposed top or
    // interior, ice or not): far fewer draw commands than one rectangle per tile.
    let s0 = c0;
    while (s0 <= c1) {
      const exposed = !solidAt(level, s0, row - 1);
      const ice = iceAt(level, s0, row);
      let s1 = s0;
      while (
        s1 + 1 <= c1 &&
        !solidAt(level, s1 + 1, row - 1) === exposed &&
        iceAt(level, s1 + 1, row) === ice
      )
        s1 += 1;
      const x = s0 * TILE;
      const w = (s1 - s0 + 1) * TILE;
      // Panel texture, one 64 u tile per repeat whatever the texture's density; ice is tinted.
      const face = scene.add
        .tileSprite(x, y, w, TILE, 'terrain_front')
        .setOrigin(0, 0)
        .setDepth(Depth.TerrainFront - 0.01);
      const texW = face.texture.getSourceImage().width;
      if (texW > 0) face.setTileScale(TILE / texW);
      if (ice) face.setTint(0x8ec5ff);
      else if (!exposed) face.setTint(0xaab4c4); // interior rows a little darker
      if (exposed) {
        front.fillStyle(ice ? 0x7dd3fc : Palette.coolSteel, 0.85).fillRect(x, y + 3, w, 3); // lit lip
        front.fillStyle(ice ? 0xbae6fd : rim, 0.95).fillRect(x, y, w, 3); // planet rim
      }
      s0 = s1 + 1;
    }
    // Recessed back faces above exposed tops, one stretch per exposed segment.
    let c = c0;
    while (c <= c1) {
      if (solidAt(level, c, row - 1)) {
        c += 1;
        continue;
      }
      const s = c;
      while (c <= c1 && !solidAt(level, c, row - 1)) c += 1;
      back.add(
        scene.add
          .tileSprite(s * TILE, y - BACK_FACE_U, (c - s) * TILE, BACK_FACE_U, 'terrain_top')
          .setOrigin(0, 0),
      );
    }
    // Side faces at exposed vertical edges.
    if (!solidAt(level, c0 - 1, row)) this.addSide(scene, back, c0 * TILE, y, -1);
    if (!solidAt(level, c1 + 1, row)) this.addSide(scene, back, (c1 + 1) * TILE, y, 1);
  }

  private addSide(
    scene: Phaser.Scene,
    back: Phaser.GameObjects.Container,
    edgeX: number,
    y: number,
    side: -1 | 1,
  ): void {
    const image = scene.add
      .image(edgeX, y - BACK_FACE_U, 'terrain_side')
      .setOrigin(side === -1 ? 1 : 0, 0)
      .setFlipX(side === -1);
    image.setDisplaySize(1, TILE + BACK_FACE_U);
    back.add(image);
    this.sides.push({ image, edgeX, side });
  }

  private drawSpecialTiles(level: Level, g: Phaser.GameObjects.Graphics, rim: number): void {
    for (let row = 0; row < level.heightTiles; row += 1) {
      for (let col = 0; col < level.widthTiles; col += 1) {
        const f = level.tiles[row * level.widthTiles + col] ?? 0;
        const x = col * TILE;
        const y = row * TILE;
        if ((f & TileFlag.OneWay) !== 0) {
          g.fillStyle(Palette.abyssalNavy, 0.9).fillRect(x, y + 10, TILE, 8);
          g.fillStyle(Palette.titaniumGunmetal, 1).fillRect(x, y, TILE, 12);
          g.fillStyle(Palette.coolSteel, 0.9).fillRect(x, y + 2, TILE, 2);
          g.fillStyle(rim, 0.8).fillRect(x, y, TILE, 2);
        } else if ((f & TileFlag.Spikes) !== 0) {
          g.fillStyle(Palette.slateHull, 1).fillRect(x, y + TILE - 10, TILE, 10);
          for (let i = 0; i < 4; i += 1) {
            const sx = x + i * 16;
            g.fillStyle(this.danger, 1).fillTriangle(sx, y + TILE - 8, sx + 8, y + 22, sx + 16, y + TILE - 8);
            g.fillStyle(0xffffff, 0.35).fillTriangle(
              sx + 4,
              y + TILE - 16,
              sx + 8,
              y + 26,
              sx + 9,
              y + TILE - 16,
            );
          }
        } else if ((f & TileFlag.Lava) !== 0) {
          const lavaAbove =
            row > 0 && ((level.tiles[(row - 1) * level.widthTiles + col] ?? 0) & TileFlag.Lava) !== 0;
          g.fillStyle(0x9a3412, 1).fillRect(x, y + (lavaAbove ? 0 : 14), TILE, TILE - (lavaAbove ? 0 : 14));
          if (!lavaAbove) {
            g.fillStyle(Palette.magmaAmber, 1).fillRect(x, y + 14, TILE, 10);
            g.fillStyle(Palette.starlightGold, 0.9).fillRect(x, y + 14, TILE, 3);
          }
        }
      }
    }
  }

  /** Per frame: side faces widen toward the side facing the camera center. */
  update(cameraCenterX: number): void {
    for (const face of this.sides) {
      const w = Math.max(-SIDE_MAX_U, Math.min(SIDE_MAX_U, (face.edgeX - cameraCenterX) * SIDE_FACTOR));
      // A left edge shows its face when it is right of the camera (w > 0), a right edge when left (w < 0).
      const visibleWidth = face.side === -1 ? w : -w;
      if (visibleWidth < 1) {
        face.image.setVisible(false);
      } else {
        face.image.setVisible(true);
        face.image.displayWidth = visibleWidth;
      }
    }
  }
}
