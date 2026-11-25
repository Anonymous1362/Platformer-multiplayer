import { describe, expect, it } from 'vitest';
import { FixedLoop } from '../../src/core/FixedLoop';
import { GameConfig } from '../../src/core/GameConfig';

describe('FixedLoop', () => {
  it('turns elapsed wall time into fixed 60 Hz steps with a fractional remainder', () => {
    const loop = new FixedLoop();

    expect(loop.advance(50)).toEqual({ steps: 3, interpolationAlpha: expect.closeTo(0, 8) });
    const partial = loop.advance(GameConfig.fixedStepMs / 2);
    expect(partial.steps).toBe(0);
    expect(partial.interpolationAlpha).toBeCloseTo(0.5);
    expect(loop.advance(GameConfig.fixedStepMs / 2).steps).toBe(1);
  });

  it('clamps frame spikes and caps work per frame without retaining whole overdue steps', () => {
    const loop = new FixedLoop();
    const frame = loop.advance(1000);

    expect(frame.steps).toBe(GameConfig.maxStepsPerFrame);
    expect(frame.interpolationAlpha).toBeGreaterThanOrEqual(0);
    expect(frame.interpolationAlpha).toBeLessThan(1);
    expect(loop.advance(0).steps).toBe(0);
  });

  it('ignores invalid or negative deltas and resets its accumulator after an interruption', () => {
    const loop = new FixedLoop();

    expect(loop.advance(Number.NaN).steps).toBe(0);
    expect(loop.advance(Number.POSITIVE_INFINITY).steps).toBe(0);
    expect(loop.advance(-20).steps).toBe(0);
    loop.advance(GameConfig.fixedStepMs / 2);
    loop.reset();
    expect(loop.advance(GameConfig.fixedStepMs / 2).steps).toBe(0);
  });
});
