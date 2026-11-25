import { GameConfig, Ticks } from '../GameConfig';
import { HAZARD_FLAGS, TileFlag, type Level } from '../level/LevelTypes';
import { overlapsSolid, tileFlags, type CollisionWorld, type Support } from '../Collision';
import type { HazardCause, PlayerState, SimulationEvent } from '../SimulationTypes';

/**
 * Hazards, damage, safe ground, and respawn (spec section 4.3). Hazard contact always sends the player
 * back to safe ground; damage is skipped while invulnerable, so a respawn can never chain into a loop.
 */

const TILE = GameConfig.world.tileSizeU;
const H = GameConfig.health;
const HURT = GameConfig.player.hurtboxU;
const CLEARANCE_U = GameConfig.hazard.safeGroundClearanceTiles * TILE;
/** Keeps counters inside the u32 range the state hash writes. */
const COUNTER_CAP = 1_000_000;

interface HurtBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Hurtbox: smaller than the collider and the sprite (M5), bottom-center anchored like the collider. */
export function hurtBox(player: Pick<PlayerState, 'x' | 'y'>): HurtBox {
  return {
    left: player.x - HURT.width / 2,
    top: player.y - HURT.height,
    right: player.x + HURT.width / 2,
    bottom: player.y,
  };
}

function tileHazard(level: Level, box: HurtBox): HazardCause | null {
  const c0 = Math.floor(box.left / TILE);
  const c1 = Math.ceil(box.right / TILE) - 1;
  const r0 = Math.max(0, Math.floor(box.top / TILE));
  const r1 = Math.min(level.heightTiles - 1, Math.ceil(box.bottom / TILE) - 1);
  for (let row = r0; row <= r1; row += 1) {
    for (let col = c0; col <= c1; col += 1) {
      const flags = tileFlags(level, col, row);
      if ((flags & TileFlag.Lava) !== 0) return 'lava';
      if ((flags & TileFlag.Spikes) !== 0) return 'spikes';
    }
  }
  return null;
}

function boxInZone(box: HurtBox, zone: { x: number; y: number; w: number; h: number }): boolean {
  return box.left < zone.x + zone.w && box.right > zone.x && box.top < zone.y + zone.h && box.bottom > zone.y;
}

/** What hurts the player right now, if anything: hazard tiles, kill planes, or falling out of the level. */
export function hazardAt(level: Level, player: PlayerState): HazardCause | null {
  const box = hurtBox(player);
  const tile = tileHazard(level, box);
  if (tile) return tile;
  if (box.top >= level.heightTiles * TILE) return 'pit';
  for (const zone of level.zones) if (zone.type === 'kill_plane' && boxInZone(box, zone)) return 'pit';
  return null;
}

/** Safe ground: static solid ground, no hazard within two tiles, outside `no_safe_ground` zones. */
export function isSafeGround(level: Level, player: PlayerState, support: Support): boolean {
  if (!support.solid || support.platform !== -1) return false;
  const box = hurtBox(player);
  const wide: HurtBox = {
    left: box.left - CLEARANCE_U,
    top: box.top - CLEARANCE_U,
    right: box.right + CLEARANCE_U,
    bottom: box.bottom + CLEARANCE_U,
  };
  const c0 = Math.floor(wide.left / TILE);
  const c1 = Math.ceil(wide.right / TILE) - 1;
  const r0 = Math.max(0, Math.floor(wide.top / TILE));
  const r1 = Math.min(level.heightTiles - 1, Math.ceil(wide.bottom / TILE) - 1);
  for (let row = r0; row <= r1; row += 1) {
    for (let col = c0; col <= c1; col += 1)
      if ((tileFlags(level, col, row) & HAZARD_FLAGS) !== 0) return false;
  }
  for (const zone of level.zones) if (zone.type === 'no_safe_ground' && boxInZone(box, zone)) return false;
  return true;
}

/**
 * Samples safe ground. The respawn point is always a sample at least `safeGroundMinAge` old, so a
 * player who stepped onto ground right before a hazard is not dropped back into the same trap.
 */
export function recordSafeGround(player: PlayerState, tick: number): void {
  if (player.pendingSafeTick < 0) {
    player.pendingSafeX = player.x;
    player.pendingSafeY = player.y;
    player.pendingSafeTick = tick;
  } else if (tick - player.pendingSafeTick >= Ticks.safeGroundMinAge) {
    player.safeX = player.pendingSafeX;
    player.safeY = player.pendingSafeY;
    player.pendingSafeX = player.x;
    player.pendingSafeY = player.y;
    player.pendingSafeTick = tick;
  }
}

