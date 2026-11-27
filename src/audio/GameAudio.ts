import type { Level } from '../core/level/LevelTypes';
import type { SimulationEvent, WorldState } from '../core/SimulationTypes';
import type { PlayOptions } from './SoundEngine';
import { PitchChain } from './Spatial';
import type { SfxKey } from './SynthRecipes';

/** The part of `SoundEngine` the game uses (lets tests record calls). */
export interface SfxPlayer {
  play(key: SfxKey, options?: PlayOptions): number | null;
  stop(id: number): void;
  duck(db: number, holdMs?: number): void;
  setListener(x: number, viewWidthU: number): void;
}

const HEARTBEAT_MS = 900;
/** Footsteps: one per stride at nominal run speed, faster when running faster (render-side only). */
const STEP_MS = 290;
const STEP_SPEED_U = 420;
const STEP_MIN_SPEED_U = 60;
/** Landings quieter than this fall height (u) make no sound. */
const MIN_LANDING_U = 40;
const BIG_LANDING_U = 128;

/**
 * Turns each tick's simulation events into sounds (spec 10.3, 13.8), exactly once per tick, and keeps
 * the continuous sounds (jetpack loop, low-HP heartbeat) in step with the state. Positions pan and
 * attenuate relative to the camera. Render-side only: nothing here reaches the simulation.
 */
export class GameAudio {
  private readonly engine: SfxPlayer;
  private readonly level: Level;
  private readonly shards = new PitchChain();
  private readonly jetpackVoice = new Map<number, number>();
  private readonly stepMs = new Map<number, number>();
  private heartbeatMs = 0;
  private clockMs = 0;

  constructor(engine: SfxPlayer, level: Level) {
    this.engine = engine;
    this.level = level;
  }

  onTick(events: readonly SimulationEvent[], world: WorldState, landings: ReadonlyMap<number, number>): void {
    const playerX = (id: number): number | undefined => world.players.find((p) => p.id === id)?.x;
    const e = this.engine;
    for (const ev of events) {
      switch (ev.type) {
        case 'jumped':
          e.play('sfx_jump', { x: playerX(ev.playerId) });
          break;
        case 'wallJumped':
          e.play('sfx_jump', { x: playerX(ev.playerId), pitch: 1.12 });
          break;
        case 'landed': {
          const fall = landings.get(ev.playerId) ?? 0;
          if (fall >= MIN_LANDING_U) {
            e.play('sfx_land', {
              x: playerX(ev.playerId),
              gain: Math.min(1, 0.35 + (0.65 * fall) / BIG_LANDING_U),
            });
          }
          break;
        }
        case 'dashed':
          e.play('sfx_dash', { x: playerX(ev.playerId) });
          break;
        case 'shotFired':
          e.play('sfx_shoot_pulse_blaster', { x: ev.x });
          break;
        case 'weaponVented':
          e.play('sfx_overheat_vent', { x: playerX(ev.playerId) });
          break;
        case 'projectileHit':
          if (ev.targetId === 0) e.play('sfx_impact_metal', { x: ev.x, gain: 0.7 });
          break;
        case 'enemyHurt':
          e.play('sfx_crawler_hurt', { x: ev.x });
          break;
        case 'enemyAlert': {
          const enemy = world.enemies.find((n) => n.id === ev.enemyId);
          e.play('sfx_crawler_alert', { x: enemy?.x });
          e.duck(-6);
          break;
        }
        case 'enemyWindup': {
          const enemy = world.enemies.find((n) => n.id === ev.enemyId);
          e.play('sfx_crawler_windup', { x: enemy?.x });
          break;
        }
        case 'enemyDefeated':
          e.play('sfx_crawler_death', { x: ev.x });
          break;
        case 'playerHurt':
        case 'hazardHit':
          e.play('sfx_hurt', { x: playerX(ev.playerId) });
          break;
        case 'died':
          e.play('sfx_death', { x: playerX(ev.playerId) });
          break;
        case 'respawned':
          e.play('sfx_revive', { x: playerX(ev.playerId) });
          break;
        case 'shardCollected':
          e.play('sfx_shard_pickup', { x: ev.x, pitch: this.shards.next(this.clockMs) });
          break;
        case 'checkpointReached':
          e.play('sfx_checkpoint', { x: this.level.checkpoints[ev.index]?.x });
          break;
        case 'levelComplete':
          e.play('sfx_level_complete');
          break;
        case 'droppedThrough':
          break;
      }
    }
  }

  /**
   * Per rendered frame: listener position, jetpack loops, and the low-HP heartbeat. `dtMs` is 0 while
   * paused (loops are stopped by `pause`).
   */
  frame(world: WorldState, listenerX: number, viewWidthU: number, lowHp: boolean, dtMs: number): void {
    this.clockMs += dtMs;
    this.engine.setListener(listenerX, viewWidthU);
    if (dtMs <= 0) return;
    for (const p of world.players) {
      const speed = Math.abs(p.vx);
      if (p.mode === 'ground' && p.grounded && speed > STEP_MIN_SPEED_U) {
        const left = (this.stepMs.get(p.id) ?? 0) - dtMs;
        if (left <= 0) {
          this.engine.play('sfx_footstep', { x: p.x, gain: 0.7 });
          const interval = STEP_MS * Math.min(1.5, Math.max(0.7, STEP_SPEED_U / speed));
          this.stepMs.set(p.id, interval);
        } else {
          this.stepMs.set(p.id, left);
        }
      } else {
        this.stepMs.set(p.id, 0);
      }
      const voice = this.jetpackVoice.get(p.id);
      const on = p.jetpacking && p.mode !== 'dead';
      if (on && voice === undefined) {
        const id = this.engine.play('sfx_jetpack_loop', { x: p.x });
        if (id !== null) this.jetpackVoice.set(p.id, id);
      } else if (!on && voice !== undefined) {
        this.engine.stop(voice);
        this.jetpackVoice.delete(p.id);
      }
    }
    if (lowHp) {
      this.heartbeatMs -= dtMs;
      if (this.heartbeatMs <= 0) {
        this.engine.play('sfx_heartbeat', { x: world.players[0]?.x, gain: 0.9 });
        this.heartbeatMs = HEARTBEAT_MS;
      }
    } else {
      this.heartbeatMs = 0;
    }
  }

  /** Pause and scene changes: stop loops (they restart from the state on resume). */
  pause(): void {
    for (const id of this.jetpackVoice.values()) this.engine.stop(id);
    this.jetpackVoice.clear();
    this.heartbeatMs = 0;
  }
}
