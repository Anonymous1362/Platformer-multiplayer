import type { WorldState } from '../../core/SimulationTypes';

/** A body that moved farther than this in one tick teleported (respawn): draw it there, no smear. */
const SNAP_DISTANCE_U = 200;

/** A position for one rendered frame. */
export interface RenderPose {
  readonly x: number;
  readonly y: number;
}

/** Positions at the start of the latest tick, keyed by entity ID (platforms by index). */
export interface PrevPoses {
  readonly entities: ReadonlyMap<number, RenderPose>;
  readonly platforms: readonly RenderPose[];
}

export function capturePoses(world: WorldState): PrevPoses {
  const entities = new Map<number, RenderPose>();
  for (const list of [world.players, world.enemies, world.projectiles, world.pickups]) {
    for (const e of list) entities.set(e.id, { x: e.x, y: e.y });
  }
  return { entities, platforms: world.platforms.map((p) => ({ x: p.x, y: p.y })) };
}

/** Interpolates between the previous and current tick (spec 13.7 step 1); never feeds the simulation. */
export function lerpPose(prev: RenderPose | undefined, next: RenderPose, alpha: number): RenderPose {
  if (!prev || Math.hypot(next.x - prev.x, next.y - prev.y) > SNAP_DISTANCE_U)
    return { x: next.x, y: next.y };
  return { x: prev.x + (next.x - prev.x) * alpha, y: prev.y + (next.y - prev.y) * alpha };
}
