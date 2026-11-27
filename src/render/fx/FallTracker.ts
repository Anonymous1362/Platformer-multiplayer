import type { SimulationEvent, WorldState } from '../../core/SimulationTypes';

/**
 * Fall heights for landing effects and sounds, measured from each tick's state (render-side, so the
 * simulation needs no extra fields). Call once per tick, after the step, with that tick's events.
 */
export class FallTracker {
  private readonly peakY = new Map<number, number>();

  /** Fall height (u) of every player that landed this tick. */
  onTick(events: readonly SimulationEvent[], world: WorldState): ReadonlyMap<number, number> {
    const landings = new Map<number, number>();
    for (const e of events) {
      if (e.type !== 'landed') continue;
      const p = world.players.find((q) => q.id === e.playerId);
      const peak = this.peakY.get(e.playerId);
      if (p && peak !== undefined) landings.set(e.playerId, Math.max(0, p.y - peak));
    }
    for (const p of world.players) {
      if (p.grounded || p.mode === 'dead' || p.mode === 'hazardRespawn') this.peakY.delete(p.id);
      else this.peakY.set(p.id, Math.min(this.peakY.get(p.id) ?? p.y, p.y));
    }
    return landings;
  }
}
