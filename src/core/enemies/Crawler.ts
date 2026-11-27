import { findSupport, moveX, moveY, tileFlags, wallContact } from '../Collision';
import { lineOfSight } from '../combat/Raycast';
import { DT, GameConfig, Ticks } from '../GameConfig';
import { TileFlag } from '../level/LevelTypes';
import { hurtBox, hurtPlayer } from '../player/Hazards';
import type { SimContext } from '../SimContext';
import type { EnemyState, PlayerState } from '../SimulationTypes';
import { enemyBox, enemySize, setEnemyMode, telegraphTicks } from './EnemyCommon';

/**
 * Crawler (spec 4.4): patrols at 120 u/s and turns at walls, edges, and patrol bounds. On seeing a
 * player it shows a 0.4 s alert, closes in, crouches for a 0.35 s telegraph, then charges at 260 u/s;
 * the charge deals 15 contact damage. Counter: jump over the charge, or shoot it.
 */

const C = GameConfig.enemies.crawler;
const E = GameConfig.enemies;
const TILE = GameConfig.world.tileSizeU;
const PLAYER_CENTER_U = GameConfig.player.colliderU.height / 2;
const EYE_U = C.colliderU.height / 2;
/** Probe distances for walls and the drop ahead of the leading foot. */
const WALL_PROBE_U = 2;
const EDGE_PROBE_U = 4;

function canBeTargeted(p: PlayerState): boolean {
  return p.mode !== 'dead' && p.mode !== 'hazardRespawn';
}

function inEngageRange(enemy: EnemyState, p: PlayerState): boolean {
  return Math.abs(p.x - enemy.x) <= E.engageRangeU.x && Math.abs(p.y - enemy.y) <= E.engageRangeU.y;
}

/** The nearest visible player in engage range (ties go to the lower slot). */
function findTarget(ctx: SimContext, enemy: EnemyState): PlayerState | null {
  let best: PlayerState | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const p of ctx.state.players) {
    if (!canBeTargeted(p) || !inEngageRange(enemy, p)) continue;
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= bestDist) continue;
    if (!lineOfSight(ctx.level, enemy.x, enemy.y - EYE_U, p.x, p.y - PLAYER_CENTER_U)) continue;
    best = p;
    bestDist = dist;
  }
  return best;
}

function currentTarget(ctx: SimContext, enemy: EnemyState): PlayerState | null {
  const p = ctx.state.players[enemy.targetSlot];
  return p && canBeTargeted(p) && inEngageRange(enemy, p) ? p : null;
}

/** A wall or a drop directly ahead (crawlers never walk off ledges). */
function blockedAhead(ctx: SimContext, enemy: EnemyState): boolean {
  const size = enemySize(enemy);
  const wall = wallContact(ctx.world, enemy.x, enemy.y, WALL_PROBE_U, size);
  if (enemy.facing === 1 ? wall.right : wall.left) return true;
  if (!enemy.grounded) return false;
  const probeX = enemy.x + enemy.facing * (size.halfW + EDGE_PROBE_U);
  const flags = tileFlags(ctx.level, Math.floor(probeX / TILE), Math.floor((enemy.y + EDGE_PROBE_U) / TILE));
  return (flags & (TileFlag.Solid | TileFlag.OneWay)) === 0;
}

function atPatrolBound(ctx: SimContext, enemy: EnemyState): boolean {
  const bounds = ctx.level.enemies[enemy.spawnIndex]?.patrol;
  if (!bounds) return false;
  return enemy.facing === 1 ? enemy.x >= bounds.maxX : enemy.x <= bounds.minX;
}

function face(enemy: EnemyState, x: number): void {
  if (x > enemy.x) enemy.facing = 1;
  else if (x < enemy.x) enemy.facing = -1;
}

