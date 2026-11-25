import { describe, expect, it } from 'vitest';
import { moveY, type CollisionWorld } from '../../src/core/Collision';
import { DT, GameConfig, Ticks } from '../../src/core/GameConfig';
import { Button } from '../../src/core/InputTypes';
import { flatLevel, Harness, input, makeLevel } from '../fixtures/levels';

const P = GameConfig.player;
const JUMP = input({ held: Button.Jump });
const DASH = input({ held: Button.Dash });

/** Ledge on the left (cols 0–8, top y = 448), floor two tiles lower (top y = 576). */
const LEDGE = makeLevel(
  [
    '####################',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#..................#',
    '#########..........#',
    '#########..........#',
    '####################',
  ],
  { spawn: [3, 6] },
);

describe('coyote time (110 ms = 7 ticks)', () => {
  function walkOff(): Harness {
    const h = new Harness(LEDGE);
    h.standAt(560, 448);
    h.until((s) => !s.player.grounded, input({ moveX: 1 }));
    expect(h.player.airTicks).toBe(1);
    return h;
  }

  it('a jump pressed up to 7 ticks after walking off still jumps', () => {
    const h = walkOff();
    h.until((s) => s.player.airTicks === Ticks.coyote, input());
    const events = h.step(JUMP);
    expect(events.some((e) => e.type === 'jumped')).toBe(true);
    expect(h.player.vy).toBeLessThan(0);
  });

  it('one tick later it does not', () => {
    const h = walkOff();
    h.until((s) => s.player.airTicks === Ticks.coyote + 1, input());
    const events = h.step(JUMP);
    expect(events.some((e) => e.type === 'jumped')).toBe(false);
  });

  it('there is no coyote jump after jumping (no double jump)', () => {
    const h = new Harness(flatLevel());
    h.step(JUMP);
    h.step(input());
    const events = h.step(JUMP);
    expect(events.some((e) => e.type === 'jumped')).toBe(false);
  });
});

describe('jump buffer (130 ms = 8 ticks)', () => {
  /** Drops the player from 150 u up and returns the tick index of the landing step. */
  function landingStep(): number {
    const h = new Harness(flatLevel());
    h.placePlayer(300, h.level.spawn.y - 150);
    h.player.fuelS = 0;
    return h.until((s) => s.player.grounded, input());
  }

  function dropWithPressAt(pressStep: number): Harness {
    const h = new Harness(flatLevel());
    h.placePlayer(300, h.level.spawn.y - 150);
    h.player.fuelS = 0; // no jetpack interference from the in-air press
    for (let i = 0; i < 40; i += 1) h.step(i === pressStep ? JUMP : input());
    return h;
  }

  it('a press up to 7 ticks before landing jumps on the first grounded tick', () => {
    const landing = landingStep() - 1;
    const h = dropWithPressAt(landing - 6);
    const jumped = h.eventsOf('jumped');
    expect(jumped).toHaveLength(1);
    expect(jumped[0]?.tick).toBe(landing + 1);
  });

  it('an earlier press is forgotten', () => {
    const landing = landingStep() - 1;
    const h = dropWithPressAt(landing - 7);
    expect(h.eventsOf('jumped')).toHaveLength(0);
  });

  it('holding Jump never auto-repeats', () => {
    const h = new Harness(flatLevel());
    h.player.fuelS = 0;
    h.run(200, JUMP);
    expect(h.eventsOf('jumped')).toHaveLength(1);
  });
});

describe('variable jump', () => {
  it('releasing cuts vy by 0.45 once, but only after the 3-tick minimum hold', () => {
    const h = new Harness(flatLevel());
    const g = P.gravityRiseUps2 * DT;
    h.step(JUMP);
    expect(h.player.vy).toBeCloseTo(-P.jumpVelocityUps + g, 9);
    h.step(input());
    h.step(input());
    expect(h.player.vy).toBeCloseTo(-P.jumpVelocityUps + 3 * g, 9); // no cut yet
    h.step(input());
    expect(h.player.vy).toBeCloseTo((-P.jumpVelocityUps + 3 * g) * P.jumpCutFactor + g, 9);
    const after = h.player.vy;
    h.step(input());
    expect(h.player.vy).toBeCloseTo(after + g, 9); // never cut twice
  });

  it('a medium hold lands between a tap and a full jump', () => {
    const apex = (holdTicks: number): number => {
      const h = new Harness(flatLevel());
      const floor = h.player.y;
      let minY = floor;
      for (let i = 0; i < 80; i += 1) {
        h.step(i < holdTicks ? JUMP : input());
        minY = Math.min(minY, h.player.y);
      }
      return floor - minY;
    };
    const tap = apex(1);
    const medium = apex(10);
    const full = apex(25);
    expect(tap).toBeLessThan(medium);
    expect(medium).toBeLessThan(full);
  });
});

