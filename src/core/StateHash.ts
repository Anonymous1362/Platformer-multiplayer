import { Fnv1a32 } from './Hash';
import { DIFFICULTY_IDS } from './Ids';
import { ENEMY_ARCHETYPES } from './level/LevelTypes';
import { ENEMY_MODES, PLAYER_MODES, type WorldState } from './SimulationTypes';

/** Writes a small signed integer as two's-complement u8 (-1, 0, 1 fields). */
function sign(value: number): number {
  return value & 0xff;
}

/**
 * FNV-1a over a canonical serialization of WorldState: fixed field order, numbers as Float64 bytes
 * (spec section 13.4). Any change to state layout must update this writer and re-record golden replays.
 */
export function hashWorld(state: WorldState): string {
  const h = new Fnv1a32();
  const { setup, entities } = state;

  h.u32(state.tick);
  h.f64(setup.seed).u8(DIFFICULTY_IDS.indexOf(setup.difficulty)).u8(setup.playerCount);
  h.string(setup.levelId).string(setup.levelHash);
  for (const word of state.rng) h.u32(word);

  h.u32(entities.capacity);
  for (const generation of entities.generations) h.u32(generation);
  for (const alive of entities.alive) h.u8(alive ? 1 : 0);
  h.u32(entities.freeList.length);
  for (const index of entities.freeList) h.u32(index);

  h.u32(state.players.length);
  for (const p of state.players) {
    h.f64(p.id).u8(p.slot).f64(p.x).f64(p.y).f64(p.vx).f64(p.vy);
    h.u8(sign(p.facing)).u8(PLAYER_MODES.indexOf(p.mode)).u32(p.modeTicks);
    h.u8(p.grounded ? 1 : 0)
      .u8(sign(p.groundPlatform))
      .u8(p.held)
      .u8(p.prevHeld);
    h.u32(p.airTicks)
      .u8(p.coyoteAvailable ? 1 : 0)
      .u32(p.jumpBufferTicks)
      .u32(p.jumpTicks);
    h.u8(p.jumpCutAvailable ? 1 : 0)
      .u32(p.controlLockTicks)
      .u8(sign(p.wallSide));
    h.f64(p.fuelS).u8(p.jetpacking ? 1 : 0);
    h.u8(sign(p.dashDir))
      .u32(p.dashCooldownTicks)
      .u8(p.airDashUsed ? 1 : 0)
      .u32(p.iframeTicks);
    h.u32(p.dropGraceTicks).f64(p.hp).f64(p.shield).u32(p.invulnTicks).u32(p.ticksSinceHit);
    h.f64(p.safeX).f64(p.safeY).f64(p.pendingSafeX).f64(p.pendingSafeY).f64(p.pendingSafeTick);
    h.u32(p.fireCooldownTicks).f64(p.heat).u32(p.ventTicks);
  }

  h.u32(state.platforms.length);
  for (const p of state.platforms) {
    h.f64(p.x).f64(p.y).f64(p.prevX).f64(p.prevY).u32(p.target).u8(sign(p.dir)).u32(p.waitTicks);
  }

  h.u32(state.enemies.length);
  for (const e of state.enemies) {
    h.f64(e.id).u8(ENEMY_ARCHETYPES.indexOf(e.archetype)).u32(e.spawnIndex);
    h.f64(e.x).f64(e.y).f64(e.vx).f64(e.vy).u8(sign(e.facing)).f64(e.hp).f64(e.maxHp);
    h.u8(ENEMY_MODES.indexOf(e.mode))
      .u32(e.modeTicks)
      .u8(e.grounded ? 1 : 0)
      .u8(e.asleep ? 1 : 0);
    h.u8(sign(e.targetSlot)).u32(e.lostTicks).f64(e.chargeU);
  }

  h.u32(state.projectiles.length);
  for (const b of state.projectiles) {
    h.f64(b.id)
      .f64(b.ownerId)
      .u8(b.team === 'player' ? 0 : 1);
    h.f64(b.x).f64(b.y).f64(b.vx).f64(b.vy).f64(b.damage).f64(b.rangeLeftU);
  }

  h.u32(state.pickups.length);
  for (const k of state.pickups) {
    h.f64(k.id)
      .f64(k.source)
      .f64(k.x)
      .f64(k.y)
      .f64(k.vx)
      .f64(k.vy)
      .u8(k.floating ? 1 : 0);
  }

  const run = state.run;
  h.u32(run.shardsBanked).u32(run.shardsCarried).f64(run.checkpoint).f64(run.respawnX).f64(run.respawnY);
  h.f64(run.completeTick).u32(run.shardStatus.length);
  for (const s of run.shardStatus) h.u8(s);
  h.u32(run.checkpointsReached.length);
  for (const c of run.checkpointsReached) h.u8(c);
  return h.hex();
}
