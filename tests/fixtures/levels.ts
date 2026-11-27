import type { DifficultyId, PlanetId } from '../../src/core/Ids';
import { NEUTRAL_INPUT } from '../../src/core/InputSanitize';
import type { InputFrame } from '../../src/core/InputTypes';
import { parseLevel } from '../../src/core/level/AsciiParser';
import type { Level } from '../../src/core/level/LevelTypes';
import type { PlayerState, SimulationEvent, WorldState } from '../../src/core/SimulationTypes';
import { createWorld, setupFor, WorldSimulation } from '../../src/core/WorldSimulation';

/** Builds the raw level JSON for an ASCII map (tests only; content levels live in content/levels). */
export function rawLevel(
  rows: readonly string[],
  options: {
    readonly id?: string;
    readonly planet?: PlanetId;
    readonly spawn?: readonly [number, number];
    readonly objects?: readonly Record<string, unknown>[];
    readonly zones?: readonly Record<string, unknown>[];
  } = {},
): Record<string, unknown> {
  const spawn = options.spawn ?? [1, rows.length - 2];
  return {
    schemaVersion: 1,
    id: options.id ?? 'fixture',
    planet: options.planet ?? 'obsidian',
    nameKey: 'level.fixture.name',
    size: { w: rows[0]?.length ?? 0, h: rows.length },
    musicId: 'mus_fixture',
    rows: [...rows],
    objects: [{ id: 'spawn', type: 'player_spawn', x: spawn[0], y: spawn[1] }, ...(options.objects ?? [])],
    zones: [...(options.zones ?? [])],
    decor: [],
    triggers: [],
  };
}

export function makeLevel(rows: readonly string[], options: Parameters<typeof rawLevel>[1] = {}): Level {
  const parsed = parseLevel(rawLevel(rows, options));
  if (!parsed.ok) throw new Error(`fixture level is invalid:\n${parsed.errors.join('\n')}`);
  return parsed.level;
}

/** A long flat floor: `width` tiles, floor top at row `height - 3` (y = (height - 3) * 64). */
export function flatLevel(planet: PlanetId = 'obsidian', width = 200, height = 16): Level {
  const rows: string[] = [];
  for (let r = 0; r < height; r += 1) rows.push(r >= height - 3 ? '#'.repeat(width) : '.'.repeat(width));
  return makeLevel(rows, { planet, spawn: [2, height - 4] });
}

export const input = (frame: Partial<InputFrame> = {}): InputFrame => ({ ...NEUTRAL_INPUT, ...frame });

/** Drives one world tick by tick and keeps every event, for scripted rule tests. */
export class Harness {
  readonly level: Level;
  readonly world: WorldState;
  readonly sim: WorldSimulation;
  readonly events: SimulationEvent[] = [];

  constructor(level: Level, playerCount = 1, seed = 1, difficulty: DifficultyId = 'normal') {
    this.level = level;
    this.world = createWorld(setupFor(level, { seed, difficulty, playerCount }), level);
    this.sim = new WorldSimulation(level, { assertFinite: true });
  }

  get player(): PlayerState {
    const p = this.world.players[0];
    if (!p) throw new Error('no player');
    return p;
  }

  /** One tick; `frames` is one frame for every player (or one frame shared by all). */
  step(frames: InputFrame | readonly InputFrame[] = NEUTRAL_INPUT): readonly SimulationEvent[] {
    const list = Array.isArray(frames)
      ? (frames as readonly InputFrame[])
      : this.world.players.map(() => frames as InputFrame);
    const { events } = this.sim.step(this.world, list, this.world.tick);
    this.events.push(...events);
    return events;
  }

  /** `n` ticks of the same input. */
  run(n: number, frame: InputFrame = NEUTRAL_INPUT): void {
    for (let i = 0; i < n; i += 1) this.step(frame);
  }

  /** Steps until `predicate` holds (or throws after `limit` ticks); returns the ticks taken. */
  until(
    predicate: (h: Harness) => boolean,
    frame: InputFrame | ((h: Harness) => InputFrame),
    limit = 600,
  ): number {
    for (let i = 0; i < limit; i += 1) {
      if (predicate(this)) return i;
      this.step(typeof frame === 'function' ? frame(this) : frame);
    }
    throw new Error(`condition not reached within ${String(limit)} ticks`);
  }

  /** Teleports a player in mid-air with no velocity; the next tick lands it if its feet touch ground. */
  placePlayer(x: number, y: number, slot = 0): PlayerState {
    const p = this.world.players[slot];
    if (!p) throw new Error('no such player');
    Object.assign(p, {
      x,
      y,
      vx: 0,
      vy: 0,
      mode: 'air',
      grounded: false,
      groundPlatform: -1,
      airTicks: 100,
      coyoteAvailable: false,
      jumpCutAvailable: false,
      jetpacking: false,
    });
    return p;
  }

  /** Teleports a player and settles it on the ground beneath (one tick of falling). */
  standAt(x: number, y: number, slot = 0): PlayerState {
    const p = this.placePlayer(x, y, slot);
    this.step();
    if (!p.grounded) throw new Error(`no ground under (${String(x)}, ${String(y)})`);
    return p;
  }

  eventsOf(type: SimulationEvent['type']): SimulationEvent[] {
    return this.events.filter((e) => e.type === type);
  }
}