/** A tall wall at column 8 (left face x = 512); floor at row 13. */
const WALL = makeLevel(
  [
    '############',
    '#.......####',
    '#.......####',
    '#.......####',
    '#.......####',
    '#.......####',
    '#.......####',
    '#.......####',
    '#.......####',
    '#.......####',
    '#.......####',
    '#.......####',
    '#.......####',
    '############',
  ],
  { spawn: [2, 12] },
);

describe('wall slide and wall jump', () => {
  function sliding(): Harness {
    const h = new Harness(WALL);
    h.placePlayer(512 - 20, 300);
    h.player.fuelS = 0.2;
    h.player.airDashUsed = true;
    h.run(30, input({ moveX: 1 }));
    return h;
  }

  it('pressing into a wall while falling caps the fall at 260 u/s', () => {
    const h = sliding();
    expect(h.player.mode).toBe('wallSlide');
    expect(h.player.wallSide).toBe(1);
    expect(h.player.vy).toBe(P.wallSlideMaxFallUps);
  });

  it('a wall slide refreshes the air dash and recharges the jetpack', () => {
    const h = sliding();
    expect(h.player.airDashUsed).toBe(false);
    expect(h.player.fuelS).toBeGreaterThan(0.2);
  });

  it('wall jump: 520 u/s away, -980 u/s up, and the stick is ignored for 7 ticks', () => {
    const h = sliding();
    const events = h.step(input({ moveX: 1, held: Button.Jump }));
    expect(events.some((e) => e.type === 'wallJumped')).toBe(true);
    expect(h.player.vx).toBe(-P.wallJump.vxUps);
    expect(h.player.vy).toBeCloseTo(P.wallJump.vyUps + P.gravityRiseUps2 * DT, 9);
    expect(h.player.facing).toBe(-1);
    for (let i = 1; i < Ticks.wallJumpLock; i += 1) {
      h.step(input({ moveX: 1, held: Button.Jump }));
      expect(h.player.vx, `tick ${String(i)}`).toBe(-P.wallJump.vxUps);
    }
    h.step(input({ moveX: 1, held: Button.Jump }));
    expect(h.player.vx).toBeGreaterThan(-P.wallJump.vxUps); // control is back
  });

  it('wall-jump height matches on every planet (vy scales with sqrt(gravity))', () => {
    const height = (planet: 'kepler' | 'vulcanis'): number => {
      const level = makeLevel(
        ['############', ...Array.from({ length: 12 }, () => '#.......####'), '############'],
        { planet, spawn: [2, 12] },
      );
      const h = new Harness(level);
      h.placePlayer(512 - 20, 600);
      h.run(3, input({ moveX: 1 }));
      const start = h.player.y;
      h.step(input({ held: Button.Jump }));
      let minY = start;
      for (let i = 0; i < 60; i += 1) {
        h.step(input({ held: h.player.vy < 0 ? Button.Jump : 0 }));
        minY = Math.min(minY, h.player.y);
      }
      return start - minY;
    };
    expect(Math.abs(height('kepler') - height('vulcanis'))).toBeLessThan(4);
  });
});

describe('jetpack', () => {
  it('starts only once the jump stops rising, holds -140 u/s, and burns exactly 1.00 s of fuel', () => {
    const h = new Harness(flatLevel());
    h.step(JUMP);
    let thrustTicks = 0;
    let firstThrustVy = Number.NaN;
    let fuelAfterThrust = Number.NaN;
    for (let i = 0; i < 200 && !h.player.grounded; i += 1) {
      const before = h.player.vy;
      h.step(JUMP);
      if (h.player.jetpacking) {
        thrustTicks += 1;
        if (thrustTicks === 1) firstThrustVy = before;
        fuelAfterThrust = h.player.fuelS;
      }
    }
    expect(firstThrustVy).toBeGreaterThanOrEqual(0); // never brakes a rising jump
    expect(thrustTicks).toBe(60);
    expect(fuelAfterThrust).toBe(0);
  });

  it('approaches -140 u/s at 2400 u/s² instead of gravity', () => {
    const h = new Harness(flatLevel());
    h.step(JUMP);
    h.until((s) => s.player.jetpacking, JUMP);
    const v0 = h.player.vy;
    h.step(JUMP);
    expect(h.player.vy).toBeCloseTo(Math.max(P.jetpack.targetVyUps, v0 - P.jetpack.accelUps2 * DT), 9);
    h.run(10, JUMP);
    expect(h.player.vy).toBe(P.jetpack.targetVyUps);
  });

  it('recharges only on the ground, at 0.55 fuel/s', () => {
    const h = new Harness(flatLevel());
    h.player.fuelS = 0;
    h.run(60);
    expect(h.player.fuelS).toBeCloseTo(P.jetpack.rechargePerS, 9);
    h.placePlayer(300, 200);
    const airborne = h.player.fuelS;
    h.run(10);
    expect(h.player.fuelS).toBe(airborne);
  });
});