/**
 * The newest safe-ground sample that is old enough and free right now (a moving platform may be in
 * the way), falling back to the older sample and finally the level spawn.
 */
function respawnPoint(player: PlayerState, world: CollisionWorld, tick: number): { x: number; y: number } {
  const candidates: { x: number; y: number }[] = [];
  if (player.pendingSafeTick >= 0 && tick - player.pendingSafeTick >= Ticks.safeGroundMinAge)
    candidates.push({ x: player.pendingSafeX, y: player.pendingSafeY });
  candidates.push({ x: player.safeX, y: player.safeY });
  for (const c of candidates) if (!overlapsSolid(world, c.x, c.y)) return c;
  return world.level.spawn;
}

/** Shield first, then HP (spec 4.3). Returns the damage actually dealt. */
export function applyDamage(player: PlayerState, amount: number): number {
  if (amount <= 0 || player.invulnTicks > 0 || player.iframeTicks > 0) return 0;
  const toShield = Math.min(player.shield, amount);
  player.shield -= toShield;
  player.hp = Math.max(0, player.hp - (amount - toShield));
  player.invulnTicks = Ticks.hurtInvuln;
  player.ticksSinceHit = 0;
  return amount;
}

function freeze(player: PlayerState): void {
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.groundPlatform = -1;
  player.jetpacking = false;
  player.wallSide = 0;
  player.jumpBufferTicks = 0;
  player.jumpCutAvailable = false;
  player.modeTicks = 0;
}

/** Hazard contact or a crush: damage (unless invulnerable), then the fade-and-respawn sequence or death. */
export function hitHazard(
  player: PlayerState,
  cause: HazardCause,
  events: SimulationEvent[],
  tick: number,
): void {
  const damage = applyDamage(player, GameConfig.hazard.damage);
  events.push({ type: 'hazardHit', playerId: player.id, tick, cause, damage });
  freeze(player);
  if (player.hp <= 0) {
    player.mode = 'dead';
    events.push({ type: 'died', playerId: player.id, tick });
  } else {
    player.mode = 'hazardRespawn';
  }
}

function placeOnGround(player: PlayerState, x: number, y: number): void {
  player.x = x;
  player.y = y;
  player.vx = 0;
  player.vy = 0;
  player.grounded = true;
  player.groundPlatform = -1;
  player.airTicks = 0;
  player.coyoteAvailable = true;
  player.airDashUsed = false;
  player.dropGraceTicks = 0;
}

/**
 * Advances `hazardRespawn` and `dead`. Hazard respawn: fade out, move to safe ground at the midpoint,
 * fade in, control returns at the end. Death: the sequence, then a full restore at the level spawn
 * (checkpoints replace the spawn in Pass 1E).
 */
export function stepTimedRespawn(
  player: PlayerState,
  world: CollisionWorld,
  events: SimulationEvent[],
  tick: number,
): void {
  const level = world.level;
  player.modeTicks += 1;
  if (player.mode === 'hazardRespawn') {
    if (player.modeTicks === Math.ceil(Ticks.hazardRespawn / 2)) {
      const point = respawnPoint(player, world, tick);
      placeOnGround(player, point.x, point.y);
    }
    if (player.modeTicks >= Ticks.hazardRespawn) {
      player.mode = 'ground';
      player.modeTicks = 0;
      events.push({ type: 'respawned', playerId: player.id, tick });
    }
  } else if (player.mode === 'dead' && player.modeTicks >= Ticks.deathSequence) {
    placeOnGround(player, level.spawn.x, level.spawn.y);
    player.hp = H.baseHp;
    player.shield = H.baseShield;
    player.fuelS = GameConfig.player.jetpack.baseFuelS;
    player.invulnTicks = Ticks.hurtInvuln;
    player.safeX = level.spawn.x;
    player.safeY = level.spawn.y;
    player.pendingSafeTick = -1;
    player.mode = 'ground';
    player.modeTicks = 0;
    events.push({ type: 'respawned', playerId: player.id, tick });
  }
}

/** Shield recharge (spec 4.3): starts `shieldDelay` after the last hit, then `shieldRegenPerS`. */
export function tickHealth(player: PlayerState): void {
  if (player.mode === 'dead') return;
  player.ticksSinceHit = Math.min(COUNTER_CAP, player.ticksSinceHit + 1);
  if (player.ticksSinceHit >= Ticks.shieldDelay && player.shield < H.baseShield) {
    player.shield = Math.min(H.baseShield, player.shield + H.shieldRegenPerS / GameConfig.sim.tickRate);
  }
}
