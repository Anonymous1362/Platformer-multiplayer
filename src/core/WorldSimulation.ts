import { allocateEntity, createAllocator } from './EntityIds';
import { assertFiniteState } from './FiniteGuard';
import { DT, GameConfig } from './GameConfig';
import { isDifficultyId, isPlanetId } from './Ids';
import { sanitizeInputFrame } from './InputSanitize';
import { Button, type InputFrame } from './InputTypes';
import { Random } from './Random';
import type {
  PlayerState,
  SimulationEvent,
  SimulationStepResult,
  WorldSetup,
  WorldState,
} from './SimulationTypes';

const P = GameConfig.player;
/** Horizontal spacing between player spawns. */
const SPAWN_SPACING_U = 96;

export interface Simulation {
  step(state: WorldState, inputs: readonly InputFrame[], tick: number): SimulationStepResult;
}

export interface SimulationOptions {
  /** Scan the state for NaN/Infinity after every tick (N11). On in dev builds and tests. */
  readonly assertFinite?: boolean;
}

function validateSetup(setup: WorldSetup): void {
  const ok =
    Number.isInteger(setup.seed) &&
    isPlanetId(setup.planet) &&
    isDifficultyId(setup.difficulty) &&
    Number.isInteger(setup.playerCount) &&
    setup.playerCount >= 1 &&
    setup.playerCount <= GameConfig.sim.maxPlayers &&
    Number.isFinite(setup.floorY) &&
    setup.floorY > 0 &&
    Number.isFinite(setup.worldWidth) &&
    setup.worldWidth > 0 &&
    Number.isFinite(setup.spawnX) &&
    setup.spawnX >= 0 &&
    setup.spawnX + SPAWN_SPACING_U * (setup.playerCount - 1) <= setup.worldWidth;
  if (!ok) throw new RangeError(`invalid world setup: ${JSON.stringify(setup)}`);
}

/** Builds the starting state for a setup. Same setup, same state, always. */
export function createWorld(setup: WorldSetup): WorldState {
  validateSetup(setup);
  const entities = createAllocator(GameConfig.sim.entityCapacity);
  const players: PlayerState[] = [];
  for (let slot = 0; slot < setup.playerCount; slot += 1) {
    const id = allocateEntity(entities);
    if (id === null) throw new Error('entity capacity exhausted while spawning players');
    players.push({
      id,
      slot,
      x: setup.spawnX + SPAWN_SPACING_U * slot,
      y: setup.floorY,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: true,
      held: 0,
      prevHeld: 0,
      airTicks: 0,
    });
  }
  return { tick: 0, setup: { ...setup }, rng: new Random(setup.seed).state(), entities, players };
}

/** Deep copy for snapshots and rollback; the copy evolves independently. */
export function cloneWorld(state: WorldState): WorldState {
  return structuredClone(state);
}

/** Moves `value` toward `target` by at most `maxDelta`. NaN passes through so the N11 assertion sees it. */
export function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  if (value > target) return Math.max(value - maxDelta, target);
  return value;
}

/**
 * Pass 1B skeleton of the per-tick order in spec section 13.4. Implemented phases: inputs and edges,
 * player horizontal control (X), gravity and jumping (Y) against a flat floor. Kinematics, enemies,
 * projectiles, hazards, and modes plug into the same order in later passes.
 */
export class WorldSimulation implements Simulation {
  private readonly assertFinite: boolean;

  constructor(options: SimulationOptions = {}) {
    this.assertFinite = options.assertFinite ?? false;
  }

  step(state: WorldState, inputs: readonly InputFrame[], tick: number): SimulationStepResult {
    if (tick !== state.tick)
      throw new Error(`step(${String(tick)}) called on a world at tick ${String(state.tick)}`);
    if (inputs.length !== state.players.length) {
      throw new RangeError(
        `expected ${String(state.players.length)} input frames, got ${String(inputs.length)}`,
      );
    }
    const events: SimulationEvent[] = [];
    const planet = GameConfig.planets[state.setup.planet];
    const gravityScale = planet.gravity;
    const jumpVelocity = P.jumpVelocityUps * Math.sqrt(gravityScale);

    // 1. Inputs: sanitize at the boundary, then derive edges from held bits (local and remote identical).
    const frames = state.players.map((_, i) => sanitizeInputFrame(inputs[i]));

    // 3. Players, in slot order: integrate and resolve X, then Y.
    state.players.forEach((player, i) => {
      const frame = frames[i] ?? sanitizeInputFrame(undefined);
      player.prevHeld = player.held;
      player.held = frame.held;
      const jumpPressed = (player.held & Button.Jump) !== 0 && (player.prevHeld & Button.Jump) === 0;
      const jumpHeld = (player.held & Button.Jump) !== 0;

      // X: accelerate toward the stick target; brake with the decel rate when slowing or turning.
      const target = frame.moveX * P.maxRunSpeedUps;
      const speedingUp =
        frame.moveX !== 0 &&
        (target > 0 ? player.vx >= 0 && target > player.vx : player.vx <= 0 && target < player.vx);
      const rate = player.grounded
        ? speedingUp
          ? P.groundAccelUps2
          : P.groundDecelUps2
        : speedingUp
          ? P.airAccelUps2
          : P.airDecelUps2 * planet.airDecelFactor;
      player.vx = approach(player.vx, target, rate * DT);
      player.x += player.vx * DT;
      if (player.x < 0 || player.x > state.setup.worldWidth) {
        player.x = Math.min(state.setup.worldWidth, Math.max(0, player.x));
        player.vx = 0;
      }
      if (frame.moveX > 0) player.facing = 1;
      else if (frame.moveX < 0) player.facing = -1;

      // Y: semi-implicit Euler (velocity, then position), which the spec's derived-reach table assumes.
      if (jumpPressed && player.grounded) {
        player.vy = -jumpVelocity;
        player.grounded = false;
        events.push({ type: 'jumped', playerId: player.id, tick });
      }
      if (!player.grounded) {
        const gravity = (player.vy < 0 && jumpHeld ? P.gravityRiseUps2 : P.gravityFallUps2) * gravityScale;
        player.vy = Math.min(player.vy + gravity * DT, P.terminalFallUps);
        player.y += player.vy * DT;
        player.airTicks += 1;
        if (player.y >= state.setup.floorY) {
          player.y = state.setup.floorY;
          player.vy = 0;
          player.grounded = true;
          player.airTicks = 0;
          events.push({ type: 'landed', playerId: player.id, tick });
        }
      }
    });

    state.tick += 1;
    if (this.assertFinite) assertFiniteState(state, tick);
    return { events };
  }
}
