import { describe, expect, it } from 'vitest';
import { CONFIG_HASH, GameConfig, msToTicks } from '../../src/core/GameConfig';
import { canonicalHash } from '../../src/core/Hash';
import { sanitizeInputFrame } from '../../src/core/InputFrame';
import { hashWorldState } from '../../src/core/StateHash';
import { assertFiniteWorldState, WorldSimulation } from '../../src/core/WorldSimulation';

const neutral = { moveX: 0, moveY: 0, held: 0, aimMrad: 0 } as const;

describe('GameConfig and WorldSimulation', () => {
  it('pins fixed-step and movement timing contracts in the configuration hash', () => {
    expect(GameConfig.simulationHz).toBe(60);
    expect(GameConfig.maxFrameDeltaMs).toBe(100);
    expect(GameConfig.maxStepsPerFrame).toBe(4);
    expect(GameConfig.movement.coyoteTimeTicks).toBe(7);
    expect(GameConfig.movement.jumpBufferTicks).toBe(8);
    expect(GameConfig.movement.dashDurationTicks).toBe(10);
    expect(msToTicks(50)).toBe(3);
    expect(CONFIG_HASH).toBe('774a29ef');
    expect(() => msToTicks(Number.NaN)).toThrow(RangeError);
  });

  it('canonicalizes configuration keys and encodes Unicode as UTF-8', () => {
    expect(canonicalHash({ beta: 2, alpha: 'star ✦' })).toBe(
      canonicalHash({ alpha: 'star ✦', beta: 2 }),
    );
    expect(() => canonicalHash({ invalid: Number.NaN })).toThrow(TypeError);
  });

  it('produces the same final state hash for identical seeds and input sequences', () => {
    const simulation = new WorldSimulation();
    const first = simulation.createState(0x12345678);
    const second = simulation.createState(0x12345678);
    let firstState = first;
    let secondState = second;

    for (let tick = 0; tick < 180; tick += 1) {
      const frame = {
        moveX: tick % 3 === 0 ? 0.75 : -0.25,
        moveY: 0,
        held: tick % 10 < 5 ? 1 : 0,
        aimMrad: tick * 17 - 1500,
      };
      firstState = simulation.step(firstState, [frame]);
      secondState = simulation.step(secondState, [frame]);
    }

    expect(hashWorldState(firstState)).toBe(hashWorldState(secondState));
    expect(hashWorldState(simulation.createState(2))).not.toBe(
      hashWorldState(simulation.createState(1)),
    );
  });

  it('owns and advances its seeded random stream in serializable world state', () => {
    const simulation = new WorldSimulation();
    const initial = simulation.createState(0xabcdef01);
    const firstDraw = simulation.drawRandom(initial);
    const repeatedDraw = simulation.drawRandom(initial);
    expect(firstDraw.value).toBe(repeatedDraw.value);
    expect(hashWorldState(firstDraw.state)).toBe(hashWorldState(repeatedDraw.state));
    expect(hashWorldState(firstDraw.state)).not.toBe(hashWorldState(initial));
    expect(simulation.drawRandom(firstDraw.state).value).not.toBe(firstDraw.value);
  });

  it('includes prior input history in the final state hash', () => {
    const simulation = new WorldSimulation();
    let neutralHistory = simulation.createState(10);
    let changedHistory = simulation.createState(10);

    neutralHistory = simulation.step(neutralHistory, [neutral]);
    changedHistory = simulation.step(changedHistory, [{ ...neutral, moveX: 1 }]);
    neutralHistory = simulation.step(neutralHistory, [neutral]);
    changedHistory = simulation.step(changedHistory, [neutral]);

    expect(neutralHistory.players[0]).toEqual(changedHistory.players[0]);
    expect(hashWorldState(neutralHistory)).not.toBe(hashWorldState(changedHistory));
  });

  it('derives pressed and released edges from held input and rejects skipped ticks', () => {
    const simulation = new WorldSimulation();
    const heldJump = simulation.step(simulation.createState(1), [{ ...neutral, held: 1 }]);
    expect(heldJump.players[0]?.pressed).toBe(1);
    expect(heldJump.players[0]?.released).toBe(0);

    const releasedJump = simulation.step(heldJump, [neutral]);
    expect(releasedJump.players[0]?.pressed).toBe(0);
    expect(releasedJump.players[0]?.released).toBe(1);
    expect(() => simulation.step(releasedJump, [neutral], 4)).toThrow(RangeError);
  });

  it('sanitizes external numbers and rejects non-finite state at the tick boundary', () => {
    expect(
      sanitizeInputFrame({ moveX: Number.POSITIVE_INFINITY, moveY: -3, held: 100, aimMrad: 40000 }),
    ).toEqual({ moveX: 0, moveY: -1, held: 63, aimMrad: 0x7fff });

    const simulation = new WorldSimulation();
    const state = simulation.createState(3);
    const firstPlayer = state.players[0];
    if (firstPlayer === undefined) {
      throw new Error('Expected the initial world to contain one player.');
    }
    const invalidState = {
      ...state,
      players: [{ ...firstPlayer, moveX: Number.NaN }],
    };
    expect(() => assertFiniteWorldState(invalidState)).toThrow(RangeError);
  });

  it('rejects mismatched player input counts and invalid player counts', () => {
    const simulation = new WorldSimulation();
    expect(() => simulation.createState(1, 0)).toThrow(RangeError);
    expect(simulation.createState(-10).seed).toBe(0);
    expect(simulation.createState(Number.MAX_VALUE).seed).toBe(0xffff_ffff);
    expect(() => simulation.step(simulation.createState(1, 2), [neutral])).toThrow(RangeError);
  });
});
