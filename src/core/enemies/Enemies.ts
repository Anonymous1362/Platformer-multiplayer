import { freeEntity } from '../EntityIds';
import { GameConfig } from '../GameConfig';
import type { DifficultyId } from '../Ids';
import type { EnemyArchetype, EnemySpawn } from '../level/LevelTypes';
import { spawnDrops } from '../pickups/Pickups';
import { insertById, newEntityId, type SimContext } from '../SimContext';
import type { EnemyState, WorldState } from '../SimulationTypes';
import { stepCrawler } from './Crawler';
import { enemySize } from './EnemyCommon';

export { enemyBox, enemySize } from './EnemyCommon';

/**
 * Shared enemy plumbing (spec 4.4): spawning with difficulty-scaled HP, activation and sleep by
 * distance, damage, defeat with shard drops, and section resets. Archetype behavior lives in its own
 * module (`Crawler.ts`).
 */

const E = GameConfig.enemies;

/** Each archetype's AI and movement (spec 4.4). */
const BEHAVIOR: Readonly<Record<EnemyArchetype, (ctx: SimContext, enemy: EnemyState) => void>> = {
  crawler: stepCrawler,
};

export function createEnemy(
  state: WorldState,
  spawnIndex: number,
  spawn: EnemySpawn,
  difficulty: DifficultyId,
): EnemyState | null {
  const id = newEntityId(state);
  if (id === null) return null;
  const hp = Math.max(
    1,
    Math.round((E[spawn.archetype].hp * GameConfig.difficulty[difficulty].enemyHpPct) / 100),
  );
  const enemy: EnemyState = {
    id,
    archetype: spawn.archetype,
    spawnIndex,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    facing: spawn.facing,
    hp,
    maxHp: hp,
    mode: 'idle',
    modeTicks: 0,
    grounded: false,
    asleep: true,
    targetSlot: -1,
    lostTicks: 0,
    chargeU: 0,
  };
  insertById(state.enemies, enemy);
  return enemy;
}

/** Spawns every enemy whose spawn passes `include` (all of them by default). */
export function spawnEnemies(
  state: WorldState,
  spawns: readonly EnemySpawn[],
  difficulty: DifficultyId,
  include: (spawn: EnemySpawn) => boolean = () => true,
): void {
  spawns.forEach((spawn, i) => {
    if (include(spawn)) createEnemy(state, i, spawn, difficulty);
  });
}

function removeEnemy(state: WorldState, enemy: EnemyState): void {
  const i = state.enemies.indexOf(enemy);
  if (i >= 0) state.enemies.splice(i, 1);
  freeEntity(state.entities, enemy.id);
}

/** Removes and respawns every enemy whose spawn passes `include` (death reset, spec 4.3). */
export function resetEnemies(ctx: SimContext, include: (spawn: EnemySpawn) => boolean): void {
  for (const enemy of [...ctx.state.enemies]) {
    const spawn = ctx.level.enemies[enemy.spawnIndex];
    if (spawn && include(spawn)) removeEnemy(ctx.state, enemy);
  }
  spawnEnemies(ctx.state, ctx.level.enemies, ctx.difficulty, include);
}

export function defeatEnemy(ctx: SimContext, enemy: EnemyState): void {
  const h = enemySize(enemy).height;
  ctx.events.push({
    type: 'enemyDefeated',
    enemyId: enemy.id,
    tick: ctx.tick,
    x: enemy.x,
    y: enemy.y - h / 2,
  });
  spawnDrops(ctx, enemy.x, enemy.y - h / 2, E[enemy.archetype].shards);
  enemy.mode = 'dead';
  removeEnemy(ctx.state, enemy);
}

export function damageEnemy(ctx: SimContext, enemy: EnemyState, amount: number, x: number, y: number): void {
  if (enemy.mode === 'dead' || amount <= 0) return;
  enemy.hp = Math.max(0, enemy.hp - amount);
  ctx.events.push({ type: 'enemyHurt', enemyId: enemy.id, tick: ctx.tick, damage: amount, x, y });
  if (enemy.hp <= 0) defeatEnemy(ctx, enemy);
}

/** Distance from the enemy to the nearest player (feet to feet). */
function nearestPlayerDistance(ctx: SimContext, enemy: EnemyState): number {
  let best = Number.POSITIVE_INFINITY;
  for (const p of ctx.state.players) {
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    best = Math.min(best, Math.sqrt(dx * dx + dy * dy));
  }
  return best;
}

/** Step 4 of the tick order: activation, then each archetype's AI and movement. */
export function stepEnemies(ctx: SimContext): void {
  for (const enemy of [...ctx.state.enemies]) {
    if (enemy.mode === 'dead') continue;
    const d = nearestPlayerDistance(ctx, enemy);
    if (enemy.asleep && d <= E.activationRangeU) enemy.asleep = false;
    else if (!enemy.asleep && d > E.sleepRangeU) enemy.asleep = true;
    if (enemy.asleep) continue;
    BEHAVIOR[enemy.archetype](ctx, enemy);
  }
}
