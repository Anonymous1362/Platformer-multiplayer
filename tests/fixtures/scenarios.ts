import { Button, type InputFrame } from '../../src/core/InputTypes';
import type { WorldSetup } from '../../src/core/SimulationTypes';

/** Scripted, deterministic input sessions shared by simulation tests, golden replays, and the benchmark. */
export interface Scenario {
  readonly name: string;
  readonly setup: WorldSetup;
  readonly ticks: number;
  input(tick: number, slot: number): InputFrame;
}

const STICK_PATTERN = [1, 0.5, 0, -0.37, -1, 0.83] as const;

/** Runs, stops, turns, and jumps with partial stick values, offset per player so nobody moves in sync. */
export function scriptedInput(tick: number, slot: number): InputFrame {
  const phase = Math.floor((tick + slot * 13) / 90) % STICK_PATTERN.length;
  const moveX = STICK_PATTERN[phase] ?? 0;
  const jumpWindow = (tick + slot * 7) % 70;
  const held = (jumpWindow < 25 ? Button.Jump : 0) | (tick % 45 < 3 ? Button.Shoot : 0);
  return {
    moveX,
    moveY: tick % 200 < 10 ? 0.7 : 0,
    held,
    aimMrad: ((Math.floor(tick / 15) * 557 + slot * 500) % 6284) - 3142,
  };
}

export const SCENARIOS: readonly Scenario[] = [
  {
    name: 'basic_movement_kepler',
    setup: {
      seed: 1234,
      planet: 'kepler',
      difficulty: 'normal',
      playerCount: 2,
      floorY: 1000,
      worldWidth: 4096,
      spawnX: 512,
    },
    ticks: 900,
    input: scriptedInput,
  },
  {
    name: 'four_players_vulcanis_hard',
    setup: {
      seed: 987654,
      planet: 'vulcanis',
      difficulty: 'hard',
      playerCount: 4,
      floorY: 1200,
      worldWidth: 3000,
      spawnX: 200,
    },
    ticks: 1200,
    input: scriptedInput,
  },
];
