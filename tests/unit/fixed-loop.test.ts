import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FIXED_DT, FixedLoop, MAX_STEPS_PER_FRAME } from '../../src/core/FixedLoop';

function run(loop: FixedLoop, deltas: readonly number[]): number[] {
  const steps: number[] = [];
  for (const d of deltas) steps.push(loop.advance(d, () => undefined).steps);
  return steps;
}

describe('FixedLoop', () => {
  it('runs exactly 60 steps for 60 frames of 1/60 s', () => {
    const loop = new FixedLoop();
    const steps = run(loop, Array<number>(60).fill(1 / 60));
    expect(steps.reduce((a, b) => a + b, 0)).toBe(60);
    expect(steps.every((s) => s === 1)).toBe(true);
  });

  it('runs 2 steps per frame at 30 fps', () => {
    const loop = new FixedLoop();
    expect(run(loop, Array<number>(10).fill(1 / 30))).toEqual(Array<number>(10).fill(2));
  });

  it('runs 60 steps over 120 frames at 120 fps', () => {
    const loop = new FixedLoop();
    const total = run(loop, Array<number>(120).fill(1 / 120)).reduce((a, b) => a + b, 0);
    expect(total).toBe(60);
  });

  it('passes consecutive tick numbers starting at 0', () => {
    const loop = new FixedLoop();
    const seen: number[] = [];
    loop.advance(3 / 60, (t) => {
      seen.push(t);
    });
    loop.advance(2 / 60, (t) => {
      seen.push(t);
    });
    expect(seen).toEqual([0, 1, 2, 3, 4]);
    expect(loop.tick).toBe(5);
  });

  it('clamps a huge frame to 100 ms, caps steps at 4, and drops the backlog', () => {
    const loop = new FixedLoop();
    const result = loop.advance(5, () => undefined);
    expect(result.steps).toBe(MAX_STEPS_PER_FRAME);
    expect(result.droppedBacklog).toBe(true);
    // Nothing is simulated later to catch up.
    expect(loop.advance(FIXED_DT, () => undefined).steps).toBe(1);
  });

  it('reset discards accumulated time', () => {
    const loop = new FixedLoop();
    loop.advance(FIXED_DT * 0.9, () => undefined);
    loop.reset();
    expect(loop.advance(FIXED_DT * 0.2, () => undefined).steps).toBe(0);
  });

  it('assist speed scales real time, not the step length', () => {
    const loop = new FixedLoop();
    loop.setSpeedScale(0.7);
    const total = run(loop, Array<number>(100).fill(1 / 60)).reduce((a, b) => a + b, 0);
    expect(total).toBe(70);
  });

  it('rejects invalid speed scales', () => {
    const loop = new FixedLoop();
    expect(() => {
      loop.setSpeedScale(0);
    }).toThrow(RangeError);
    expect(() => {
      loop.setSpeedScale(1.5);
    }).toThrow(RangeError);
    expect(() => {
      loop.setSpeedScale(Number.NaN);
    }).toThrow(RangeError);
  });

  it('ignores negative, zero, NaN, and infinite deltas', () => {
    const loop = new FixedLoop();
    expect(run(loop, [-1, 0, Number.NaN, Number.POSITIVE_INFINITY])).toEqual([0, 0, 0, 0]);
  });

  it('keeps renderAlpha in [0, 1)', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: 0, max: 0.3, noNaN: true }), { maxLength: 200 }), (deltas) => {
        const loop = new FixedLoop();
        for (const d of deltas) {
          const { renderAlpha } = loop.advance(d, () => undefined);
          if (renderAlpha < 0 || renderAlpha >= 1) return false;
        }
        return true;
      }),
    );
  });

  it('never runs more steps than elapsed time allows when no frame is dropped', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: 0, max: 0.06, noNaN: true }), { maxLength: 300 }), (deltas) => {
        const loop = new FixedLoop();
        let steps = 0;
        let elapsed = 0;
        for (const d of deltas) {
          steps += loop.advance(d, () => undefined).steps;
          elapsed += d;
        }
        return steps <= Math.floor(elapsed / FIXED_DT + 1e-6) && steps >= Math.floor(elapsed / FIXED_DT) - 1;
      }),
    );
  });
});
