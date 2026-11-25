import { EntityIdPool, type EntityPoolSnapshot } from './EntityIds.ts';
import { GameConfig } from './GameConfig.ts';
import { sanitizeInputFrame, type InputFrame } from './InputFrame.ts';
import { SeededRandom, type RandomState } from './Random.ts';
import { FNV1A_OFFSET_BASIS, updateInputDigest } from './StateHash.ts';

export interface PlayerInputState extends InputFrame {
  readonly pressed: number;
  readonly released: number;
}

/** Minimal deterministic state for the headless simulation milestone. */
export interface WorldState {
  readonly schemaVersion: 1;
  readonly tick: number;
  readonly seed: number;
  readonly inputDigest: number;
  readonly players: readonly PlayerInputState[];
  readonly randomState: RandomState;
  readonly entities: EntityPoolSnapshot;
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    throw new RangeError('World seed must be finite.');
  }
  return Math.trunc(Math.min(0xffff_ffff, Math.max(0, seed))) >>> 0;
}

function validatePlayerCount(playerCount: number): void {
  if (!Number.isInteger(playerCount) || playerCount < 1 || playerCount > GameConfig.maxPlayers) {
    throw new RangeError(`Player count must be between 1 and ${GameConfig.maxPlayers}.`);
  }
}

export function assertFiniteWorldState(state: WorldState): void {
  if (
    state.schemaVersion !== 1 ||
    !Number.isInteger(state.tick) ||
    state.tick < 0 ||
    !Number.isInteger(state.seed) ||
    state.seed < 0 ||
    state.seed > 0xffff_ffff ||
    !Number.isInteger(state.inputDigest) ||
    state.inputDigest < 0 ||
    state.inputDigest > 0xffff_ffff
  ) {
    throw new RangeError('World state header contains an invalid number.');
  }

  validatePlayerCount(state.players.length);
  for (const player of state.players) {
    if (
      !Number.isFinite(player.moveX) ||
      !Number.isFinite(player.moveY) ||
      player.moveX < -1 ||
      player.moveX > 1 ||
      player.moveY < -1 ||
      player.moveY > 1 ||
      !Number.isInteger(player.held) ||
      player.held < 0 ||
      player.held > 0x3f ||
      !Number.isInteger(player.aimMrad) ||
      player.aimMrad < -0x8000 ||
      player.aimMrad > 0x7fff ||
      !Number.isInteger(player.pressed) ||
      player.pressed < 0 ||
      player.pressed > 0x3f ||
      !Number.isInteger(player.released) ||
      player.released < 0 ||
      player.released > 0x3f
    ) {
      throw new RangeError('Player input state contains an invalid number.');
    }
  }

  if (
    state.randomState.length !== 4 ||
    !state.randomState.every(
      (word) => Number.isInteger(word) && word >= 0 && word <= 0xffff_ffff,
    ) ||
    state.randomState.every((word) => word === 0)
  ) {
    throw new RangeError('World random state is invalid.');
  }

  new EntityIdPool(state.entities);
}

/** Deterministic headless skeleton; gameplay rules are introduced in later milestones. */
export interface RandomDraw {
  readonly value: number;
  readonly state: WorldState;
}

export class WorldSimulation {
  createState(seed: number, playerCount = 1): WorldState {
    validatePlayerCount(playerCount);
    const normalizedSeed = normalizeSeed(seed);
    const random = new SeededRandom(normalizedSeed);
    const players: PlayerInputState[] = Array.from({ length: playerCount }, () => ({
      moveX: 0,
      moveY: 0,
      held: 0,
      aimMrad: 0,
      pressed: 0,
      released: 0,
    }));
    const state: WorldState = {
      schemaVersion: 1,
      tick: 0,
      seed: normalizedSeed,
      inputDigest: FNV1A_OFFSET_BASIS,
      players,
      randomState: random.snapshot(),
      entities: new EntityIdPool().snapshot(),
    };
    assertFiniteWorldState(state);
    return state;
  }

  drawRandom(state: WorldState): RandomDraw {
    assertFiniteWorldState(state);
    const random = new SeededRandom(state.seed);
    random.restore(state.randomState);
    const value = random.nextUint32();
    const nextState: WorldState = { ...state, randomState: random.snapshot() };
    assertFiniteWorldState(nextState);
    return { value, state: nextState };
  }

  step(state: WorldState, inputs: readonly InputFrame[], tick = state.tick + 1): WorldState {
    assertFiniteWorldState(state);
    if (!Number.isInteger(tick) || tick !== state.tick + 1) {
      throw new RangeError('Simulation ticks must advance by exactly one.');
    }
    if (inputs.length !== state.players.length) {
      throw new RangeError('Input frame count must match the active player count.');
    }

    const sanitizedInputs = inputs.map((input) => sanitizeInputFrame(input));
    const players = state.players.map((previous, index) => {
      const current = sanitizedInputs[index];
      if (current === undefined) {
        throw new Error('Input frame lookup failed after player-count validation.');
      }
      return {
        ...current,
        pressed: current.held & ~previous.held,
        released: previous.held & ~current.held,
      };
    });
    const nextState: WorldState = {
      ...state,
      tick,
      inputDigest: updateInputDigest(state.inputDigest, sanitizedInputs),
      players,
    };
    assertFiniteWorldState(nextState);
    return nextState;
  }
}
