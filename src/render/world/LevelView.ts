import Phaser from 'phaser';
import { GameConfig } from '../../core/GameConfig';
import { groundDistance } from '../../core/Ground';
import type { Level } from '../../core/level/LevelTypes';
import type { WorldState } from '../../core/SimulationTypes';
import { Palette, PlanetRim } from '../../theme/ThemePalette';
import type { EntityFx, SpriteSnapshot } from '../fx/EntityFx';
import { Depth } from './Depth';
import { PlayerSprite } from './PlayerSprite';
import { lerpPose, type PrevPoses, type RenderPose } from './Poses';
import { SpritePool } from './SpritePool';
import { TerrainView } from './TerrainView';

const PK = GameConfig.pickups;
const PLAYER = GameConfig.player.colliderU;
const CRAWLER = GameConfig.enemies.crawler.colliderU;
/** Contact shadows fade out by this height above the ground (spec 9.3). */
const SHADOW_RANGE_U = 320;
const SHARD_FRAMES = 24;

/**
 * Draws a level and its bodies in the Neo-Celestial style (spec 9). Static geometry is built once;
 * entities use pooled sprites keyed by entity ID; positions are interpolated with the render alpha,
 * which never touches the simulation (spec 13.7).
 */
export class LevelView {
  private readonly level: Level;
  private readonly terrain: TerrainView;
  private readonly markers: Phaser.GameObjects.Graphics;
  private readonly platforms: Phaser.GameObjects.Graphics[] = [];
  private readonly shadows: SpritePool;
  private readonly shards: SpritePool;
  private readonly enemies: SpritePool;
  private readonly bolts: SpritePool;
  private readonly alerts: Phaser.GameObjects.Graphics;
  private readonly players: PlayerSprite[] = [];
  private readonly reducedMotion: boolean;
  private markerKey = '';
  private shadowId = 0;

  constructor(scene: Phaser.Scene, level: Level, world: WorldState, reducedMotion: boolean) {
    this.level = level;
    this.reducedMotion = reducedMotion;
    const rim = PlanetRim[level.planet];
    this.terrain = new TerrainView(scene, level);
    this.markers = scene.add.graphics().setDepth(Depth.Markers);

    level.platforms.forEach((def) => {
      const g = scene.add.graphics().setDepth(Depth.TerrainFront);
      const r = Math.min(10, def.h / 2);
      g.fillStyle(Palette.abyssalNavy, 0.9).fillRoundedRect(4, -10, def.w - 8, def.h, r); // back face
      g.fillStyle(Palette.titaniumGunmetal, 1).fillRoundedRect(0, 0, def.w, def.h, r);
      g.fillStyle(Palette.coolSteel, 0.9).fillRect(6, 3, def.w - 12, 3); // lit lip
      g.fillStyle(def.oneWay ? rim : Palette.coolSteel, 0.95).fillRect(6, 0, def.w - 12, 3);
      g.fillStyle(Palette.starlightGold, 0.8).fillCircle(def.w / 2, def.h / 2 + 2, 3); // drive light
      this.platforms.push(g);
    });

    this.shadows = new SpritePool(scene, 'fx_shadow', 40, (img) => img.setDepth(Depth.Shadows));
    this.shards = new SpritePool(scene, 'pickup_shard', 24, (img) => img.setDepth(Depth.Pickups));
    this.enemies = new SpritePool(scene, 'enemy_crawler', 4, (img) =>
      img.setOrigin(0.5, 1).setDepth(Depth.Enemies),
    );
    this.bolts = new SpritePool(scene, 'fx_bolt', 16, (img) =>
      img.setOrigin(1, 0.5).setDepth(Depth.Projectiles).setBlendMode(Phaser.BlendModes.ADD),
    );
    this.alerts = scene.add.graphics().setDepth(Depth.Fx);
    for (const p of world.players) this.players.push(new PlayerSprite(scene, p.slot, rim, reducedMotion));
  }

  /** Slab side faces follow the camera (spec 9.3). */
  updateTerrain(cameraCenterX: number): void {
    this.terrain.update(cameraCenterX);
  }

  /** What is drawn for enemy `id` right now (for the defeat dissolve). */
  snapshot(id: number): SpriteSnapshot | null {
    const img = this.enemies.peek(id);
    if (!img?.visible) return null;
    return { texture: 'enemy_crawler', x: img.x, y: img.y, flipX: img.flipX };
  }

  get liveSprites(): number {
    return this.shadows.live + this.shards.live + this.enemies.live + this.bolts.live + this.players.length;
  }

