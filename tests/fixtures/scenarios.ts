import type { DifficultyId } from '../../src/core/Ids';
import { Button, type InputFrame } from '../../src/core/InputTypes';
import type { Level } from '../../src/core/level/LevelTypes';
import type { WorldSetup } from '../../src/core/SimulationTypes';

/** Scripted, deterministic input sessions shared by simulation tests, golden replays, and the benchmark. */
export interface Scenario {
  readonly name: string;
  readonly levelId: string;
  readonly seed: number;
  readonly difficulty: DifficultyId;
  readonly playerCount: number;
  readonly ticks: number;
  input(tick: number, slot: number): InputFrame;
}

export function scenarioSetup(scenario: Scenario, level: Level): WorldSetup {
  return {
    seed: scenario.seed,
    difficulty: scenario.difficulty,
    playerCount: scenario.playerCount,
    levelId: level.id,
    levelHash: level.hash,
  };
}

const STICK_PATTERN = [1, 0.5, 0, -0.37, -1, 0.83] as const;

/**
 * Runs, stops, turns, jumps (taps and long holds that reach the jetpack), drops through one-way
 * platforms, and dashes, offset per player so nobody moves in sync.
 */
export function scriptedInput(tick: number, slot: number): InputFrame {
  const phase = Math.floor((tick + slot * 13) / 90) % STICK_PATTERN.length;
  const moveX = STICK_PATTERN[phase] ?? 0;
  const jumpWindow = (tick + slot * 7) % 70;
  const longHold = Math.floor((tick + slot * 7) / 70) % 3 === 2;
  const jump = jumpWindow < (longHold ? 60 : 25) ? Button.Jump : 0;
  const dash = (tick + slot * 11) % 97 < 2 ? Button.Dash : 0;
  const shoot = tick % 45 < 3 ? Button.Shoot : 0;
  return {
    moveX,
    moveY: tick % 200 < 10 ? 0.7 : 0,
    held: jump | dash | shoot,
    aimMrad: ((Math.floor(tick / 15) * 557 + slot * 500) % 6284) - 3142,
  };
}

export const SCENARIOS: readonly Scenario[] = [
  {
    name: 'arena_two_players',
    levelId: 'test_arena',
    seed: 1234,
    difficulty: 'normal',
    playerCount: 2,
    ticks: 900,
    input: scriptedInput,
  },
  {
    name: 'arena_four_players_hard',
    levelId: 'test_arena',
    seed: 987654,
    difficulty: 'hard',
    playerCount: 4,
    ticks: 1200,
    input: scriptedInput,
  },
];
