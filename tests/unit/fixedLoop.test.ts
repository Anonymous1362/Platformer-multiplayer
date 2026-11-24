import { describe, expect, it } from 'vitest';
import { FixedStepClock } from '../../src/core/FixedLoop';
import { GameConfig } from '../../src/core/GameConfig';

describe('FixedStepClock', () => {
  it('turns elapsed wall time into fixed 60 Hz steps with a fractional remainder', () => {
    const clock = new FixedStepClock();

    expect(clock.advance(50)).toEqual({ steps: 3, interpolationAlpha: expect.closeTo(0, 8) });
    const partial = clock.advance(GameConfig.fixedStepMs / 2);
    expect(partial.steps).toBe(0);
    expect(partial.interpolationAlpha).toBeCloseTo(0.5);
    expect(clock.advance(GameConfig.fixedStepMs / 2).steps).toBe(1);
  });

  it('clamps frame spikes and caps work per frame without retaining whole overdue steps', () => {
    const clock = new FixedStepClock();
    const frame = clock.advance(1000);

    expect(frame.steps).toBe(GameConfig.maxStepsPerFrame);
    expect(frame.interpolationAlpha).toBeGreaterThanOrEqual(0);
    expect(frame.interpolationAlpha).toBeLessThan(1);
  });

  it('ignores invalid or negative deltas and can reset its accumulator', () => {
    const clock = new FixedStepClock();

    expect(clock.advance(Number.NaN).steps).toBe(0);
    expect(clock.advance(-20).steps).toBe(0);
    clock.advance(GameConfig.fixedStepMs / 2);
    clock.reset();
    expect(clock.advance(GameConfig.fixedStepMs / 2).steps).toBe(0);
  });
});
