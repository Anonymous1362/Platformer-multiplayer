import type Phaser from 'phaser';
import { GameConfig, Ticks } from '../../core/GameConfig';
import { TileFlag, type Level } from '../../core/level/LevelTypes';
import type { PlayerState, WorldState } from '../../core/SimulationTypes';
import { Palette, PlanetRim } from '../../theme/ThemePalette';

const TILE = GameConfig.world.tileSizeU;
const COLLIDER = GameConfig.player.colliderU;
const CRAWLER = GameConfig.enemies.crawler.colliderU;
const PK = GameConfig.pickups;
const SLOT_COLORS = [
  Palette.electricCyan,
  Palette.starlightGold,
  Palette.nebulaViolet,
  Palette.magmaAmber,
] as const;
/** A body that moved farther than this in one tick teleported (respawn): draw it there, no smear. */
const SNAP_DISTANCE_U = 200;

/** A position for one rendered frame. */
export interface RenderPose {
  readonly x: number;
  readonly y: number;
}

/** Positions at the start of the latest tick, keyed by entity ID (platforms by index). */
export interface PrevPoses {
  readonly entities: ReadonlyMap<number, RenderPose>;
  readonly platforms: readonly RenderPose[];
}

export function capturePoses(world: WorldState): PrevPoses {
  const entities = new Map<number, RenderPose>();
  for (const list of [world.players, world.enemies, world.projectiles, world.pickups]) {
    for (const e of list) entities.set(e.id, { x: e.x, y: e.y });
  }
  return { entities, platforms: world.platforms.map((p) => ({ x: p.x, y: p.y })) };
}

function lerp(prev: RenderPose | undefined, next: RenderPose, alpha: number): RenderPose {
  if (!prev || Math.hypot(next.x - prev.x, next.y - prev.y) > SNAP_DISTANCE_U) return next;
  return { x: prev.x + (next.x - prev.x) * alpha, y: prev.y + (next.y - prev.y) * alpha };
}

function flags(level: Level, col: number, row: number): number {
  if (col < 0 || col >= level.widthTiles || row < 0 || row >= level.heightTiles) return TileFlag.Solid;
  return level.tiles[row * level.widthTiles + col] ?? 0;
}

/**
 * Draws a level and its bodies with plain shapes: the stand-in that keeps the game playable until the
 * Neo-Celestial art pass (Pass 1E-2) replaces it. Static tiles are drawn once; moving things are
 * redrawn each frame from interpolated positions (render alpha never touches the simulation).
 */
export class LevelView {
  private readonly level: Level;
  private readonly platforms: Phaser.GameObjects.Graphics[] = [];
  private readonly players: Phaser.GameObjects.Graphics[] = [];
  private readonly dynamic: Phaser.GameObjects.Graphics;
  private readonly markers: Phaser.GameObjects.Graphics;
  private markerKey = '';

