import { Fnv1a32 } from './Hash';
import { DIFFICULTY_IDS } from './Ids';
import { PLAYER_MODES, type WorldState } from './SimulationTypes';

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
      .u32(p.wallJumpLockTicks)
      .u8(sign(p.wallSide));
    h.f64(p.fuelS).u8(p.jetpacking ? 1 : 0);
    h.u8(sign(p.dashDir))
      .u32(p.dashCooldownTicks)
      .u8(p.airDashUsed ? 1 : 0)
      .u32(p.iframeTicks);
    h.u32(p.dropGraceTicks).f64(p.hp).f64(p.shield).u32(p.invulnTicks).u32(p.ticksSinceHit);
    h.f64(p.safeX).f64(p.safeY).f64(p.pendingSafeX).f64(p.pendingSafeY).f64(p.pendingSafeTick);
  }

  h.u32(state.platforms.length);
  for (const p of state.platforms) {
    h.f64(p.x).f64(p.y).f64(p.prevX).f64(p.prevY).u32(p.target).u8(sign(p.dir)).u32(p.waitTicks);
  }
  return h.hex();
}
