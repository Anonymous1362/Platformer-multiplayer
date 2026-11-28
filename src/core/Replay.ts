import { CONFIG_HASH, GameConfig } from './GameConfig';
import { isDifficultyId } from './Ids';
import { quantizeAxis, sanitizeAim, sanitizeHeld } from './InputSanitize';
import type { InputFrame } from './InputTypes';
import type { Level } from './level/LevelTypes';
import type { Assists, WorldSetup, WorldState } from './SimulationTypes';
import { hashWorld } from './StateHash';
import { createWorld, WorldSimulation } from './WorldSimulation';

/**
 * Deterministic replays (M1, O1): the setup (seed, level ID, and level hash included), the config hash,
 * every player's inputs run-length encoded as quantized integers, and a state hash every 60 ticks.
 * Replaying on the same level reproduces every checkpoint and the final hash; a mismatch names the
 * first diverging checkpoint. Version 2 replaced the Pass 1B flat floor with levels; version 3 added
 * the checkpoint hashes.
 */
export const REPLAY_FORMAT = 'cosmic-drift-replay';
export const REPLAY_VERSION = 3;
/** A state hash is stored after every this many ticks (O1). */
export const CHECKPOINT_TICKS = 60;

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
  /** State hash after tick 60, 120, ... (one per full 60 ticks). */
  readonly checkpoints: readonly string[];
  readonly finalHash: string;
}

const { axisSteps, heldMask, aimLimitMrad } = GameConfig.input;
const HASH_RE = /^[0-9a-f]{8}$/;
const LEVEL_ID_RE = /^[a-z][a-z0-9_]{0,63}$/;

export class ReplayRecorder {
  private readonly setup: WorldSetup;
  private readonly runs: InputRun[][];
  private readonly checkpoints: string[] = [];
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

  /** Call after each simulated tick: stores the state hash on every 60th tick. */
  afterStep(world: WorldState): void {
    if (
      this.ticks > 0 &&
      this.ticks % CHECKPOINT_TICKS === 0 &&
      this.checkpoints.length < this.ticks / CHECKPOINT_TICKS
    ) {
      this.checkpoints.push(hashWorld(world));
    }
  }

  get length(): number {
    return this.ticks;
  }

  finish(finalHash: string): Replay {
    return {
      format: REPLAY_FORMAT,
      version: REPLAY_VERSION,
      configHash: CONFIG_HASH,
      setup: { ...this.setup },
      ticks: this.ticks,
      inputs: this.runs.map((list) => list.map((run): InputRun => [...run])),
      checkpoints: [...this.checkpoints],
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
    !isDifficultyId(setup['difficulty']) ||
    !isInt(setup['playerCount'], 1, GameConfig.sim.maxPlayers) ||
    typeof setup['levelId'] !== 'string' ||
    !LEVEL_ID_RE.test(setup['levelId']) ||
    typeof setup['levelHash'] !== 'string' ||
    !HASH_RE.test(setup['levelHash'])
  ) {
    return fail('bad setup');
  }
  // Optional (absent in replays made before Pass 2B, which means no assists).
  const rawAssists = setup['assists'];
  let assists: Assists | null = null;
  if (rawAssists !== undefined) {
    if (typeof rawAssists !== 'object' || rawAssists === null) return fail('bad assists');
    const a = rawAssists as Record<string, unknown>;
    if (
      typeof a['invulnerable'] !== 'boolean' ||
      typeof a['infiniteFuel'] !== 'boolean' ||
      typeof a['hazardNoDamage'] !== 'boolean'
    )
      return fail('bad assists');
    assists = {
      invulnerable: a['invulnerable'],
      infiniteFuel: a['infiniteFuel'],
      hazardNoDamage: a['hazardNoDamage'],
    };
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

  const checkpoints = r['checkpoints'];
  if (
    !Array.isArray(checkpoints) ||
    checkpoints.length !== Math.floor(r['ticks'] / CHECKPOINT_TICKS) ||
    !checkpoints.every((h) => typeof h === 'string' && HASH_RE.test(h))
  ) {
    return fail(`checkpoints must hold one hash per ${String(CHECKPOINT_TICKS)} ticks`);
  }

  const replay: Replay = {
    format: REPLAY_FORMAT,
    version: REPLAY_VERSION,
    configHash: r['configHash'],
    setup: {
      seed: setup['seed'],
      difficulty: setup['difficulty'],
      playerCount: setup['playerCount'],
      levelId: setup['levelId'],
      levelHash: setup['levelHash'],
      ...(assists ? { assists } : {}),
    },
    ticks: r['ticks'],
    inputs: (inputs as InputRun[][]).map((list) => list.map((run): InputRun => [...run])),
    checkpoints: checkpoints as string[],
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
  /**
   * The first checkpoint tick whose hash differs (the divergence happened in the 60 ticks before it),
   * the final tick if only the final hash differs, or null when everything matches (O1).
   */
  readonly firstDivergenceTick: number | null;
}

/**
 * Re-simulates a replay headlessly on `level` and compares the final hash. Throws if the level is not
 * the one the replay was recorded on (ID or content hash differ).
 */
export function runReplay(
  replay: Replay,
  level: Level,
  options: { readonly assertFinite?: boolean } = {},
): ReplayResult {
  const world = createWorld(replay.setup, level);
  const sim = new WorldSimulation(level, { assertFinite: options.assertFinite ?? true });
  const streams = replay.inputs.map((runs) => framesFromRuns(runs));
  let firstDivergenceTick: number | null = null;
  for (let tick = 0; tick < replay.ticks; tick += 1) {
    const frames = streams.map((stream) => {
      const next = stream.next();
      if (next.done === true) throw new Error('replay input ended early');
      return next.value;
    });
    sim.step(world, frames, tick);
    const done = tick + 1;
    if (firstDivergenceTick === null && done % CHECKPOINT_TICKS === 0) {
      const expected = replay.checkpoints[done / CHECKPOINT_TICKS - 1];
      if (expected !== undefined && expected !== hashWorld(world)) firstDivergenceTick = done;
    }
  }
  const finalHash = hashWorld(world);
  const hashMatches = finalHash === replay.finalHash;
  if (firstDivergenceTick === null && !hashMatches) firstDivergenceTick = replay.ticks;
  return {
    finalHash,
    ticks: replay.ticks,
    configMatches: replay.configHash === CONFIG_HASH,
    hashMatches,
    firstDivergenceTick,
  };
}