function think(ctx: SimContext, enemy: EnemyState): void {
  enemy.modeTicks += 1;
  switch (enemy.mode) {
    case 'idle':
      setEnemyMode(enemy, 'patrol');
      break;
    case 'patrol': {
      const target = findTarget(ctx, enemy);
      if (target) {
        enemy.targetSlot = target.slot;
        enemy.lostTicks = 0;
        face(enemy, target.x);
        enemy.vx = 0;
        setEnemyMode(enemy, 'alert');
        ctx.events.push({ type: 'enemyAlert', enemyId: enemy.id, tick: ctx.tick });
        break;
      }
      if (blockedAhead(ctx, enemy) || atPatrolBound(ctx, enemy)) enemy.facing = enemy.facing === 1 ? -1 : 1;
      enemy.vx = enemy.facing * C.patrolUps;
      break;
    }
    case 'alert':
      enemy.vx = 0;
      if (enemy.modeTicks >= Ticks.enemyAlert) setEnemyMode(enemy, 'engage');
      break;
    case 'engage': {
      const target = currentTarget(ctx, enemy);
      if (!target) {
        enemy.vx = 0;
        enemy.lostTicks += 1;
        if (enemy.lostTicks >= Ticks.loseInterest) {
          enemy.targetSlot = -1;
          setEnemyMode(enemy, 'patrol');
        }
        break;
      }
      enemy.lostTicks = 0;
      face(enemy, target.x);
      if (
        Math.abs(target.x - enemy.x) <= C.chargeReachU.x &&
        Math.abs(target.y - enemy.y) <= C.chargeReachU.y
      ) {
        enemy.vx = 0;
        setEnemyMode(enemy, 'windup');
        ctx.events.push({ type: 'enemyWindup', enemyId: enemy.id, tick: ctx.tick });
        break;
      }
      enemy.vx = blockedAhead(ctx, enemy) ? 0 : enemy.facing * C.patrolUps;
      break;
    }
    case 'windup':
      enemy.vx = 0;
      if (enemy.modeTicks >= telegraphTicks(Ticks.crawlerWindup, ctx.difficulty)) {
        enemy.chargeU = 0;
        setEnemyMode(enemy, 'attack');
      }
      break;
    case 'attack':
      if (blockedAhead(ctx, enemy) || enemy.chargeU >= C.chargeMaxU) {
        enemy.vx = 0;
        setEnemyMode(enemy, 'recover');
        break;
      }
      enemy.vx = enemy.facing * C.chargeUps;
      break;
    case 'recover':
      enemy.vx = 0;
      if (enemy.modeTicks >= Ticks.crawlerRecover)
        setEnemyMode(enemy, currentTarget(ctx, enemy) ? 'engage' : 'patrol');
      break;
    case 'stunned':
    case 'dead':
      break;
  }
}

function move(ctx: SimContext, enemy: EnemyState): void {
  const size = enemySize(enemy);
  const mx = moveX(ctx.world, enemy.x, enemy.y, enemy.vx * DT, { ledgeForgiveness: false, size });
  if (enemy.mode === 'attack') enemy.chargeU += Math.abs(mx.x - enemy.x);
  enemy.x = mx.x;
  if (mx.blocked) enemy.vx = 0;
  if (enemy.grounded) {
    const s = findSupport(ctx.world, enemy.x, enemy.y, false, size);
    if (s.any) enemy.y = s.y;
    else enemy.grounded = false;
  }
  if (!enemy.grounded) {
    enemy.vy = Math.min(
      enemy.vy + E.gravityUps2 * ctx.planet.gravity * DT,
      GameConfig.player.terminalFallUps,
    );
    const my = moveY(ctx.world, enemy.x, enemy.y, enemy.vy * DT, {
      ignoreOneWay: false,
      cornerCorrection: false,
      preferDir: enemy.facing,
      size,
    });
    enemy.y = my.y;
    if (my.landed) {
      enemy.grounded = true;
      enemy.vy = 0;
    } else if (my.bonked) {
      enemy.vy = 0;
    }
  }
}

/** The charge hurts anyone it touches (difficulty-scaled; invulnerability prevents repeats). */
function contact(ctx: SimContext, enemy: EnemyState): void {
  if (enemy.mode !== 'attack') return;
  const box = enemyBox(enemy);
  for (const p of ctx.state.players) {
    if (!canBeTargeted(p)) continue;
    const h = hurtBox(p);
    if (h.left < box.right && h.right > box.left && h.top < box.bottom && h.bottom > box.top) {
      hurtPlayer(p, C.contactDamage, enemy.x, ctx, ctx.events, ctx.tick);
    }
  }
}

export function stepCrawler(ctx: SimContext, enemy: EnemyState): void {
  think(ctx, enemy);
  move(ctx, enemy);
  contact(ctx, enemy);
}
