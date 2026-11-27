import { freeEntity } from '../EntityIds';
import { damageEnemy, enemyBox } from '../enemies/Enemies';
import { DT, GameConfig } from '../GameConfig';
import { insertById, newEntityId, type SimContext } from '../SimContext';
import type { EnemyState, ProjectileState } from '../SimulationTypes';
import { raycastTiles, segmentBox } from './Raycast';

/**
 * Projectiles (spec 4.2, N3): every tick each bolt's whole path is tested against tiles, solid
 * platforms, and targets, and the earliest contact wins, so speed never lets a bolt pass through.
 */

const RADIUS = GameConfig.combat.projectile.radiusU;

export function spawnProjectile(ctx: SimContext, init: Omit<ProjectileState, 'id'>): boolean {
  const id = newEntityId(ctx.state);
  if (id === null) return false;
  insertById(ctx.state.projectiles, { id, ...init });
  return true;
}

function remove(ctx: SimContext, projectile: ProjectileState): void {
  const list = ctx.state.projectiles;
  const i = list.indexOf(projectile);
  if (i >= 0) list.splice(i, 1);
  freeEntity(ctx.state.entities, projectile.id);
}

/** Step 5 of the tick order. */
export function stepProjectiles(ctx: SimContext): void {
  for (const bolt of [...ctx.state.projectiles]) {
    const x1 = bolt.x + bolt.vx * DT;
    const y1 = bolt.y + bolt.vy * DT;
    let bestT = raycastTiles(ctx.level, bolt.x, bolt.y, x1, y1) ?? Number.POSITIVE_INFINITY;
    let target: EnemyState | null = null;

    ctx.state.platforms.forEach((p, i) => {
      const def = ctx.level.platforms[i];
      if (!def || def.oneWay) return;
      const t = segmentBox(bolt.x, bolt.y, x1, y1, p.x, p.y, p.x + def.w, p.y + def.h);
      if (t !== null && t < bestT) bestT = t;
    });

    if (bolt.team === 'player') {
      for (const enemy of ctx.state.enemies) {
        if (enemy.mode === 'dead' || enemy.asleep) continue;
        const box = enemyBox(enemy);
        const t = segmentBox(
          bolt.x,
          bolt.y,
          x1,
          y1,
          box.left - RADIUS,
          box.top - RADIUS,
          box.right + RADIUS,
          box.bottom + RADIUS,
        );
        if (t !== null && t < bestT) {
          bestT = t;
          target = enemy;
        }
      }
    }

    if (bestT <= 1) {
      const hx = bolt.x + (x1 - bolt.x) * bestT;
      const hy = bolt.y + (y1 - bolt.y) * bestT;
      ctx.events.push({ type: 'projectileHit', tick: ctx.tick, x: hx, y: hy, targetId: target?.id ?? 0 });
      if (target) damageEnemy(ctx, target, bolt.damage, hx, hy);
      remove(ctx, bolt);
      continue;
    }
    bolt.x = x1;
    bolt.y = y1;
    bolt.rangeLeftU -= Math.sqrt(bolt.vx * bolt.vx + bolt.vy * bolt.vy) * DT;
    if (bolt.rangeLeftU <= 0) remove(ctx, bolt);
  }
}

/** Removes every projectile (death reset). */
export function clearProjectiles(ctx: SimContext): void {
  for (const bolt of ctx.state.projectiles) freeEntity(ctx.state.entities, bolt.id);
  ctx.state.projectiles.length = 0;
}