describe('dash', () => {
  it('in the air: no gravity, vy 0, one dash per airtime, refreshed by landing', () => {
    const h = new Harness(flatLevel('obsidian', 20, 70)); // tall enough to stay airborne past the cooldown
    h.placePlayer(300, 300);
    h.step(input());
    const y = h.player.y;
    h.step(DASH);
    for (let i = 1; i < Ticks.dash; i += 1) {
      expect(h.player.mode).toBe('dash');
      expect(h.player.y).toBe(y);
      h.step(input());
    }
    expect(h.player.mode).toBe('air');
    expect(h.player.airDashUsed).toBe(true);
    h.run(Ticks.dashCooldown);
    h.step(DASH); // cooldown is over, but the air dash is spent
    expect(h.eventsOf('dashed')).toHaveLength(1);
    h.until((s) => s.player.grounded, input());
    expect(h.player.airDashUsed).toBe(false);
  });

  it('cooldown: 57 ticks after the dash ends', () => {
    const h = new Harness(flatLevel());
    h.step(DASH);
    h.run(Ticks.dash - 1);
    expect(h.player.mode).toBe('ground');
    for (let i = 0; i < Ticks.dashCooldown - 1; i += 1) h.step(i % 2 === 0 ? DASH : input());
    expect(h.eventsOf('dashed')).toHaveLength(1);
    h.step(input());
    h.step(DASH);
    expect(h.eventsOf('dashed')).toHaveLength(2);
  });

  it('grants 8 ticks of invulnerability frames', () => {
    const h = new Harness(flatLevel());
    h.step(DASH);
    expect(h.player.iframeTicks).toBe(Ticks.dashIframes);
  });

  it('a wall ends the dash early with no speed', () => {
    const h = new Harness(WALL);
    h.standAt(512 - 20 - 50, 832);
    h.step(input({ moveX: 1, held: Button.Dash }));
    h.run(3);
    expect(h.player.mode).toBe('ground');
    expect(h.player.x).toBe(512 - 20);
    expect(h.player.vx).toBe(0);
  });
});

/** Ceiling block at row 6, columns 5–8 (left edge x = 320, bottom y = 448); floor top y = 704. */
const CEILING = makeLevel(
  [
    '##########',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '#....####.',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '##########',
  ].map((r) => r.padEnd(10, '#').slice(0, 10)),
  { spawn: [1, 10] },
);

describe('corner correction (10 u)', () => {
  function jumpUnder(x: number): { h: Harness; minY: number } {
    const h = new Harness(CEILING);
    h.standAt(x, 704);
    h.step(JUMP);
    let minY = h.player.y;
    for (let i = 0; i < 60; i += 1) {
      h.step(input({ held: h.player.vy < 0 ? Button.Jump : 0 }));
      minY = Math.min(minY, h.player.y);
    }
    return { h, minY };
  }

  it('a head clipping a ceiling corner by 8 u slips past and keeps the full jump', () => {
    const { h, minY } = jumpUnder(308);
    expect(h.player.x).toBe(300);
    expect(704 - minY).toBeGreaterThan(190);
  });

  it('a 12 u clip bonks: vy goes to 0 at the ceiling', () => {
    const { minY } = jumpUnder(312);
    expect(minY).toBe(448 + P.colliderU.height);
  });

  it('never nudges into a wall (the nudged box must be free at both heights)', () => {
    // A thin solid platform stands where the nudge would go.
    const level = makeLevel(
      ['##########', '#........#', '#........#', '#....####.', '#........#', '#........#', '##########'].map(
        (r) => r.padEnd(10, '#').slice(0, 10),
      ),
      {
        spawn: [1, 5],
        objects: [
          {
            id: 'post',
            type: 'moving_platform',
            x: 1,
            y: 4,
            path: [
              [1, 4],
              [1, 5],
            ],
            speedUps: 1,
            waitMs: 0,
            oneWay: false,
            w: 0.5,
            h: 1,
          },
        ],
      },
    );
    const def = level.platforms[0];
    if (!def) throw new Error('no platform');
    // Box x-span [281, 321] clips the ceiling block (left edge 320) by 1 u. The 1 u left nudge would
    // put it into a post whose right edge is exactly 281 (touching now, overlapping after the nudge).
    const post = {
      x: 281 - def.w,
      y: 200,
      prevX: 281 - def.w,
      prevY: 200,
      target: 1,
      dir: 1 as const,
      waitTicks: 0,
    };
    const world: CollisionWorld = { level, platforms: [post] };
    const r = moveY(world, 301, 256 + 88 + 2, -6, {
      ignoreOneWay: false,
      cornerCorrection: true,
      preferDir: -1,
    });
    expect(r.bonked).toBe(true);
    expect(r.cornerShift).toBe(0);
    expect(r.y).toBe(256 + 88);
  });
});

