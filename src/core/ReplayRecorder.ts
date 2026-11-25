import { CONFIG_HASH, GameConfig } from './GameConfig.ts';
import { sanitizeInputFrame, type InputFrame } from './InputFrame.ts';

export interface ReplayRun {
  readonly count: number;
  readonly inputs: readonly InputFrame[];
}

export interface ReplayData {
  readonly formatVersion: 1;
  readonly seed: number;
  readonly configHash: string;
  readonly playerCount: number;
  readonly runs: readonly ReplayRun[];
  readonly finalStateHash: string;
}

interface MutableReplayRun {
  count: number;
  readonly inputs: readonly InputFrame[];
}

export const MAX_REPLAY_TICKS = 1_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError('Replay seed must be an unsigned 32-bit integer.');
  }
}

function validatePlayerCount(playerCount: number): void {
  if (!Number.isInteger(playerCount) || playerCount < 1 || playerCount > GameConfig.maxPlayers) {
    throw new RangeError(`Replay player count must be between 1 and ${GameConfig.maxPlayers}.`);
  }
}

function sameFrames(left: readonly InputFrame[], right: readonly InputFrame[]): boolean {
  return (
    left.length === right.length &&
    left.every((frame, index) => {
      const other = right[index];
      return (
        other !== undefined &&
        frame.moveX === other.moveX &&
        frame.moveY === other.moveY &&
        frame.held === other.held &&
        frame.aimMrad === other.aimMrad
      );
    })
  );
}

export class ReplayRecorder {
  private readonly runs: MutableReplayRun[] = [];
  private tickCount = 0;
  private isFinished = false;
  private readonly seed: number;
  private readonly playerCount: number;
  private readonly configHash: string;

  constructor(seed: number, playerCount: number, configHash = CONFIG_HASH) {
    validateSeed(seed);
    validatePlayerCount(playerCount);
    if (!/^[a-f0-9]{8}$/.test(configHash)) {
      throw new TypeError('Replay config hash must be an eight-character lowercase hex string.');
    }
    this.seed = seed;
    this.playerCount = playerCount;
    this.configHash = configHash;
  }

  append(inputs: readonly InputFrame[]): void {
    if (this.isFinished) {
      throw new Error('Cannot append input after the replay is finalized.');
    }
    if (this.tickCount >= MAX_REPLAY_TICKS) {
      throw new RangeError(`Replay length cannot exceed ${MAX_REPLAY_TICKS} ticks.`);
    }
    if (inputs.length !== this.playerCount) {
      throw new RangeError('Replay input count must match its player count.');
    }

    const sanitized = inputs.map((input) => sanitizeInputFrame(input));
    const previous = this.runs.at(-1);
    if (previous !== undefined && sameFrames(previous.inputs, sanitized)) {
      previous.count += 1;
    } else {
      this.runs.push({ count: 1, inputs: sanitized });
    }
    this.tickCount += 1;
  }

  finish(finalStateHash: string): ReplayData {
    if (this.isFinished) {
      throw new Error('Replay has already been finalized.');
    }
    if (!/^[a-f0-9]{8}$/.test(finalStateHash)) {
      throw new TypeError('Final state hash must be an eight-character lowercase hex string.');
    }
    this.isFinished = true;
    return {
      formatVersion: 1,
      seed: this.seed,
      configHash: this.configHash,
      playerCount: this.playerCount,
      runs: this.runs.map((run) => ({
        count: run.count,
        inputs: run.inputs.map((frame) => ({ ...frame })),
      })),
      finalStateHash,
    };
  }
}

/** Validates and clamps replay input at the untrusted file boundary. */
export function parseReplayData(input: unknown): ReplayData {
  if (!isRecord(input)) {
    throw new TypeError('Replay file must contain a JSON object.');
  }

  const { formatVersion, seed, configHash, playerCount, runs, finalStateHash } = input;
  if (formatVersion !== 1) {
    throw new RangeError('Unsupported replay format version.');
  }
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    throw new TypeError('Replay seed must be finite.');
  }
  validateSeed(seed);
  if (typeof configHash !== 'string' || !/^[a-f0-9]{8}$/.test(configHash)) {
    throw new TypeError('Replay config hash is invalid.');
  }
  if (typeof playerCount !== 'number' || !Number.isFinite(playerCount)) {
    throw new TypeError('Replay player count must be finite.');
  }
  validatePlayerCount(playerCount);
  if (!Array.isArray(runs)) {
    throw new TypeError('Replay runs must be an array.');
  }
  if (typeof finalStateHash !== 'string' || !/^[a-f0-9]{8}$/.test(finalStateHash)) {
    throw new TypeError('Replay final state hash is invalid.');
  }

  let tickCount = 0;
  const validatedRuns: ReplayRun[] = runs.map((run: unknown) => {
    if (!isRecord(run) || typeof run.count !== 'number' || !Number.isFinite(run.count)) {
      throw new TypeError('Replay runs require a finite count and input list.');
    }
    if (!Number.isInteger(run.count) || run.count < 1) {
      throw new RangeError('Replay run counts must be positive integers.');
    }
    tickCount += run.count;
    if (tickCount > MAX_REPLAY_TICKS) {
      throw new RangeError(`Replay length cannot exceed ${MAX_REPLAY_TICKS} ticks.`);
    }
    if (!Array.isArray(run.inputs) || run.inputs.length !== playerCount) {
      throw new RangeError('Replay input count must match its player count.');
    }
    return {
      count: run.count,
      inputs: run.inputs.map((frame: unknown) => sanitizeInputFrame(frame)),
    };
  });

  return {
    formatVersion: 1,
    seed,
    configHash,
    playerCount,
    runs: validatedRuns,
    finalStateHash,
  };
}
