import type Phaser from 'phaser';
import { GameConfig } from '../../core/GameConfig';
import type { Level } from '../../core/level/LevelTypes';
import { Random } from '../../core/Random';
import type { PlayerState, SimulationEvent, WorldState } from '../../core/SimulationTypes';
import { Palette, slotColor } from '../../theme/ThemePalette';
import { Depth } from '../world/Depth';
import type { CameraRig } from './CameraRig';
import type { EntityFx, SpriteSnapshot } from './EntityFx';
import { BIG_LANDING_U, HIT_FLASH_MS, HIT_STOP_MS, progress } from './FxMath';
import type { Particles, ParticleSpec } from './Particles';
import type { ScreenFx } from './ScreenFx';

const PLAYER_H = GameConfig.player.colliderU.height;
const CHECKPOINT_H = GameConfig.pickups.checkpointU.height;
const SQUASH_MS = 140;
const RECOIL_MS = 70;
const RECOIL_U = 4;
const NUMBER_MS = 650;
const NUMBER_POOL = 10;
/** Afterimages appear on the dash tick and 3 and 6 ticks later (three in all, spec 13.8). */
const AFTERIMAGE_TICKS: readonly number[] = [3, 6];
const AFTERIMAGE_LAST_TICK = 6;

interface FloatingText {
  readonly text: Phaser.GameObjects.Text;
  start: number;
  x: number;
  y: number;
  active: boolean;
}

/**
 * Event-driven effects (spec 13.8, O7). The scene hands over each tick's events exactly once; nothing
 * here feeds back into the simulation. Each effect has a fixed per-instance particle budget, the pool
 * enforces the global cap, and variety comes from a render-only generator.
 */
export class Effects implements EntityFx {
  private readonly particles: Particles;
  private readonly camera: CameraRig;
  private readonly screen: ScreenFx;
  private readonly level: Level;
  private readonly reducedMotion: boolean;
  private readonly snapshot: (id: number) => SpriteSnapshot | null;
  private readonly rng = new Random(0x0c0ffee);
  private now = 0;
  private readonly freezeUntil = new Map<number, number>();
  private readonly flashUntil = new Map<number, number>();
  private readonly squashStart = new Map<number, number>();
  private readonly recoilStart = new Map<number, number>();
  private readonly dashTick = new Map<number, number>();
  private readonly numbers: FloatingText[] = [];
  private landings: ReadonlyMap<number, number> = new Map();