  private drawMarkers(world: WorldState): void {
    const key = world.run.checkpointsReached.join('') + String(world.run.completeTick >= 0);
    if (key === this.markerKey) return;
    this.markerKey = key;
    const g = this.markers.clear();
    const flagH = PK.checkpointU.height;
    this.level.checkpoints.forEach((cp, i) => {
      const on = world.run.checkpointsReached[i] === 1;
      const lamp = on ? Palette.electricCyan : Palette.coolSteel;
      g.fillStyle(Palette.slateHull, 1).fillRoundedRect(cp.x - 18, cp.y - 10, 36, 10, 4); // base
      g.fillStyle(Palette.titaniumGunmetal, 1).fillRoundedRect(cp.x - 6, cp.y - flagH, 12, flagH - 8, 5);
      g.fillStyle(Palette.coolSteel, 0.8).fillRect(cp.x - 6, cp.y - flagH + 6, 3, flagH - 20); // lit edge
      g.fillStyle(lamp, on ? 0.35 : 0.15).fillCircle(cp.x, cp.y - flagH + 6, 20);
      g.fillStyle(lamp, 1).fillCircle(cp.x, cp.y - flagH + 6, 9);
    });
    const done = world.run.completeTick >= 0;
    for (const exit of this.level.exits) {
      const w = PK.exitU.width;
      const h = PK.exitU.height;
      g.fillStyle(Palette.nebulaViolet, done ? 0.35 : 0.18).fillRoundedRect(
        exit.x - w / 2,
        exit.y - h,
        w,
        h,
        w / 2,
      );
      g.lineStyle(10, Palette.abyssalNavy, 0.9).strokeRoundedRect(exit.x - w / 2, exit.y - h, w, h, w / 2);
      g.lineStyle(5, done ? Palette.starlightGold : Palette.nebulaViolet, 1);
      g.strokeRoundedRect(exit.x - w / 2, exit.y - h, w, h, w / 2);
    }
  }

  private shadow(x: number, bottomY: number, halfWidth: number, size: number, world: WorldState): void {
    const d = groundDistance(this.level, world.platforms, x, bottomY, halfWidth, SHADOW_RANGE_U);
    if (d === null) return;
    const k = 1 - d / SHADOW_RANGE_U;
    this.shadowId += 1;
    const { image } = this.shadows.acquire(this.shadowId);
    image
      .setPosition(x, bottomY + d - 2)
      .setScale(size * (0.55 + 0.45 * k), size * (0.55 + 0.45 * k))
      .setAlpha(0.75 * k);
  }

  /** Draws one frame; returns the first player's pose for the camera. */
  update(world: WorldState, prev: PrevPoses, alpha: number, fx: EntityFx, timeMs: number): RenderPose | null {
    this.drawMarkers(world);
    world.platforms.forEach((p, i) => {
      const pose = lerpPose(prev.platforms[i], p, alpha);
      this.platforms[i]?.setPosition(pose.x, pose.y);
    });

    this.shadowId = 0;
    this.shadows.begin();

    this.shards.begin();
    const spin = this.reducedMotion ? 12 : 24; // frames per second
    for (const s of world.pickups) {
      const pose = lerpPose(prev.entities.get(s.id), s, alpha);
      const { image } = this.shards.acquire(s.id);
      const frame = String(Math.floor((timeMs / 1000) * spin + s.id * 7) % SHARD_FRAMES);
      if (image.texture.has(frame)) image.setFrame(frame);
      const bob = s.floating && !this.reducedMotion ? Math.sin(timeMs / 320 + s.id) * 3 : 0;
      image.setPosition(pose.x, pose.y + bob);
      this.shadow(pose.x, pose.y + PK.shardSizeU / 2, 6, 0.35, world);
    }
    this.shards.end();

    this.enemies.begin();
    const g = this.alerts.clear();
    for (const e of world.enemies) {
      const { image, fresh } = this.enemies.acquire(e.id);
      if (fresh || !fx.frozen(e.id)) {
        const pose = lerpPose(prev.entities.get(e.id), e, alpha);
        image.setPosition(pose.x, pose.y);
      }
      const windup = e.mode === 'windup';
      image.setFlipX(e.facing < 0).setScale(windup ? 1.06 : 1, windup ? 0.85 : 1);
      if (fx.flashing(e.id)) {
        image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      } else if (windup || e.mode === 'attack') {
        // Readable wind-up (spec O7): an amber glow that pulses (steady under reduced motion).
        const pulse = this.reducedMotion || e.mode === 'attack' ? 1 : 0.55 + 0.45 * Math.sin(timeMs / 45);
        const base = e.mode === 'attack' ? 0x90103c : 0x904010;
        const r = Math.round(((base >> 16) & 0xff) * pulse);
        const gg = Math.round(((base >> 8) & 0xff) * pulse);
        const b = Math.round((base & 0xff) * pulse);
        image.setTint((r << 16) | (gg << 8) | b).setTintMode(Phaser.TintModes.ADD);
      } else {
        image.clearTint();
      }
      if (e.mode === 'alert') {
        g.fillStyle(Palette.starlightGold, 1).fillRoundedRect(
          image.x - 4,
          image.y - CRAWLER.height - 52,
          8,
          24,
          3,
        );
        g.fillCircle(image.x, image.y - CRAWLER.height - 20, 5);
      }
      if (!e.asleep) this.shadow(image.x, image.y, CRAWLER.width / 2 - 8, 1, world);
    }
    this.enemies.end();

    this.bolts.begin();
    for (const b of world.projectiles) {
      const pose = lerpPose(prev.entities.get(b.id), b, alpha);
      const { image } = this.bolts.acquire(b.id);
      image.setPosition(pose.x, pose.y).setRotation(Math.atan2(b.vy, b.vx));
    }
    this.bolts.end();

    let focus: RenderPose | null = null;
    this.players.forEach((sprite, i) => {
      const p = world.players[i];
      if (!p) return;
      sprite.update(lerpPose(prev.entities.get(p.id), p, alpha), p, fx, timeMs);
      if (i === 0) focus = sprite.current;
      if (p.mode !== 'dead')
        this.shadow(sprite.current.x, sprite.current.y, PLAYER.width / 2 - 6, 0.9, world);
    });
    this.shadows.end();
    return focus;
  }
}
