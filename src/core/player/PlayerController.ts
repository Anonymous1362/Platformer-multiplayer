import { findSupport, moveX, moveY, wallContact, type CollisionWorld, type Support } from '../Collision';
import type { EntityId } from '../EntityIds';
import { DT, GameConfig, Ticks } from '../GameConfig';
import { Button, type InputFrame } from '../InputTypes';
import { platformVelocity } from '../MovingPlatforms';
import type { PlayerState, SimulationEvent } from '../SimulationTypes';
import { stepTimedRespawn } from './Hazards';

/**
 * The player state machine and movement rules of spec section 4.1. Per tick: `applyIntents` (edges,
 * timers, jump buffer) runs before kinematics; `movePlayer` runs after them and integrates X, then Y
 * (N1). Velocity is integrated before position (semi-implicit Euler), which the derived-reach table
 * in spec 4.1 assumes.
 */

const P = GameConfig.player;
const FUEL_EPS = 1e-9;

export interface PlanetPhysics {
  readonly gravity: number;
  readonly airDecelFactor: number;
}

export interface PlayerContext {
  readonly world: CollisionWorld;
  readonly planet: PlanetPhysics;
  readonly events: SimulationEvent[];
  readonly tick: number;
}

export function createPlayer(id: EntityId, slot: number, world: CollisionWorld): PlayerState {
  const { x, y } = world.level.spawn;
  const support = findSupport(world, x, y, false);
  return {
    id,
    slot,
    x,
    y: support.any ? support.y : y,
    vx: 0,
    vy: 0,
    facing: 1,
    mode: support.any ? 'ground' : 'air',
    modeTicks: 0,
    grounded: support.any,
    groundPlatform: support.platform,
    held: 0,
    prevHeld: 0,
    airTicks: 0,
    coyoteAvailable: support.any,
    jumpBufferTicks: 0,
    jumpTicks: 0,
    jumpCutAvailable: false,
    wallJumpLockTicks: 0,
    wallSide: 0,
    fuelS: P.jetpack.baseFuelS,
    jetpacking: false,
    dashDir: 1,
    dashCooldownTicks: 0,
    airDashUsed: false,
    iframeTicks: 0,
    dropGraceTicks: 0,
    hp: GameConfig.health.baseHp,
    shield: GameConfig.health.baseShield,
    invulnTicks: 0,
    ticksSinceHit: Ticks.shieldDelay,
    safeX: x,
    safeY: y,
    pendingSafeX: x,
    pendingSafeY: y,
    pendingSafeTick: -1,
  };
}

function isPressed(player: PlayerState, button: number): boolean {
  return (player.held & button) !== 0 && (player.prevHeld & button) === 0;
}

/** Step 1 of the tick order: input edges, timers, and the jump buffer. */
export function applyIntents(player: PlayerState, frame: InputFrame): void {
  player.prevHeld = player.held;
  player.held = frame.held;
  if (player.dashCooldownTicks > 0) player.dashCooldownTicks -= 1;
  if (player.iframeTicks > 0) player.iframeTicks -= 1;
  if (player.invulnTicks > 0) player.invulnTicks -= 1;
  if (player.wallJumpLockTicks > 0) player.wallJumpLockTicks -= 1;
  if (player.dropGraceTicks > 0) player.dropGraceTicks -= 1;
  if (isPressed(player, Button.Jump)) player.jumpBufferTicks = Ticks.jumpBuffer;
  else if (player.jumpBufferTicks > 0) player.jumpBufferTicks -= 1;
}

