import { cos, mradToRadians, PI, sin } from '../DMath';
import { DT, GameConfig, Ticks } from '../GameConfig';
import { Button, type InputFrame } from '../InputTypes';
import type { SimContext } from '../SimContext';
import type { PlayerState } from '../SimulationTypes';
import { spawnProjectile } from './Projectiles';
import { lineOfSight } from './Raycast';

/**
 * The Pulse Blaster (spec 4.2 and 4.7): hold Shoot to fire every 200 ms (10 damage, 750 u/s bolts,
 * 4 heat per shot). Heat dissipates at 12/s while firing and 40/s when idle; at 100 the weapon vents
 * for 1.2 s and cannot fire. Aim is manual when the frame carries `AimManual`, otherwise automatic.
 */

const W = GameConfig.weapons.pulse_blaster;
const HEAT = GameConfig.combat.heat;
const AUTO = GameConfig.combat.autoAim;
const MUZZLE = GameConfig.combat.muzzleU;
const COS_CONE = cos((AUTO.coneHalfAngleDeg * PI) / 180);

/** Muzzle position for a shot leaving on side `side` of the body. */
export function muzzle(player: PlayerState, side: 1 | -1): { x: number; y: number } {
  return { x: player.x + side * MUZZLE.forward, y: player.y - MUZZLE.up };
}

/**
 * Auto aim (spec 4.2): the nearest awake enemy inside a 30° half-angle cone in the facing direction,
 * within 900 u and in line of sight; otherwise straight ahead.
 */
export function autoAim(player: PlayerState, ctx: SimContext): { x: number; y: number } {
  const from = muzzle(player, player.facing);
  let best: { x: number; y: number } | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const enemy of ctx.state.enemies) {
    if (enemy.asleep || enemy.mode === 'dead') continue;
    const height = GameConfig.enemies[enemy.archetype].colliderU.height;
    const dx = enemy.x - from.x;
    const dy = enemy.y - height / 2 - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0 || dist > AUTO.rangeU || dx * player.facing < COS_CONE * dist || dist >= bestDist)
      continue;
    if (!lineOfSight(ctx.level, from.x, from.y, from.x + dx, from.y + dy)) continue;
    best = { x: dx / dist, y: dy / dist };
    bestDist = dist;
  }
  return best ?? { x: player.facing, y: 0 };
}

function aimDirection(player: PlayerState, frame: InputFrame, ctx: SimContext): { x: number; y: number } {
  if ((frame.held & Button.AimManual) !== 0) {
    const r = mradToRadians(frame.aimMrad);
    return { x: cos(r), y: sin(r) };
  }
  return autoAim(player, ctx);
}

export function stepWeapon(player: PlayerState, frame: InputFrame, ctx: SimContext): void {
  if (player.mode === 'dead' || player.mode === 'hazardRespawn') return;
  if (player.fireCooldownTicks > 0) player.fireCooldownTicks -= 1;
  if (player.ventTicks > 0) {
    player.ventTicks -= 1;
    player.heat = (HEAT.max * player.ventTicks) / Ticks.vent;
    return;
  }
  const shooting = (player.held & Button.Shoot) !== 0;
  player.heat = Math.max(
    0,
    player.heat - (shooting ? HEAT.dissipateFiringPerS : HEAT.dissipateIdlePerS) * DT,
  );
  if (!shooting || player.fireCooldownTicks > 0) return;

  const dir = aimDirection(player, frame, ctx);
  const side: 1 | -1 = dir.x > 0 ? 1 : dir.x < 0 ? -1 : player.facing;
  const from = muzzle(player, side);
  const fired = spawnProjectile(ctx, {
    ownerId: player.id,
    team: 'player',
    x: from.x,
    y: from.y,
    vx: dir.x * W.speedUps,
    vy: dir.y * W.speedUps,
    damage: W.damage,
    rangeLeftU: GameConfig.combat.projectile.maxRangeU,
  });
  if (!fired) return;
  ctx.events.push({
    type: 'shotFired',
    playerId: player.id,
    tick: ctx.tick,
    x: from.x,
    y: from.y,
    dirX: dir.x,
    dirY: dir.y,
  });
  player.fireCooldownTicks = Ticks.blasterInterval;
  player.heat += W.heatPerShot;
  if (player.heat >= HEAT.max) {
    player.heat = HEAT.max;
    player.ventTicks = Ticks.vent;
    ctx.events.push({ type: 'weaponVented', playerId: player.id, tick: ctx.tick });
  }
}
