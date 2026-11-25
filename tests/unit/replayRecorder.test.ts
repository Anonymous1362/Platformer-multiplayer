import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_HASH } from '../../src/core/GameConfig';
import { ReplayRecorder, parseReplayData } from '../../src/core/ReplayRecorder';
import { hashWorldState } from '../../src/core/StateHash';
import { WorldSimulation } from '../../src/core/WorldSimulation';

const idle = { moveX: 0, moveY: 0, held: 0, aimMrad: 0 } as const;
const moving = { moveX: 1, moveY: -0.5, held: 3, aimMrad: 1200 } as const;

describe('ReplayRecorder', () => {
  it('run-length encodes identical input frames and verifies the replay in the CLI', () => {
    const simulation = new WorldSimulation();
    let state = simulation.createState(0x10203040);
    const recorder = new ReplayRecorder(state.seed, 1);
    const frames = [idle, idle, moving, moving, idle] as const;

    for (const frame of frames) {
      recorder.append([frame]);
      state = simulation.step(state, [frame]);
    }

    const replay = recorder.finish(hashWorldState(state));
    expect(replay.configHash).toBe(CONFIG_HASH);
    expect(replay.runs.map((run) => run.count)).toEqual([2, 2, 1]);
    expect(parseReplayData(replay)).toEqual(replay);
    expect(() => recorder.append([idle])).toThrow(/finalized/);

    const directory = mkdtempSync(join(tmpdir(), 'cosmic-drift-replay-'));
    const replayPath = join(directory, 'test-replay.json');
    try {
      writeFileSync(replayPath, JSON.stringify(replay), 'utf8');
      const result = execFileSync(process.execPath, ['tools/replay-run.ts', replayPath], {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 15_000,
      });
      expect(result).toContain(`tick=${frames.length}`);
      expect(result).toContain(`state=${replay.finalStateHash}`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects malformed run lengths, mismatched player frames, and oversized files', () => {
    const recorder = new ReplayRecorder(5, 1);
    recorder.append([idle]);
    const replay = recorder.finish('00000000');

    expect(() => parseReplayData({ ...replay, runs: [{ count: 0, inputs: [idle] }] })).toThrow(
      /positive integers/,
    );
    expect(() =>
      parseReplayData({ ...replay, runs: [{ count: 1, inputs: [idle, idle] }] }),
    ).toThrow(/match its player count/);
    expect(() =>
      parseReplayData({
        ...replay,
        runs: [{ count: 1_000_001, inputs: [idle] }],
      }),
    ).toThrow(/cannot exceed/);
  });

  it('requires a runtime config match when replaying', () => {
    const replay = {
      formatVersion: 1,
      seed: 1,
      configHash: '00000000',
      playerCount: 1,
      runs: [],
      finalStateHash: hashWorldState(new WorldSimulation().createState(1)),
    };
    const directory = mkdtempSync(join(tmpdir(), 'cosmic-drift-replay-'));
    const replayPath = join(directory, 'wrong-config.json');
    try {
      writeFileSync(replayPath, JSON.stringify(replay), 'utf8');
      const result = spawnSync(process.execPath, ['tools/replay-run.ts', replayPath], {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 15_000,
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Replay config mismatch');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