function stickSign(value: number): -1 | 0 | 1 {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

function land(player: PlayerState, y: number, platform: number, ctx: PlayerContext): void {
  const wasAirborne = !player.grounded;
  player.y = y;
  player.vy = 0;
  player.grounded = true;
  player.groundPlatform = platform;
  player.airTicks = 0;
  player.coyoteAvailable = true;
  player.airDashUsed = false;
  player.jetpacking = false;
  player.jumpCutAvailable = false;
  if (wasAirborne) ctx.events.push({ type: 'landed', playerId: player.id, tick: ctx.tick });
}

function leaveGround(player: PlayerState, coyote: boolean): void {
  player.grounded = false;
  player.groundPlatform = -1;
  player.airTicks = 0;
  player.coyoteAvailable = coyote;
}

function groundJump(player: PlayerState, ctx: PlayerContext): void {
  let inheritX = 0;
  let inheritY = 0;
  const platform = player.grounded ? ctx.world.platforms[player.groundPlatform] : undefined;
  if (platform) {
    // Jumping inherits the platform's velocity, capped at 300 u/s (spec 4.1).
    const v = platformVelocity(platform);
    const speed = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
    const scale = speed > P.platformInheritCapUps ? P.platformInheritCapUps / speed : 1;
    inheritX = v.vx * scale;
    inheritY = v.vy * scale;
  }
  const fromGround = player.grounded;
  const airTicks = player.airTicks;
  leaveGround(player, false);
  if (!fromGround) player.airTicks = airTicks; // a coyote jump keeps counting air time
  player.vx += inheritX;
  player.vy = -P.jumpVelocityUps * Math.sqrt(ctx.planet.gravity) + inheritY;
  player.jumpBufferTicks = 0;
  player.jumpTicks = 0;
  player.jumpCutAvailable = true;
  ctx.events.push({ type: 'jumped', playerId: player.id, tick: ctx.tick });
}

function wallJump(player: PlayerState, side: -1 | 1, ctx: PlayerContext): void {
  player.vx = -side * P.wallJump.vxUps;
  // Scaled like the jump so wall-jump height matches on every planet (DECISIONS).
  player.vy = P.wallJump.vyUps * Math.sqrt(ctx.planet.gravity);
  player.facing = side === 1 ? -1 : 1;
  player.wallJumpLockTicks = Ticks.wallJumpLock;
  player.jumpBufferTicks = 0;
  player.jumpTicks = 0;
  player.jumpCutAvailable = true;
  player.jetpacking = false;
  player.coyoteAvailable = false;
  ctx.events.push({ type: 'wallJumped', playerId: player.id, tick: ctx.tick });
}

function startDash(player: PlayerState, frame: InputFrame, ctx: PlayerContext): void {
  const stick = stickSign(frame.moveX);
  // Off a wall slide the dash always goes away from the wall.
  const dir: 1 | -1 =
    player.mode === 'wallSlide' && player.wallSide !== 0
      ? player.wallSide === 1
        ? -1
        : 1
      : stick !== 0
        ? stick
        : player.facing;
  player.mode = 'dash';
  player.modeTicks = 0;
  player.dashDir = dir;
  player.facing = dir;
  player.vy = 0;
  player.iframeTicks = Ticks.dashIframes;
  if (!player.grounded) player.airDashUsed = true;
  player.jetpacking = false;
  player.jumpCutAvailable = false;
  player.wallSide = 0;
  ctx.events.push({ type: 'dashed', playerId: player.id, tick: ctx.tick });
}

/** 1100 u/s for 10 ticks with no gravity, then out at max run speed (spec 4.1). A wall ends it early. */
function stepDash(player: PlayerState, ctx: PlayerContext): void {
  player.modeTicks += 1;
  player.vx = player.dashDir * P.dash.speedUps;
  player.vy = 0;
  const mx = moveX(ctx.world, player.x, player.y, player.vx * DT, { ledgeForgiveness: true });
  player.x = mx.x;
  player.y = mx.y;
  const support = findSupport(ctx.world, player.x, player.y, player.dropGraceTicks > 0);
  if (support.any) {
    if (!player.grounded) land(player, support.y, support.platform, ctx);
    else {
      player.y = support.y;
      player.groundPlatform = support.platform;
    }
  } else if (player.grounded) {
    leaveGround(player, false);
  } else {
    player.airTicks += 1;
  }
  if (mx.blocked || player.modeTicks >= Ticks.dash) {
    player.vx = mx.blocked ? 0 : player.dashDir * P.maxRunSpeedUps;
    player.dashCooldownTicks = Ticks.dashCooldown;
    player.mode = player.grounded ? 'ground' : 'air';
    player.modeTicks = 0;
  }
}

function horizontalControl(
  player: PlayerState,
  frame: InputFrame,
  support: Support | null,
  ctx: PlayerContext,
): void {
  if (player.wallJumpLockTicks > 0) return; // horizontal input ignored after a wall jump (spec 4.1)
  const target = frame.moveX * P.maxRunSpeedUps;
  const speedingUp =
    frame.moveX !== 0 &&
    (target > 0 ? player.vx >= 0 && target > player.vx : player.vx <= 0 && target < player.vx);
  let rate: number;
  if (player.grounded) {
    const ice = support?.ice === true ? GameConfig.environment.ice : null;
    rate = speedingUp
      ? P.groundAccelUps2 * (ice?.accelFactor ?? 1)
      : P.groundDecelUps2 * (ice?.decelFactor ?? 1);
  } else {
    rate = speedingUp ? P.airAccelUps2 : P.airDecelUps2 * ctx.planet.airDecelFactor;
  }
  player.vx = approach(player.vx, target, rate * DT);
  const dir = stickSign(frame.moveX);
  if (dir !== 0) player.facing = dir;
}

/** Moves `value` toward `target` by at most `maxDelta`. NaN passes through so the N11 assertion sees it. */
export function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  if (value > target) return Math.max(value - maxDelta, target);
  return value;
}