/** Floor top y = 704; a one-tile step at columns 6–9 with top y = 640. */
const STEP = makeLevel(
  [
    '############',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#.....####.#',
    '############',
  ],
  { spawn: [1, 10] },
);

describe('ledge forgiveness (14 u)', () => {
  it('moving into a ledge whose top is 10 u above the feet pops onto it', () => {
    const h = new Harness(STEP);
    h.placePlayer(384 - 20 - 5, 650).vx = P.maxRunSpeedUps;
    h.run(3, input({ moveX: 1 }));
    expect(h.player.grounded).toBe(true);
    expect(h.player.y).toBe(640);
    expect(h.player.x).toBeGreaterThan(384 - 20);
  });

  it('15 u below the top is a wall', () => {
    const h = new Harness(STEP);
    h.placePlayer(384 - 20 - 5, 655).vx = P.maxRunSpeedUps;
    h.step(input({ moveX: 1 }));
    expect(h.player.x).toBe(384 - 20);
    expect(h.player.y).toBeGreaterThan(640);
  });

  it('also applies while dashing', () => {
    const h = new Harness(STEP);
    h.placePlayer(384 - 20 - 30, 652);
    h.step(input({ moveX: 1, held: Button.Dash }));
    h.run(4);
    expect(h.player.y).toBe(640);
    expect(h.player.x).toBeGreaterThan(384);
  });
});

/** One-way platforms at rows 5 (top 320) and 8 (top 512), columns 2–7; floor top y = 704. */
const ONE_WAY = makeLevel(
  [
    '##########',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '#.======.#',
    '#........#',
    '#........#',
    '#.======.#',
    '#........#',
    '#........#',
    '##########',
  ],
  { spawn: [1, 10] },
);

describe('one-way platforms and drop-through (N2)', () => {
  it('jumping up through from below never bonks, and the fall lands on top', () => {
    const h = new Harness(ONE_WAY);
    h.standAt(300, 704);
    h.step(JUMP);
    h.until(
      (s) => s.player.grounded,
      (s) => input({ held: s.player.vy < 0 ? Button.Jump : 0 }),
    );
    expect(h.player.y).toBe(512);
  });

  it('catches a fall from above at terminal speed (no tunneling)', () => {
    const h = new Harness(ONE_WAY);
    h.placePlayer(300, 200);
    h.player.vy = P.terminalFallUps;
    h.player.fuelS = 0;
    h.until((s) => s.player.grounded, input());
    expect(h.player.y).toBe(320);
  });

  it('Down + Jump drops through; the 150 ms grace prevents re-landing; the next platform catches', () => {
    const h = new Harness(ONE_WAY);
    h.placePlayer(300, 250);
    h.until((s) => s.player.grounded, input());
    expect(h.player.y).toBe(320);
    const events = h.step(input({ moveY: 1, held: Button.Jump }));
    expect(events.some((e) => e.type === 'droppedThrough')).toBe(true);
    expect(events.some((e) => e.type === 'jumped')).toBe(false);
    expect(h.player.dropGraceTicks).toBe(Ticks.dropThroughGrace);
    h.until((s) => s.player.grounded, input({ moveY: 1 }));
    expect(h.player.y).toBe(512); // the lower platform, not the one it left
  });

  it('Down + Jump on solid ground is a normal jump', () => {
    const h = new Harness(ONE_WAY);
    h.standAt(300, 704);
    const events = h.step(input({ moveY: 1, held: Button.Jump }));
    expect(events.some((e) => e.type === 'jumped')).toBe(true);
  });
});

describe('ice', () => {
  it('ground deceleration is 0.25x on ice', () => {
    const ice = makeLevel(['##########', '#........#', '#........#', '#........#', '%%%%%%%%%%'], {
      spawn: [4, 3],
    });
    const stopTicks = (level: typeof ice): number => {
      const h = new Harness(level);
      h.player.vx = P.maxRunSpeedUps;
      return h.until((s) => s.player.vx === 0, input());
    };
    const normal = makeLevel(['##########', '#........#', '#........#', '#........#', '##########'], {
      spawn: [4, 3],
    });
    expect(stopTicks(normal)).toBe(Math.ceil(P.maxRunSpeedUps / (P.groundDecelUps2 * DT)));
    expect(stopTicks(ice)).toBe(
      Math.ceil(P.maxRunSpeedUps / (P.groundDecelUps2 * GameConfig.environment.ice.decelFactor * DT)),
    );
  });
});
