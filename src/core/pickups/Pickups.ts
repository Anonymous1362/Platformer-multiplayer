import { moveX, moveY, type BodySize } from '../Collision';
import { freeEntity } from '../EntityIds';
import { DT, GameConfig } from '../GameConfig';
import { insertById, newEntityId, type SimContext } from '../SimContext';
import { ShardStatus, type PickupState, type PlayerState, type WorldState } from '../SimulationTypes';
import type { Level } from '../level/LevelTypes';

/**
 * Star Shards (spec 3.5): level shards float in place; enemy drops pop out and fall to the ground.
 * Within the magnet radius a shard flies to the nearest player; within the pickup radius (M5,
 * enlarged) it is collected. Collected shards are carried until a checkpoint banks them.
 */

const PK = GameConfig.pickups;
const PLAYER_CENTER_U = GameConfig.player.colliderU.height / 2;
const SHARD: BodySize = { halfW: PK.shardSizeU / 2, height: PK.shardSizeU };

function addPickup(state: WorldState, init: Omit<PickupState, 'id'>): void {
  const id = newEntityId(state);
  if (id === null) return;
  insertById(state.pickups, { id, ...init });
}

/** Creates a pickup for every level shard that is still present. */
export function spawnLevelShards(state: WorldState, level: Level): void {
  level.shards.forEach((shard, i) => {
    if (state.run.shardStatus[i] !== ShardStatus.Present) return;
    addPickup(state, { source: i, x: shard.x, y: shard.y, vx: 0, vy: 0, floating: true });
  });
}

/** Enemy drops: a small fan that pops up and falls (spec 13.8 "drop burst"). */
export function spawnDrops(ctx: SimContext, x: number, y: number, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const spread = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
    addPickup(ctx.state, {
      source: -1,
      x,
      y,
      vx: spread * PK.dropSpreadVxUps,
      vy: PK.dropPopVyUps,
      floating: false,
    });
  }
}

export function removeAllPickups(state: WorldState): void {
  for (const pickup of state.pickups) freeEntity(state.entities, pickup.id);
  state.pickups.length = 0;
}

function collector(ctx: SimContext, pickup: PickupState, radius: number): PlayerState | null {
  let best: PlayerState | null = null;
  let bestDist = radius;
  for (const p of ctx.state.players) {
    if (p.mode === 'dead' || p.mode === 'hazardRespawn') continue;
    const dx = p.x - pickup.x;
    const dy = p.y - PLAYER_CENTER_U - pickup.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= bestDist) {
      best = p;
      bestDist = dist;
    }
  }
  return best;
}

function fall(ctx: SimContext, pickup: PickupState): void {
  // Drops use their center as y; collision works on a small box whose feet sit half a size lower.
  const feet = pickup.y + SHARD.height / 2;
  pickup.vy = Math.min(
    pickup.vy + GameConfig.player.gravityFallUps2 * ctx.planet.gravity * DT,
    GameConfig.player.terminalFallUps,
  );
  const mx = moveX(ctx.world, pickup.x, feet, pickup.vx * DT, { ledgeForgiveness: false, size: SHARD });
  if (mx.blocked) pickup.vx = 0;
  const my = moveY(ctx.world, mx.x, feet, pickup.vy * DT, {
    ignoreOneWay: false,
    cornerCorrection: false,
    preferDir: 1,
    size: SHARD,
  });
  pickup.x = mx.x;
  pickup.y = my.y - SHARD.height / 2;
  if (my.bonked) pickup.vy = 0;
  if (my.landed) {
    pickup.floating = true;
    pickup.vx = 0;
    pickup.vy = 0;
  }
}

/** Part of step 6: shard physics, magnet pull, and collection. */
export function stepPickups(ctx: SimContext): void {
  for (const pickup of [...ctx.state.pickups]) {
    const magnet = collector(ctx, pickup, PK.magnetRadiusU);
    if (magnet) {
      const tx = magnet.x;
      const ty = magnet.y - PLAYER_CENTER_U;
      const dx = tx - pickup.x;
      const dy = ty - pickup.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const step = Math.min(dist, PK.magnetUps * DT);
      if (dist > 0) {
        pickup.x += (dx / dist) * step;
        pickup.y += (dy / dist) * step;
      }
      pickup.floating = true;
      pickup.vx = 0;
      pickup.vy = 0;
    } else if (!pickup.floating) {
      fall(ctx, pickup);
    }
    const taker = collector(ctx, pickup, PK.shardRadiusU);
    if (!taker) continue;
    const run = ctx.state.run;
    run.shardsCarried += 1;
    if (pickup.source >= 0) run.shardStatus[pickup.source] = ShardStatus.Carried;
    ctx.events.push({ type: 'shardCollected', playerId: taker.id, tick: ctx.tick, x: pickup.x, y: pickup.y });
    const i = ctx.state.pickups.indexOf(pickup);
    if (i >= 0) ctx.state.pickups.splice(i, 1);
    freeEntity(ctx.state.entities, pickup.id);
  }
}