/** Step 3 of the tick order: the state machine, then X, then Y. */
export function movePlayer(player: PlayerState, frame: InputFrame, ctx: PlayerContext): void {
  if (player.mode === 'hazardRespawn' || player.mode === 'dead') {
    stepTimedRespawn(player, ctx.world, ctx.events, ctx.tick);
    return;
  }

  const world = ctx.world;
  const jumpHeld = (player.held & Button.Jump) !== 0;
  const down = frame.moveY >= GameConfig.input.downThreshold;

  if (
    player.mode !== 'dash' &&
    isPressed(player, Button.Dash) &&
    player.dashCooldownTicks === 0 &&
    (player.grounded || !player.airDashUsed)
  ) {
    startDash(player, frame, ctx);
  }
  if (player.mode === 'dash') {
    stepDash(player, ctx);
    return;
  }

  const support = player.grounded ? findSupport(world, player.x, player.y, player.dropGraceTicks > 0) : null;

  // Jumps: drop-through, then ground or coyote jump, then wall jump (buffered presses count).
  if (player.grounded && down && isPressed(player, Button.Jump) && support?.any === true && !support.solid) {
    leaveGround(player, false);
    player.dropGraceTicks = Ticks.dropThroughGrace;
    player.jumpBufferTicks = 0;
    ctx.events.push({ type: 'droppedThrough', playerId: player.id, tick: ctx.tick });
  } else if (player.jumpBufferTicks > 0) {
    if (player.grounded || (player.coyoteAvailable && player.airTicks <= Ticks.coyote)) {
      groundJump(player, ctx);
    } else {
      const wall = wallContact(world, player.x, player.y, P.wallJump.contactProbeU);
      const side: -1 | 0 | 1 = wall.left && wall.right ? player.facing : wall.right ? 1 : wall.left ? -1 : 0;
      if (side !== 0) wallJump(player, side, ctx);
    }
  }

  // Variable jump: one cut on release while rising, after the minimum hold.
  if (player.jumpCutAvailable) {
    if (player.vy >= 0) player.jumpCutAvailable = false;
    else if (!jumpHeld && player.jumpTicks >= Ticks.jumpCutMinHold) {
      player.vy *= P.jumpCutFactor;
      player.jumpCutAvailable = false;
    }
  }

  // X: control, integrate, resolve (with ledge forgiveness).
  horizontalControl(player, frame, support, ctx);
  const mx = moveX(world, player.x, player.y, player.vx * DT, { ledgeForgiveness: true });
  player.x = mx.x;
  player.y = mx.y;
  if (mx.blocked) player.vx = 0;

  // Y: ground check (walking off starts coyote time), jetpack or gravity, wall slide, resolve.
  if (player.grounded) {
    const s = findSupport(world, player.x, player.y, player.dropGraceTicks > 0);
    if (s.any) {
      player.y = s.y;
      player.groundPlatform = s.platform;
    } else {
      leaveGround(player, true);
    }
  }
  let sliding = false;
  if (!player.grounded) {
    const thrust =
      jumpHeld &&
      player.airTicks > Ticks.coyote &&
      player.fuelS > FUEL_EPS &&
      (player.jetpacking || player.vy >= 0);
    if (thrust) {
      // Jetpack: vy moves toward -140 u/s at 2400 u/s², replacing gravity (spec 4.1).
      player.jetpacking = true;
      if (player.vy > P.jetpack.targetVyUps)
        player.vy = Math.max(P.jetpack.targetVyUps, player.vy - P.jetpack.accelUps2 * DT);
      player.fuelS -= P.jetpack.drainPerS * DT;
      if (player.fuelS <= FUEL_EPS) player.fuelS = 0;
    } else {
      player.jetpacking = false;
      // Rising gravity while moving up, falling gravity otherwise; releasing Jump early is handled by
      // the jump cut above, never by extra gravity (that is what lets a tap clear one tile, spec 4.1).
      const g = (player.vy < 0 ? P.gravityRiseUps2 : P.gravityFallUps2) * ctx.planet.gravity;
      player.vy = Math.min(player.vy + g * DT, P.terminalFallUps);
      const press = stickSign(frame.moveX);
      if (press !== 0 && player.vy > 0) {
        const wall = wallContact(world, player.x, player.y, P.wallSlideProbeU);
        sliding = press === 1 ? wall.right : wall.left;
        if (sliding) player.vy = Math.min(player.vy, P.wallSlideMaxFallUps);
      }
      player.wallSide = sliding ? press : 0;
    }
    const my = moveY(world, player.x, player.y, player.vy * DT, {
      ignoreOneWay: player.dropGraceTicks > 0,
      cornerCorrection: player.vy < 0,
      preferDir: player.facing,
    });
    player.x = my.x;
    if (my.landed) {
      sliding = false;
      player.wallSide = 0;
      land(player, my.y, my.platform, ctx);
    } else {
      player.y = my.y;
      if (my.bonked) {
        player.vy = 0;
        player.jumpCutAvailable = false;
      }
      player.airTicks += 1;
      player.jumpTicks += 1;
    }
  } else {
    player.wallSide = 0;
  }

  if (sliding) player.airDashUsed = false; // wall slide refreshes the air dash
  if ((player.grounded || sliding) && !player.jetpacking)
    player.fuelS = Math.min(P.jetpack.baseFuelS, player.fuelS + P.jetpack.rechargePerS * DT);
  player.mode = player.grounded ? 'ground' : sliding ? 'wallSlide' : 'air';
}
