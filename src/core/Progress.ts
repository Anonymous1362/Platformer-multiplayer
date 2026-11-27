import { clearProjectiles } from './combat/Projectiles';
import { resetEnemies } from './enemies/Enemies';
import { GameConfig } from './GameConfig';
import type { Level, LevelPoint } from './level/LevelTypes';
import { hurtBox } from './player/Hazards';
import { removeAllPickups, spawnLevelShards } from './pickups/Pickups';
import type { SimContext } from './SimContext';
import { ShardStatus, type PlayerState, type RunState } from './SimulationTypes';

/**
 * Level progress (spec 3.5 and 4.3): checkpoints bank shards, restore health, and move the respawn
 * point; the exit completes the level; a death loses the shards carried since the last checkpoint,
 * puts them back in the level, and resets the enemies of the respawn section.
 */

const PK = GameConfig.pickups;

export function createRun(level: Level): RunState {
  return {
    shardsBanked: 0,
    shardsCarried: 0,
    shardStatus: level.shards.map(() => ShardStatus.Present),
    checkpointsReached: level.checkpoints.map(() => 0),
    checkpoint: -1,
    respawnX: level.spawn.x,
    respawnY: level.spawn.y,
    completeTick: -1,
  };
}

function touches(p: PlayerState, point: LevelPoint, size: { width: number; height: number }): boolean {
  const h = hurtBox(p);
  const left = point.x - size.width / 2;
  const top = point.y - size.height;
  return h.left < left + size.width && h.right > left && h.top < point.y && h.bottom > top;
}

function bankCarried(run: RunState): void {
  run.shardsBanked += run.shardsCarried;
  run.shardsCarried = 0;
  run.shardStatus.forEach((status, i) => {
    if (status === ShardStatus.Carried) run.shardStatus[i] = ShardStatus.Banked;
  });
}

function active(p: PlayerState): boolean {
  return p.mode !== 'dead' && p.mode !== 'hazardRespawn';
}

/** Part of step 6: checkpoints (each activates once, in any order) and the exit. */
export function stepTriggers(ctx: SimContext): void {
  const run = ctx.state.run;
  ctx.level.checkpoints.forEach((cp, i) => {
    if (run.checkpointsReached[i] === 1) return;
    const toucher = ctx.state.players.find((p) => active(p) && touches(p, cp, PK.checkpointU));
    if (!toucher) return;
    run.checkpointsReached[i] = 1;
    run.checkpoint = i;
    run.respawnX = cp.x;
    run.respawnY = cp.y;
    bankCarried(run);
    for (const p of ctx.state.players) {
      if (p.mode === 'dead') continue;
      p.hp = GameConfig.health.baseHp;
      p.shield = GameConfig.health.baseShield;
    }
    ctx.events.push({ type: 'checkpointReached', playerId: toucher.id, tick: ctx.tick, index: i });
  });
  if (run.completeTick >= 0) return;
  for (const exit of ctx.level.exits) {
    const toucher = ctx.state.players.find((p) => active(p) && touches(p, exit, PK.exitU));
    if (!toucher) continue;
    run.completeTick = ctx.tick;
    bankCarried(run);
    ctx.events.push({ type: 'levelComplete', playerId: toucher.id, tick: ctx.tick });
    return;
  }
}

/** The section zone containing a point, if the level has sections. */
function sectionAt(
  level: Level,
  x: number,
  y: number,
): { x: number; y: number; w: number; h: number } | null {
  for (const z of level.zones) {
    if (z.type === 'section' && x >= z.x && x < z.x + z.w && y > z.y && y <= z.y + z.h) return z;
  }
  return null;
}

/**
 * Step 7, after a death respawn: shards carried since the checkpoint are lost and return to the level,
 * projectiles vanish, and enemies of the respawn section reset (all enemies if the level has no
 * sections).
 */
export function resetAfterDeath(ctx: SimContext): void {
  const run = ctx.state.run;
  run.shardsCarried = 0;
  run.shardStatus.forEach((status, i) => {
    if (status === ShardStatus.Carried) run.shardStatus[i] = ShardStatus.Present;
  });
  removeAllPickups(ctx.state);
  spawnLevelShards(ctx.state, ctx.level);
  clearProjectiles(ctx);
  const section = sectionAt(ctx.level, run.respawnX, run.respawnY);
  resetEnemies(ctx, (spawn) =>
    section === null
      ? true
      : spawn.x >= section.x &&
        spawn.x < section.x + section.w &&
        spawn.y > section.y &&
        spawn.y <= section.y + section.h,
  );
}
