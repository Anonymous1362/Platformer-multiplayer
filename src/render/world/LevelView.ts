import type Phaser from 'phaser';
import { GameConfig, Ticks } from '../../core/GameConfig';
import { TileFlag, type Level } from '../../core/level/LevelTypes';
import type { PlayerState, WorldState } from '../../core/SimulationTypes';
import { Palette, PlanetRim } from '../../theme/ThemePalette';

const TILE = GameConfig.world.tileSizeU;
const COLLIDER = GameConfig.player.colliderU;
const SLOT_COLORS = [
  Palette.electricCyan,
  Palette.starlightGold,
  Palette.nebulaViolet,
  Palette.magmaAmber,
] as const;

/** Interpolated render position of one body (render alpha never touches the simulation). */
export interface RenderPose {
  readonly x: number;
  readonly y: number;
}

function flags(level: Level, col: number, row: number): number {
  if (col < 0 || col >= level.widthTiles || row < 0 || row >= level.heightTiles) return TileFlag.Solid;
  return level.tiles[row * level.widthTiles + col] ?? 0;
}

/**
 * Draws a level and its bodies with plain shapes: the Pass 1D stand-in that makes the test arena
 * playable. The Neo-Celestial art pass (slabs, parallax, contact shadows) replaces it in Pass 1E.
 * Static tiles are drawn once; platforms and players are pre-drawn and only moved each frame.
 */
export class LevelView {
  private readonly platforms: Phaser.GameObjects.Graphics[] = [];
  private readonly players: Phaser.GameObjects.Graphics[] = [];

  constructor(scene: Phaser.Scene, level: Level, world: WorldState) {
    const rim = PlanetRim[level.planet];
    const g = scene.add.graphics();
    for (let row = 0; row < level.heightTiles; row += 1) {
      for (let col = 0; col < level.widthTiles; col += 1) {
        const f = flags(level, col, row);
        const x = col * TILE;
        const y = row * TILE;
        if ((f & TileFlag.Solid) !== 0) {
          const ice = (f & TileFlag.Ice) !== 0;
          g.fillStyle(ice ? 0x1e3a5f : Palette.slateHull, 1).fillRect(x, y, TILE, TILE);
          if ((flags(level, col, row - 1) & TileFlag.Solid) === 0) {
            g.fillStyle(ice ? 0x7dd3fc : rim, 0.9).fillRect(x, y, TILE, 5);
          }
        } else if ((f & TileFlag.OneWay) !== 0) {
          g.fillStyle(Palette.titaniumGunmetal, 1).fillRect(x, y, TILE, 14);
          g.fillStyle(rim, 0.75).fillRect(x, y, TILE, 3);
        } else if ((f & TileFlag.Spikes) !== 0) {
          g.fillStyle(Palette.neonCrimson, 0.95);
          for (let i = 0; i < 4; i += 1)
            g.fillTriangle(x + i * 16, y + TILE, x + i * 16 + 8, y + 26, x + i * 16 + 16, y + TILE);
        } else if ((f & TileFlag.Lava) !== 0) {
          g.fillStyle(Palette.magmaAmber, 0.92).fillRect(x, y + 12, TILE, TILE - 12);
          g.fillStyle(Palette.starlightGold, 0.8).fillRect(x, y + 12, TILE, 4);
        }
      }
    }

    level.platforms.forEach((def) => {
      const p = scene.add.graphics();
      p.fillStyle(Palette.titaniumGunmetal, 1).fillRoundedRect(0, 0, def.w, def.h, Math.min(10, def.h / 2));
      p.fillStyle(def.oneWay ? rim : Palette.coolSteel, 0.9).fillRect(4, 0, def.w - 8, 4);
      this.platforms.push(p);
    });

    world.players.forEach((player) => {
      const body = scene.add.graphics();
      const color = SLOT_COLORS[player.slot % SLOT_COLORS.length] ?? Palette.electricCyan;
      const w = COLLIDER.width;
      const h = COLLIDER.height;
      body.fillStyle(Palette.abyssalNavy, 0.85).fillRoundedRect(-w / 2 - 3, -h - 3, w + 6, h + 6, 14);
      body.fillStyle(color, 1).fillRoundedRect(-w / 2, -h, w, h, 12);
      body.fillStyle(Palette.deepCosmos, 0.9).fillRoundedRect(-2, -h + 14, w / 2, 16, 6); // visor, faces +x
      body.fillStyle(Palette.starlightGold, 0.9).fillRect(-w / 2 - 6, -h + 34, 8, 26); // jetpack
      this.players.push(body);
    });
  }

  /** `platformPoses` and `playerPoses` are interpolated positions for this rendered frame. */
  update(world: WorldState, platformPoses: readonly RenderPose[], playerPoses: readonly RenderPose[]): void {
    this.platforms.forEach((g, i) => {
      const pose = platformPoses[i];
      if (pose) g.setPosition(pose.x, pose.y);
    });
    this.players.forEach((g, i) => {
      const player = world.players[i];
      const pose = playerPoses[i];
      if (!player || !pose) return;
      g.setPosition(pose.x, pose.y);
      g.setScale(player.facing, 1);
      g.setAlpha(playerAlpha(player));
    });
  }
}

/** Fade for hazard respawn and death; a steady blink while invulnerable (reduced-motion variant: Pass 1E). */
function playerAlpha(p: PlayerState): number {
  if (p.mode === 'dead') return 0.25;
  if (p.mode === 'hazardRespawn') {
    const half = Ticks.hazardRespawn / 2;
    return Math.min(1, Math.abs(p.modeTicks - half) / half);
  }
  if (p.invulnTicks > 0) return Math.floor(p.invulnTicks / 4) % 2 === 0 ? 0.45 : 1;
  return 1;
}