  constructor(scene: Phaser.Scene, level: Level, world: WorldState) {
    this.level = level;
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

    this.markers = scene.add.graphics();

    level.platforms.forEach((def) => {
      const p = scene.add.graphics();
      p.fillStyle(Palette.titaniumGunmetal, 1).fillRoundedRect(0, 0, def.w, def.h, Math.min(10, def.h / 2));
      p.fillStyle(def.oneWay ? rim : Palette.coolSteel, 0.9).fillRect(4, 0, def.w - 8, 4);
      this.platforms.push(p);
    });

    this.dynamic = scene.add.graphics();

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

  private drawMarkers(world: WorldState): void {
    const key = world.run.checkpointsReached.join('') + String(world.run.completeTick >= 0);
    if (key === this.markerKey) return;
    this.markerKey = key;
    const g = this.markers.clear();
    const flagH = PK.checkpointU.height;
    this.level.checkpoints.forEach((cp, i) => {
      const reached = world.run.checkpointsReached[i] === 1;
      g.fillStyle(Palette.titaniumGunmetal, 1).fillRect(cp.x - 4, cp.y - flagH, 8, flagH);
      g.fillStyle(reached ? Palette.electricCyan : Palette.coolSteel, 1);
      g.fillTriangle(cp.x + 4, cp.y - flagH, cp.x + 44, cp.y - flagH + 16, cp.x + 4, cp.y - flagH + 32);
    });
    for (const exit of this.level.exits) {
      const w = PK.exitU.width;
      const h = PK.exitU.height;
      g.fillStyle(Palette.nebulaViolet, 0.25).fillRoundedRect(exit.x - w / 2, exit.y - h, w, h, 24);
      g.lineStyle(6, world.run.completeTick >= 0 ? Palette.starlightGold : Palette.nebulaViolet, 1);
      g.strokeRoundedRect(exit.x - w / 2, exit.y - h, w, h, 24);
    }
  }

  /** Draws one frame; returns the first player's pose for the camera. */
  update(world: WorldState, prev: PrevPoses, alpha: number): RenderPose | null {
    this.drawMarkers(world);
    world.platforms.forEach((p, i) => {
      const pose = lerp(prev.platforms[i], p, alpha);
      this.platforms[i]?.setPosition(pose.x, pose.y);
    });

    const g = this.dynamic.clear();
    for (const shard of world.pickups) {
      const pose = lerp(prev.entities.get(shard.id), shard, alpha);
      const r = PK.shardSizeU / 2 + 3;
      g.fillStyle(Palette.starlightGold, 1);
      g.fillTriangle(pose.x, pose.y - r, pose.x + r, pose.y, pose.x, pose.y + r);
      g.fillTriangle(pose.x, pose.y - r, pose.x - r, pose.y, pose.x, pose.y + r);
    }
    for (const e of world.enemies) {
      const pose = lerp(prev.entities.get(e.id), e, alpha);
      const w = CRAWLER.width;
      const h = CRAWLER.height * (e.mode === 'windup' ? 0.8 : 1);
      g.fillStyle(Palette.abyssalNavy, 0.9).fillRoundedRect(
        pose.x - w / 2 - 3,
        pose.y - h - 3,
        w + 6,
        h + 6,
        14,
      );
      g.fillStyle(e.mode === 'attack' ? Palette.neonCrimson : Palette.nebulaViolet, 1);
      g.fillRoundedRect(pose.x - w / 2, pose.y - h, w, h, 12);
      const eye = e.mode === 'windup' || e.mode === 'attack' ? Palette.magmaAmber : Palette.electricCyan;
      g.fillStyle(eye, 1).fillCircle(pose.x + e.facing * (w / 2 - 12), pose.y - h + 14, 6);
      if (e.mode === 'alert') {
        g.fillStyle(Palette.starlightGold, 1).fillRect(pose.x - 4, pose.y - h - 46, 8, 22);
        g.fillRect(pose.x - 4, pose.y - h - 18, 8, 8);
      }
    }
    for (const b of world.projectiles) {
      const pose = lerp(prev.entities.get(b.id), b, alpha);
      const speed = Math.hypot(b.vx, b.vy) || 1;
      const tx = (b.vx / speed) * 18;
      const ty = (b.vy / speed) * 18;
      g.lineStyle(8, Palette.electricCyan, 1).lineBetween(pose.x - tx, pose.y - ty, pose.x, pose.y);
    }

    let focus: RenderPose | null = null;
    this.players.forEach((body, i) => {
      const player = world.players[i];
      if (!player) return;
      const pose = lerp(prev.entities.get(player.id), player, alpha);
      if (i === 0) focus = pose;
      body.setPosition(pose.x, pose.y);
      body.setScale(player.facing, 1);
      body.setAlpha(playerAlpha(player));
    });
    return focus;
  }
}

/** Fade for hazard respawn and death; a steady blink while invulnerable (reduced-motion variant: 1E-2). */
function playerAlpha(p: PlayerState): number {
  if (p.mode === 'dead') return 0.25;
  if (p.mode === 'hazardRespawn') {
    const half = Ticks.hazardRespawn / 2;
    return Math.min(1, Math.abs(p.modeTicks - half) / half);
  }
  if (p.invulnTicks > 0) return Math.floor(p.invulnTicks / 4) % 2 === 0 ? 0.45 : 1;
  return 1;
}