  constructor(
    scene: Phaser.Scene,
    options: {
      readonly particles: Particles;
      readonly camera: CameraRig;
      readonly screen: ScreenFx;
      readonly level: Level;
      readonly reducedMotion: boolean;
      readonly snapshot: (id: number) => SpriteSnapshot | null;
    },
  ) {
    this.particles = options.particles;
    this.camera = options.camera;
    this.screen = options.screen;
    this.level = options.level;
    this.reducedMotion = options.reducedMotion;
    this.snapshot = options.snapshot;
    for (let i = 0; i < NUMBER_POOL; i += 1) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '28px',
          fontStyle: 'bold',
          color: '#FFFFFF',
          stroke: '#080B1A',
          strokeThickness: 5,
        })
        .setOrigin(0.5, 1)
        .setDepth(Depth.Fx + 1)
        .setVisible(false);
      this.numbers.push({ text, start: 0, x: 0, y: 0, active: false });
    }
  }

  // ---- EntityFx -------------------------------------------------------------------------------

  frozen(id: number): boolean {
    return (this.freezeUntil.get(id) ?? -1) > this.now;
  }

  flashing(id: number): boolean {
    return (this.flashUntil.get(id) ?? -1) > this.now;
  }

  squash(id: number): { readonly sx: number; readonly sy: number } {
    const start = this.squashStart.get(id);
    if (start === undefined) return { sx: 1, sy: 1 };
    const t = progress(this.now, start, SQUASH_MS);
    if (t >= 1) {
      this.squashStart.delete(id);
      return { sx: 1, sy: 1 };
    }
    const k = 1 - t;
    return { sx: 1 + 0.12 * k, sy: 1 - 0.18 * k };
  }

  recoil(id: number): number {
    const start = this.recoilStart.get(id);
    if (start === undefined) return 0;
    const t = progress(this.now, start, RECOIL_MS);
    if (t >= 1) this.recoilStart.delete(id);
    return RECOIL_U * (1 - t);
  }

  get liveParticles(): number {
    return this.particles.live;
  }

  // ---- Simulation events (once per tick) ----------------------------------------------------

  /** `landings`: fall height per player that landed this tick (from the scene's `FallTracker`). */
  onTick(events: readonly SimulationEvent[], world: WorldState, landings: ReadonlyMap<number, number>): void {
    this.landings = landings;
    for (const e of events) this.handle(e, world);
    for (const p of world.players) {
      const start = this.dashTick.get(p.id);
      if (start !== undefined) {
        const age = world.tick - start;
        if (AFTERIMAGE_TICKS.includes(age)) this.afterimage(p);
        if (age >= AFTERIMAGE_LAST_TICK) this.dashTick.delete(p.id);
      }
    }
  }

  private player(world: WorldState, id: number): PlayerState | undefined {
    return world.players.find((p) => p.id === id);
  }

  private handle(e: SimulationEvent, world: WorldState): void {
    switch (e.type) {
      case 'jumped': {
        const p = this.player(world, e.playerId);
        if (p) this.dust(p.x, p.y, 3, 0.5);
        break;
      }
      case 'wallJumped': {
        const p = this.player(world, e.playerId);
        if (p) this.dust(p.x - p.facing * 20, p.y - PLAYER_H / 2, 3, 0.5);
        break;
      }
      case 'landed': {
        const p = this.player(world, e.playerId);
        if (p && (this.landings.get(e.playerId) ?? 0) > BIG_LANDING_U) {
          this.dust(p.x, p.y, 8, 1);
          this.squashStart.set(p.id, this.now);
        }
        break;
      }
      case 'dashed': {
        const p = this.player(world, e.playerId);
        if (!p) break;
        this.dashTick.set(p.id, world.tick);
        this.afterimage(p);
        this.burst(p.x, p.y - PLAYER_H / 2, 4, {
          tint: Palette.electricCyan,
          speed: 160,
          lifeMs: 200,
          size: 0.18,
        });
        break;
      }
      case 'shotFired':
        this.spawn({
          texture: 'fx_glow',
          x: e.x,
          y: e.y,
          lifeMs: 70,
          scale0: 0.7,
          scale1: 1.1,
          alpha0: 0.95,
          tint: Palette.electricCyan,
          additive: true,
        });
        this.recoilStart.set(e.playerId, this.now);
        break;
      case 'projectileHit':
        if (e.targetId === 0)
          this.burst(e.x, e.y, 5, { tint: Palette.electricCyan, speed: 220, lifeMs: 220, size: 0.16 });
        break;
      case 'enemyHurt':
        this.burst(e.x, e.y, 6, { tint: 0xffffff, speed: 260, lifeMs: 240, size: 0.16 });
        this.flashUntil.set(e.enemyId, this.now + HIT_FLASH_MS);
        this.number(String(e.damage), e.x, e.y - 20, '#FFFFFF');
        break;
      case 'playerHurt': {
        this.flashUntil.set(e.playerId, this.now + HIT_FLASH_MS);
        this.freezeUntil.set(e.playerId, this.now + HIT_STOP_MS);
        const p = this.player(world, e.playerId);
        this.camera.kick(p ? Math.sign(p.x - e.sourceX) * 8 : 0, -4);
        this.camera.addTrauma(0.35);
        this.screen.flashDamage();
        break;
      }
      case 'hazardHit': {
        const p = this.player(world, e.playerId);
        if (p) {
          const tint = e.cause === 'lava' ? Palette.magmaAmber : Palette.neonCrimson;
          this.burst(p.x, p.y - PLAYER_H / 3, 6, { tint, speed: 240, lifeMs: 280, size: 0.2 });
          this.flashUntil.set(p.id, this.now + HIT_FLASH_MS);
        }
        this.camera.addTrauma(0.3);
        this.screen.flashDamage();
        break;
      }
      case 'died': {
        const p = this.player(world, e.playerId);
        if (p)
          this.burst(p.x, p.y - PLAYER_H / 2, 16, {
            tint: slotColor(p.slot),
            speed: 320,
            lifeMs: 520,
            size: 0.24,
          });
        this.camera.addTrauma(0.5);
        break;
      }
      case 'respawned': {
        const p = this.player(world, e.playerId);
        if (!p) break;
        this.ring(p.x, p.y - PLAYER_H / 2, slotColor(p.slot), 420, 0.3, 1.1);
        this.motes(p.x, p.y, 6, slotColor(p.slot));
        break;
      }
      case 'enemyDefeated':
        this.defeat(e.enemyId, e.x, e.y);
        break;
      case 'shardCollected':
        this.burst(e.x, e.y, 6, { tint: Palette.starlightGold, speed: 200, lifeMs: 260, size: 0.16 });
        this.ring(e.x, e.y, Palette.starlightGold, 240, 0.15, 0.45);
        break;
      case 'checkpointReached': {
        const cp = this.level.checkpoints[e.index];
        if (!cp) break;
        this.spawn({
          texture: 'fx_beam',
          x: cp.x,
          y: cp.y,
          originY: 1,
          lifeMs: 900,
          scale0: 1,
          scale1: 1.4,
          stretchY: 2.2,
          alpha0: 0.75,
          tint: Palette.electricCyan,
          additive: true,
          depth: Depth.Markers,
        });
        this.ring(cp.x, cp.y - CHECKPOINT_H / 2, Palette.electricCyan, 600, 0.4, 1.6);
        this.motes(cp.x, cp.y, 10, Palette.electricCyan);
        this.number('Saved', cp.x, cp.y - CHECKPOINT_H - 16, '#00F5D4');
        break;
      }
      case 'weaponVented': {
        const p = this.player(world, e.playerId);
        if (!p) break;
        for (let i = 0; i < 6; i += 1) {
          this.spawn({
            texture: 'fx_glow',
            x: p.x - p.facing * 18,
            y: p.y - PLAYER_H * 0.6,
            vx: -p.facing * (20 + this.rng.nextFloat() * 40),
            vy: -60 - this.rng.nextFloat() * 60,
            drag: 1.5,
            lifeMs: 500 + this.rng.nextFloat() * 200,
            delayMs: i * 40,
            scale0: 0.25,
            scale1: 0.6,
            alpha0: 0.35,
            tint: 0xe2e8f0,
          });
        }
        break;
      }
      case 'levelComplete': {
        const exit = this.level.exits[0];
        if (!exit) break;
        this.burst(exit.x, exit.y - 64, 24, {
          tint: Palette.starlightGold,
          speed: 360,
          lifeMs: 700,
          size: 0.22,
        });
        this.ring(exit.x, exit.y - 64, Palette.nebulaViolet, 700, 0.5, 2.2);
        break;
      }
      case 'droppedThrough':
      case 'enemyAlert':
      case 'enemyWindup':
        break; // shown by the views from the entity's mode
    }
  }

  // ---- Effect building blocks ---------------------------------------------------------------

  private spawn(spec: ParticleSpec): void {
    this.particles.spawn(spec);
  }

  private burst(
    x: number,
    y: number,
    count: number,
    o: { readonly tint: number; readonly speed: number; readonly lifeMs: number; readonly size: number },
  ): void {
    for (let i = 0; i < count; i += 1) {
      const a = this.rng.nextFloat() * Math.PI * 2;
      const v = o.speed * (0.5 + this.rng.nextFloat() * 0.7);
      this.spawn({
        texture: 'fx_glow',
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        gravity: 500,
        drag: 2,
        lifeMs: o.lifeMs * (0.7 + this.rng.nextFloat() * 0.5),
        scale0: o.size,
        scale1: o.size * 0.3,
        tint: o.tint,
        additive: true,
      });
    }
  }

  private dust(x: number, y: number, count: number, strength: number): void {
    for (let i = 0; i < count; i += 1) {
      const side = i % 2 === 0 ? 1 : -1;
      this.spawn({
        texture: 'fx_glow',
        x: x + side * this.rng.nextFloat() * 10,
        y: y - 4,
        vx: side * (60 + this.rng.nextFloat() * 120) * strength,
        vy: -20 - this.rng.nextFloat() * 50 * strength,
        drag: 4,
        lifeMs: 320 + this.rng.nextFloat() * 160,
        scale0: 0.25 * strength + 0.15,
        scale1: 0.6 * strength + 0.2,
        alpha0: 0.4,
        tint: Palette.coolSteel,
      });
    }
  }

  private ring(x: number, y: number, tint: number, lifeMs: number, scale0: number, scale1: number): void {
    this.spawn({ texture: 'fx_ring', x, y, lifeMs, scale0, scale1, alpha0: 0.9, tint, additive: true });
  }

  private motes(x: number, y: number, count: number, tint: number): void {
    for (let i = 0; i < count; i += 1) {
      this.spawn({
        texture: 'fx_glow',
        x: x + (this.rng.nextFloat() - 0.5) * 48,
        y: y - this.rng.nextFloat() * 24,
        vy: -90 - this.rng.nextFloat() * 90,
        lifeMs: 600 + this.rng.nextFloat() * 300,
        delayMs: this.rng.nextFloat() * 120,
        scale0: 0.18,
        scale1: 0.05,
        tint,
        additive: true,
      });
    }
  }

  private afterimage(p: PlayerState): void {
    this.spawn({
      texture: 'char_player_suit',
      x: p.x,
      y: p.y,
      originY: 1,
      flipX: p.facing < 0,
      lifeMs: 200,
      alpha0: 0.45,
      tint: slotColor(p.slot),
      additive: true,
      depth: Depth.Players - 0.5,
    });
  }

  /** Enemy defeat: a hit-stop beat, then the body dissolves into shard light (spec 13.8). */
  private defeat(enemyId: number, x: number, y: number): void {
    this.camera.kick(0, -6);
    this.camera.addTrauma(0.2);
    const shot = this.snapshot(enemyId);
    if (shot) {
      this.spawn({
        texture: shot.texture,
        x: shot.x,
        y: shot.y,
        originY: 1,
        flipX: shot.flipX,
        vy: -30,
        lifeMs: 380,
        delayMs: HIT_STOP_MS,
        scale0: 1,
        scale1: 0.6,
        alpha0: 0.9,
        tint: Palette.starlightGold,
        additive: true,
        depth: Depth.Enemies,
      });
    }
    this.motes(x, y + 10, 12, Palette.starlightGold);
    this.burst(x, y, 10, { tint: Palette.nebulaViolet, speed: 280, lifeMs: 360, size: 0.2 });
  }

  private number(label: string, x: number, y: number, color: string): void {
    const slot =
      this.numbers.find((n) => !n.active) ?? this.numbers.reduce((a, b) => (a.start <= b.start ? a : b));
    slot.active = true;
    slot.start = this.now;
    slot.x = x;
    slot.y = y;
    slot.text.setText(label).setColor(color).setPosition(x, y).setAlpha(1).setVisible(true);
  }

  // ---- Per rendered frame ----------------------------------------------------------------------

  /** Advances the effect clock (0 while paused, so effects freeze with the game). */
  update(dtMs: number): void {
    this.now += dtMs;
    this.particles.update(dtMs);
    for (const n of this.numbers) {
      if (!n.active) continue;
      const t = progress(this.now, n.start, NUMBER_MS);
      if (t >= 1) {
        n.active = false;
        n.text.setVisible(false);
        continue;
      }
      const rise = this.reducedMotion ? 0 : 36 * t;
      n.text.setPosition(n.x, n.y - rise).setAlpha(t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);
    }
    for (const map of [this.freezeUntil, this.flashUntil]) {
      for (const [id, until] of map) if (until <= this.now) map.delete(id);
    }
  }
}
