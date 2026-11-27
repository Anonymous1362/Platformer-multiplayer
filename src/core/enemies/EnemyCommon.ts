import { GameConfig, msToTicks } from '../GameConfig';
import type { DifficultyId } from '../Ids';
import type { EnemyMode, EnemyState } from '../SimulationTypes';

/** Helpers shared by `Enemies.ts` and every archetype module (kept apart to avoid import cycles). */

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export function enemySize(enemy: Pick<EnemyState, 'archetype'>): { halfW: number; height: number } {
  const c = GameConfig.enemies[enemy.archetype].colliderU;
  return { halfW: c.width / 2, height: c.height };
}

export function enemyBox(enemy: EnemyState): Box {
  const s = enemySize(enemy);
  return { left: enemy.x - s.halfW, top: enemy.y - s.height, right: enemy.x + s.halfW, bottom: enemy.y };
}

export function setEnemyMode(enemy: EnemyState, mode: EnemyMode): void {
  enemy.mode = mode;
  enemy.modeTicks = 0;
}

/** A telegraph scaled by difficulty (spec 3.4), never below 300 ms. */
export function telegraphTicks(baseTicks: number, difficulty: DifficultyId): number {
  const scaled = Math.round((baseTicks * GameConfig.difficulty[difficulty].telegraphPct) / 100);
  return Math.max(msToTicks(GameConfig.difficulty.minTelegraphMs), scaled);
}
