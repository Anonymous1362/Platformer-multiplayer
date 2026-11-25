import { describe, expect, it } from 'vitest';
import { FixedLoop, MAX_STEPS_PER_FRAME } from '../../src/core/FixedLoop';
import type { InputFrame } from '../../src/core/InputTypes';
import type { WorldSetup } from '../../src/core/SimulationTypes';
import { hashWorld } from '../../src/core/StateHash';
import { createWorld, WorldSimulation } from '../../src/core/WorldSimulation';
import { scriptedInput } from '../fixtures/scenarios';

const RUN_RIGHT: InputFrame = { moveX: 1, moveY: 0, held: 0, aimMrad: 0 };
/** Max run speed at 60 Hz covers 7 u per tick. */
const MAX_U_PER_TICK = 7;
const SETUP: WorldSetup = {
  seed: 3,
  planet: 'obsidian',
  difficulty: 'normal',
  playerCount: 1,
  floorY: 800,
  worldWidth: 100000,
  spawnX: 50,
};

function setup() {
  const world = createWorld(SETUP);
  const sim = new WorldSimulation({ assertFinite: true });
  const loop = new FixedLoop();
  const frame = (deltaS: number) =>
    loop.advance(deltaS, (tick) => {
      sim.step(world, [RUN_RIGHT], tick);
    });
  return { world, loop, frame };
}

/** Drives the simulation through real frame deltas, stopping exactly at `ticks`. */
function driveTo(ticks: number, deltas: readonly number[]) {
  const world = createWorld(SETUP);
  const sim = new WorldSimulation({ assertFinite: true });
  const loop = new FixedLoop();
  for (let i = 0; world.tick < ticks; i += 1) {
    loop.advance(deltas[i % deltas.length] ?? 1 / 60, (tick) => {
      if (tick < ticks) sim.step(world, [scriptedInput(tick, 0)], tick);
    });
  }
  return world;
}

describe('fixed loop driving the simulation (M7)', () => {
  it('a 5 s frame spike runs at most 4 ticks: no teleport', () => {
    const { world, frame } = setup();
    for (let i = 0; i < 60; i += 1) frame(1 / 60);
    const before = world.players[0]?.x ?? 0;
    const tickBefore = world.tick;

    const result = frame(5);
    expect(result.steps).toBe(MAX_STEPS_PER_FRAME);
    expect(result.droppedBacklog).toBe(true);
    expect(world.tick - tickBefore).toBe(MAX_STEPS_PER_FRAME);
    expect((world.players[0]?.x ?? 0) - before).toBeLessThanOrEqual(
      MAX_STEPS_PER_FRAME * MAX_U_PER_TICK + 1e-9,
    );

    // The dropped backlog never comes back later.
    expect(frame(1 / 60).steps).toBe(1);
  });

  it('pause and resume never simulate the time spent paused', () => {
    const { world, loop, frame } = setup();
    for (let i = 0; i < 30; i += 1) frame(1 / 60);
    frame(0.5 * (1 / 60)); // leaves half a tick in the accumulator
    loop.reset(); // backgrounded: the lifecycle controller resets instead of feeding the gap in
    const tickBefore = world.tick;
    expect(frame(1 / 120).steps).toBe(0); // would be 1 step if the old half tick survived
    expect(world.tick).toBe(tickBefore);
    expect(frame(1 / 60).steps).toBe(1);
  });

  it('display refresh rate never changes the outcome (60 Hz, 144 Hz, 30 Hz, uneven frames)', () => {
    const ticks = 600;
    const reference = createWorld(SETUP);
    const sim = new WorldSimulation({ assertFinite: true });
    for (let tick = 0; tick < ticks; tick += 1) sim.step(reference, [scriptedInput(tick, 0)], tick);
    const expected = hashWorld(reference);

    for (const deltas of [[1 / 60], [1 / 144], [1 / 30], [0.004, 0.031, 0.016, 0.009, 0.05, 0.0005]]) {
      expect(hashWorld(driveTo(ticks, deltas)), `deltas ${deltas.join(',')}`).toBe(expected);
    }
  });
});
