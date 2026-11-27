import { findSupport, type CollisionWorld } from './Collision';
import { stepProjectiles } from './combat/Projectiles';
import { stepWeapon } from './combat/Weapons';
import { spawnEnemies, stepEnemies } from './enemies/Enemies';
import { allocateEntity, createAllocator } from './EntityIds';
import { assertFiniteState } from './FiniteGuard';
import { GameConfig } from './GameConfig';
import { isDifficultyId } from './Ids';
import { sanitizeInputFrame } from './InputSanitize';
import type { InputFrame } from './InputTypes';
import type { Level } from './level/LevelTypes';
import { createPlatformStates, stepPlatforms } from './MovingPlatforms';
import { spawnLevelShards, stepPickups } from './pickups/Pickups';
import { hazardAt, hitHazard, isSafeGround, recordSafeGround, tickHealth } from './player/Hazards';
import { applyIntents, createPlayer, movePlayer } from './player/PlayerController';
import { createRun, resetAfterDeath, stepTriggers } from './Progress';
import { Random } from './Random';
import type { PlanetPhysics, SimContext } from './SimContext';
import type {
  PlayerState,
  SimulationEvent,
  SimulationStepResult,
  WorldSetup,
  WorldState,
} from './SimulationTypes';

export { approach } from './player/PlayerController';

export interface Simulation {
  step(state: WorldState, inputs: readonly InputFrame[], tick: number): SimulationStepResult;
}

export interface SimulationOptions {
  /** Scan the state for NaN/Infinity after every tick (N11). On in dev builds and tests. */
  readonly assertFinite?: boolean;
}

const HASH_RE = /^[0-9a-f]{8}$/;

function validateSetup(setup: WorldSetup, level: Level): void {
  const ok =
    Number.isInteger(setup.seed) &&
    isDifficultyId(setup.difficulty) &&
    Number.isInteger(setup.playerCount) &&
    setup.playerCount >= 1 &&
    setup.playerCount <= GameConfig.sim.maxPlayers &&
    typeof setup.levelHash === 'string' &&
    HASH_RE.test(setup.levelHash);
  if (!ok) throw new RangeError(`invalid world setup: ${JSON.stringify(setup)}`);
  if (setup.levelId !== level.id || setup.levelHash !== level.hash) {
    throw new RangeError(
      `setup is for level ${setup.levelId} (${setup.levelHash}) but the loaded level is ${level.id} (${level.hash})`,
    );
  }
}

/** The setup that runs `level` (convenience for callers that start a fresh run). */
export function setupFor(level: Level, options: Omit<WorldSetup, 'levelId' | 'levelHash'>): WorldSetup {
  return { ...options, levelId: level.id, levelHash: level.hash };
}

/** Builds the starting state for a setup on a level. Same setup and level, same state, always. */
export function createWorld(setup: WorldSetup, level: Level): WorldState {
  validateSetup(setup, level);
  const entities = createAllocator(GameConfig.sim.entityCapacity);
  const platforms = createPlatformStates(level);
  const world: CollisionWorld = { level, platforms };
  const players: PlayerState[] = [];
  for (let slot = 0; slot < setup.playerCount; slot += 1) {
    const id = allocateEntity(entities);
    if (id === null) throw new Error('entity capacity exhausted while spawning players');
    players.push(createPlayer(id, slot, world));
  }
  const state: WorldState = {
    tick: 0,
    setup: { ...setup },
    rng: new Random(setup.seed).state(),
    entities,
    players,
    platforms,
    enemies: [],
    projectiles: [],
    pickups: [],
    run: createRun(level),
  };
  // Spawn order is part of determinism: players, then enemies, then level shards.
  spawnEnemies(state, level.enemies, setup.difficulty);
  spawnLevelShards(state, level);
  return state;
}

/** Deep copy for snapshots and rollback; the copy evolves independently. */
export function cloneWorld(state: WorldState): WorldState {
  return structuredClone(state);
}

/**
 * The per-tick order of spec section 13.4: (1) input edges, timers, buffers; (2) moving platforms and
 * their riders; (3) players, X then Y, then their weapons; (4) enemies; (5) projectiles; (6) hazards,
 * safe ground, pickups, and triggers; (7) progression (death resets). Lists iterate by ascending
 * entity ID.
 */
export class WorldSimulation implements Simulation {
  readonly level: Level;
  private readonly assertFinite: boolean;
  private readonly planet: PlanetPhysics;

  constructor(level: Level, options: SimulationOptions = {}) {
    this.level = level;
    this.assertFinite = options.assertFinite ?? false;
    this.planet = GameConfig.planets[level.planet];
  }

  step(state: WorldState, inputs: readonly InputFrame[], tick: number): SimulationStepResult {
    if (tick !== state.tick)
      throw new Error(`step(${String(tick)}) called on a world at tick ${String(state.tick)}`);
    if (inputs.length !== state.players.length) {
      throw new RangeError(
        `expected ${String(state.players.length)} input frames, got ${String(inputs.length)}`,
      );
    }
    if (state.setup.levelHash !== this.level.hash)
      throw new Error(`world is for level ${state.setup.levelId}, not ${this.level.id}`);
    const events: SimulationEvent[] = [];
    const world: CollisionWorld = { level: this.level, platforms: state.platforms };
    const ctx: SimContext = {
      state,
      level: this.level,
      world,
      planet: this.planet,
      difficulty: state.setup.difficulty,
      events,
      tick,
    };

    // 1. Inputs: sanitize at the boundary, derive edges, tick timers.
    const frames = state.players.map((_, i) => sanitizeInputFrame(inputs[i]));
    const frameOf = (i: number): InputFrame => frames[i] ?? sanitizeInputFrame(undefined);
    state.players.forEach((player, i) => {
      applyIntents(player, frameOf(i));
      tickHealth(player);
    });

    // 2. Kinematics carry their riders before anyone integrates.
    stepPlatforms(ctx);

    // 3. Players in slot order: state machine, X, then Y; then weapons fire from the new position.
    state.players.forEach((player, i) => {
      movePlayer(player, frameOf(i), ctx);
      stepWeapon(player, frameOf(i), ctx);
    });

    // 4. Enemies. 5. Projectiles.
    stepEnemies(ctx);
    stepProjectiles(ctx);

    // 6. Hazards, safe ground, pickups, triggers.
    for (const player of state.players) {
      if (player.mode === 'hazardRespawn' || player.mode === 'dead') continue;
      const cause = hazardAt(this.level, player);
      if (cause) {
        hitHazard(player, cause, ctx.difficulty, events, tick);
        continue;
      }
      if (player.grounded) {
        const support = findSupport(world, player.x, player.y, false);
        if (isSafeGround(this.level, player, support)) recordSafeGround(player, tick);
      }
    }
    stepPickups(ctx);
    stepTriggers(ctx);

    // 7. Progression: a death respawn resets the checkpoint section once.
    if (events.some((e) => e.type === 'respawned' && e.fromDeath)) resetAfterDeath(ctx);

    state.tick += 1;
    if (this.assertFinite) assertFiniteState(state, tick);
    return { events };
  }
}
