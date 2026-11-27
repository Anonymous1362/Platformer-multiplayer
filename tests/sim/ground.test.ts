import { describe, expect, it } from 'vitest';
import { groundDistance } from '../../src/core/Ground';
import { createWorld, setupFor } from '../../src/core/WorldSimulation';
import { flatLevel, makeLevel } from '../fixtures/levels';

/** Contact shadows read the ground distance from the simulation's read API (spec 9.3). */
describe('groundDistance', () => {
  const level = flatLevel('kepler', 20, 16); // floor top at y = 13 * 64 = 832

  it('measures straight down to the floor top', () => {
    expect(groundDistance(level, [], 300, 700, 10, 400)).toBe(132);
    expect(groundDistance(level, [], 300, 832, 10, 400)).toBe(0);
  });

  it('returns null when the floor is out of range or there is none below', () => {
    expect(groundDistance(level, [], 300, 200, 10, 400)).toBeNull();
    const pit = makeLevel(['......', '......', '##..##'], { spawn: [0, 1] });
    expect(groundDistance(pit, [], 3 * 64 - 32, 10, 4, 500)).toBeNull();
    expect(groundDistance(pit, [], 32, 10, 4, 500)).toBe(118);
  });

  it('counts one-way tiles and the nearest edge sample', () => {
    const ledge = makeLevel(['......', '..==..', '......', '######'], { spawn: [0, 2] });
    expect(groundDistance(ledge, [], 2 * 64 + 10, 20, 4, 500)).toBe(44);
    // Hanging off the ledge's right edge: the left edge sample still finds it.
    expect(groundDistance(ledge, [], 4 * 64 + 6, 20, 12, 500)).toBe(44);
    expect(groundDistance(ledge, [], 5 * 64 + 32, 20, 4, 500)).toBe(172);
  });

  it('counts moving platform tops under the body', () => {
    const room = makeLevel(
      ['##########', '#........#', '#........#', '#........#', '#........#', '##########'],
      {
        spawn: [1, 4],
        objects: [
          {
            id: 'mp',
            type: 'moving_platform',
            x: 3,
            y: 3,
            path: [
              [3, 3],
              [6, 3],
            ],
            speedUps: 100,
            waitMs: 0,
            oneWay: false,
            w: 2,
            h: 0.5,
          },
        ],
      },
    );
    const world = createWorld(setupFor(room, { seed: 1, difficulty: 'normal', playerCount: 1 }), room);
    const p = world.platforms[0];
    expect(p).toBeDefined();
    const top = p?.y ?? 0;
    expect(groundDistance(room, world.platforms, (p?.x ?? 0) + 40, top - 50, 4, 400)).toBe(50);
    expect(groundDistance(room, world.platforms, (p?.x ?? 0) + 200, top - 50, 4, 400)).toBe(
      5 * 64 - (top - 50),
    );
  });
});
