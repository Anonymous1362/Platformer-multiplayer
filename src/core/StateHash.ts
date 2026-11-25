import { Fnv1a32 } from './Hash';
import { DIFFICULTY_IDS, PLANET_IDS } from './Ids';
import type { WorldState } from './SimulationTypes';

/**
 * FNV-1a over a canonical serialization of WorldState: fixed field order, numbers as Float64 bytes
 * (spec section 13.4). Any change to state layout must update this writer and re-record golden replays.
 */
export function hashWorld(state: WorldState): string {
  const h = new Fnv1a32();
  const { setup, entities } = state;

  h.u32(state.tick);
  h.f64(setup.seed).u8(PLANET_IDS.indexOf(setup.planet)).u8(DIFFICULTY_IDS.indexOf(setup.difficulty));
  h.u8(setup.playerCount).f64(setup.floorY).f64(setup.worldWidth).f64(setup.spawnX);
  for (const word of state.rng) h.u32(word);

  h.u32(entities.capacity);
  for (const generation of entities.generations) h.u32(generation);
  for (const alive of entities.alive) h.u8(alive ? 1 : 0);
  h.u32(entities.freeList.length);
  for (const index of entities.freeList) h.u32(index);

  h.u32(state.players.length);
  for (const p of state.players) {
    h.f64(p.id).u8(p.slot).f64(p.x).f64(p.y).f64(p.vx).f64(p.vy);
    h.u8(p.facing === 1 ? 1 : 0)
      .u8(p.grounded ? 1 : 0)
      .u8(p.held)
      .u8(p.prevHeld)
      .u32(p.airTicks);
  }
  return h.hex();
}
