import { CONFIG_HASH, GameConfig } from './GameConfig';
import { isDifficultyId, isPlanetId } from './Ids';
import { quantizeAxis, sanitizeAim, sanitizeHeld } from './InputSanitize';
import type { InputFrame } from './InputTypes';
import type { WorldSetup } from './SimulationTypes';
import { hashWorld } from './StateHash';
import { createWorld, WorldSimulation } from './WorldSimulation';

/**
 * Deterministic replays (M1): the setup (seed included), the config hash, and every player's inputs
 * run-length encoded as quantized integers. Replaying reproduces the final state hash.
 */
export const REPLAY_FORMAT = 'cosmic-drift-replay';
export const REPLAY_VERSION = 1;

/** `[count, moveX (-127..127), moveY (-127..127), held (0..63), aimMrad]` repeated `count` ticks. */
export type InputRun = [number, number, number, number, number];

export interface Replay {
  readonly format: typeof REPLAY_FORMAT;
  readonly version: typeof REPLAY_VERSION;
  readonly configHash: string;
  readonly setup: WorldSetup;
  readonly ticks: number;
  /** One run list per player, in slot order. */
  readonly inputs: readonly (readonly InputRun[])[];
  readonly finalHash: string;
}

const { axisSteps, heldMask, aimLimitMrad } = GameConfig.input;
const HASH_RE = /^[0-9a-f]{8}$/;

export class ReplayRecorder {
  private readonly setup: WorldSetup;
  private readonly runs: InputRun[][];
  private ticks = 0;

  constructor(setup: WorldSetup) {
    this.setup = { ...setup };
    this.runs = Array.from({ length: setup.playerCount }, () => []);
  }

  /** Records one tick: one frame per player, in slot order. */
  record(frames: readonly InputFrame[]): void {
    if (frames.length !== this.runs.length) throw new RangeError('one frame per player is required');
    frames.forEach((frame, slot) => {
      const q: InputRun = [
        1,
        quantizeAxis(frame.moveX),
        quantizeAxis(frame.moveY),
        sanitizeHeld(frame.held),
        sanitizeAim(frame.aimMrad),
      ];
      const list = this.runs[slot];
      if (!list) return;
      const last = list[list.length - 1];
      if (last && last[1] === q[1] && last[2] === q[2] && last[3] === q[3] && last[4] === q[4]) last[0] += 1;
      else list.push(q);
    });
    this.ticks += 1;
  }

  finish(finalHash: string): Replay {
    return {
      format: REPLAY_FORMAT,
      version: REPLAY_VERSION,
      configHash: CONFIG_HASH,
      setup: { ...this.setup },
      ticks: this.ticks,
      inputs: this.runs.map((list) => list.map((run): InputRun => [...run])),
      finalHash,
    };
  }
}

/** Expands one player's runs into frames, one per tick. */
export function* framesFromRuns(runs: readonly InputRun[]): Generator<InputFrame> {
  for (const [count, mx, my, held, aim] of runs) {
    const frame: InputFrame = { moveX: mx / axisSteps, moveY: my / axisSteps, held, aimMrad: aim };
    for (let i = 0; i < count; i += 1) yield frame;
  }
}

export type ReplayValidation =
  { readonly ok: true; readonly replay: Replay } | { readonly ok: false; readonly error: string };

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Boundary check for replays from files or the network (N11). Never throws. */
export function validateReplay(raw: unknown): ReplayValidation {
  const fail = (error: string): ReplayValidation => ({ ok: false, error });
  if (typeof raw !== 'object' || raw === null) return fail('not an object');
  const r = raw as Record<string, unknown>;
  if (r['format'] !== REPLAY_FORMAT) return fail('wrong format');
  if (r['version'] !== REPLAY_VERSION) return fail(`unsupported version ${String(r['version'])}`);
  if (typeof r['configHash'] !== 'string' || !HASH_RE.test(r['configHash'])) return fail('bad configHash');
  if (typeof r['finalHash'] !== 'string' || !HASH_RE.test(r['finalHash'])) return fail('bad finalHash');
  if (!isInt(r['ticks'], 0, 60 * 60 * 60 * 4)) return fail('bad ticks');

  const s = r['setup'];
  if (typeof s !== 'object' || s === null) return fail('missing setup');
  const setup = s as Record<string, unknown>;
  if (
    !isInt(setup['seed'], -2147483648, 4294967295) ||
    !isPlanetId(setup['planet']) ||
    !isDifficultyId(setup['difficulty']) ||
    !isInt(setup['playerCount'], 1, GameConfig.sim.maxPlayers) ||
    !isFiniteNumber(setup['floorY']) ||
    !isFiniteNumber(setup['worldWidth']) ||
    !isFiniteNumber(setup['spawnX'])
  ) {
    return fail('bad setup');
  }

  const inputs = r['inputs'];
  if (!Array.isArray(inputs) || inputs.length !== setup['playerCount'])
    return fail('inputs must have one list per player');
  for (const list of inputs as unknown[]) {
    if (!Array.isArray(list)) return fail('input list is not an array');
    let total = 0;
    for (const run of list as unknown[]) {
      if (!Array.isArray(run) || run.length !== 5) return fail('input run must have 5 numbers');
      const [count, mx, my, held, aim] = run as unknown[];
      if (
        !isInt(count, 1, Number.MAX_SAFE_INTEGER) ||
        !isInt(mx, -axisSteps, axisSteps) ||
        !isInt(my, -axisSteps, axisSteps) ||
        !isInt(held, 0, heldMask) ||
        !isInt(aim, -aimLimitMrad, aimLimitMrad)
      ) {
        return fail('input run out of range');
      }
      total += count;
    }
    if (total !== r['ticks']) return fail('input runs do not add up to ticks');
  }

  const replay: Replay = {
    format: REPLAY_FORMAT,
    version: REPLAY_VERSION,
    configHash: r['configHash'],
    setup: {
      seed: setup['seed'],
      planet: setup['planet'],
      difficulty: setup['difficulty'],
      playerCount: setup['playerCount'],
      floorY: setup['floorY'],
      worldWidth: setup['worldWidth'],
      spawnX: setup['spawnX'],
    },
    ticks: r['ticks'],
    inputs: (inputs as InputRun[][]).map((list) => list.map((run): InputRun => [...run])),
    finalHash: r['finalHash'],
  };
  return { ok: true, replay };
}

export interface ReplayResult {
  readonly finalHash: string;
  readonly ticks: number;
  /** The replay was recorded with the same GameConfig as this build. */
  readonly configMatches: boolean;
  readonly hashMatches: boolean;
}

/** Re-simulates a replay headlessly and compares the final hash. */
export function runReplay(replay: Replay, options: { readonly assertFinite?: boolean } = {}): ReplayResult {
  const world = createWorld(replay.setup);
  const sim = new WorldSimulation({ assertFinite: options.assertFinite ?? true });
  const streams = replay.inputs.map((runs) => framesFromRuns(runs));
  for (let tick = 0; tick < replay.ticks; tick += 1) {
    const frames = streams.map((stream) => {
      const next = stream.next();
      if (next.done === true) throw new Error('replay input ended early');
      return next.value;
    });
    sim.step(world, frames, tick);
  }
  const finalHash = hashWorld(world);
  return {
    finalHash,
    ticks: replay.ticks,
    configMatches: replay.configHash === CONFIG_HASH,
    hashMatches: finalHash === replay.finalHash,
  };
}
