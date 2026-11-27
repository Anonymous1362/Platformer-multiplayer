import { moveX, moveY, overlapsSolid, PLAYER_SIZE, type CollisionWorld } from './Collision';
import { DT } from './GameConfig';
import type { Level, PlatformDef } from './level/LevelTypes';
import { hitHazard } from './player/Hazards';
import type { SimContext } from './SimContext';
import type { PlatformState, PlayerState } from './SimulationTypes';

/**
 * Kinematic moving platforms (spec sections 4.1 and 13.5). Each tick, before players integrate, a
 * platform advances along its path, carries its riders, and pushes anyone in its way. A body squeezed
 * between a platform and solid geometry takes a hazard respawn (cause `crush`): nothing ever ends up
 * stuck inside geometry.
 */

export function createPlatformStates(level: Level): PlatformState[] {
  return level.platforms.map((def) => {
    const start = def.path[0] ?? { x: 0, y: 0 };
    return { x: start.x, y: start.y, prevX: start.x, prevY: start.y, target: 1, dir: 1, waitTicks: 0 };
  });
}

/** Ping-pong along the path at constant speed, pausing `waitTicks` at each end. */
export function advancePlatform(p: PlatformState, def: PlatformDef): void {
  p.prevX = p.x;
  p.prevY = p.y;
  if (p.waitTicks > 0) {
    p.waitTicks -= 1;
    return;
  }
  const target = def.path[p.target];
  if (!target) return;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const step = def.speedUps * DT;
  if (step < dist) {
    p.x += (dx / dist) * step;
    p.y += (dy / dist) * step;
    return;
  }
  p.x = target.x;
  p.y = target.y;
  let next = p.target + p.dir;
  if (next < 0 || next >= def.path.length) {
    p.dir = p.dir === 1 ? -1 : 1;
    next = p.target + p.dir;
    p.waitTicks = def.waitTicks;
  }
  p.target = next;
}

/** Platform velocity over the last tick, in u/s. */
export function platformVelocity(p: PlatformState): { readonly vx: number; readonly vy: number } {
  return { vx: (p.x - p.prevX) / DT, vy: (p.y - p.prevY) / DT };
}

function isActive(player: PlayerState): boolean {
  return player.mode !== 'hazardRespawn' && player.mode !== 'dead';
}

function overlapsPlatform(player: PlayerState, p: PlatformState, def: PlatformDef): boolean {
  const left = player.x - PLAYER_SIZE.halfW;
  const right = player.x + PLAYER_SIZE.halfW;
  const top = player.y - PLAYER_SIZE.height;
  return left < p.x + def.w && right > p.x && top < p.y + def.h && player.y > p.y;
}

function carryRider(
  world: CollisionWorld,
  player: PlayerState,
  i: number,
  p: PlatformState,
  def: PlatformDef,
): boolean {
  const dx = p.x - p.prevX;
  const dy = p.y - p.prevY;
  if (dx !== 0) {
    const mx = moveX(world, player.x, player.y, dx, { ledgeForgiveness: false, ignorePlatform: i });
    player.x = mx.x;
  }
  const stillOver = player.x + PLAYER_SIZE.halfW > p.x && player.x - PLAYER_SIZE.halfW < p.x + def.w;
  if (dy < 0) {
    const my = moveY(world, player.x, player.y, dy, {
      ignoreOneWay: true,
      cornerCorrection: false,
      preferDir: player.facing,
      ignorePlatform: i,
    });
    if (my.bonked) return false;
    player.y = stillOver ? p.y : my.y;
  } else if (dy > 0) {
    const my = moveY(world, player.x, player.y, dy, {
      ignoreOneWay: false,
      cornerCorrection: false,
      preferDir: player.facing,
      ignorePlatform: i,
    });
    if (my.landed && my.y < p.y) {
      // Static ground stopped the rider on the way down: it stands there now.
      player.y = my.y;
      player.groundPlatform = my.platform;
      return true;
    }
    player.y = stillOver ? p.y : my.y;
  }
  if (!stillOver) player.groundPlatform = -1;
  return true;
}

/** A solid platform moved into a non-rider: lift, push down, or shove sideways; false if squeezed. */
function pushBody(
  world: CollisionWorld,
  player: PlayerState,
  i: number,
  p: PlatformState,
  def: PlatformDef,
): boolean {
  if (player.y <= p.prevY) {
    player.y = p.y;
    player.grounded = true;
    player.groundPlatform = i;
    if (player.vy > 0) player.vy = 0;
  } else if (player.y - PLAYER_SIZE.height >= p.prevY + def.h) {
    const needed = p.y + def.h + PLAYER_SIZE.height - player.y;
    const my = moveY(world, player.x, player.y, needed, {
      ignoreOneWay: false,
      cornerCorrection: false,
      preferDir: player.facing,
      ignorePlatform: i,
    });
    if (my.landed) return false;
    player.y = my.y;
    if (player.vy < 0) player.vy = 0;
  } else {
    const centre = p.prevX + def.w / 2;
    const targetX = player.x < centre ? p.x - PLAYER_SIZE.halfW : p.x + def.w + PLAYER_SIZE.halfW;
    const mx = moveX(world, player.x, player.y, targetX - player.x, {
      ledgeForgiveness: false,
      ignorePlatform: i,
    });
    if (mx.blocked) return false;
    player.x = mx.x;
  }
  return !overlapsSolid(world, player.x, player.y);
}

/** Step 2 of the tick order (spec 13.4): move kinematics and carry their riders. */
export function stepPlatforms(ctx: SimContext): void {
  const { world, events, tick } = ctx;
  const players = ctx.state.players;
  ctx.state.platforms.forEach((p, i) => {
    const def = world.level.platforms[i];
    if (!def) return;
    advancePlatform(p, def);
    if (p.x === p.prevX && p.y === p.prevY) return;
    for (const player of players) {
      if (!isActive(player)) continue;
      let ok: boolean;
      if (player.grounded && player.groundPlatform === i) ok = carryRider(world, player, i, p, def);
      else if (!def.oneWay && overlapsPlatform(player, p, def)) ok = pushBody(world, player, i, p, def);
      else continue;
      if (!ok || overlapsSolid(world, player.x, player.y))
        hitHazard(player, 'crush', ctx.difficulty, events, tick);
    }
  });
}
