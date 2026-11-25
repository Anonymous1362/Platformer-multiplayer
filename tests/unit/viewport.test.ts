import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cameraZoomFor, computeStageSize, MAX_ASPECT, MIN_ASPECT } from '../../src/app/Viewport';

describe('computeStageSize', () => {
  it('fills the window inside the supported range', () => {
    expect(computeStageSize(1920, 1080)).toEqual({ width: 1920, height: 1080 });
    expect(computeStageSize(2340, 1080)).toEqual({ width: 2340, height: 1080 });
    expect(computeStageSize(1600, 1200)).toEqual({ width: 1600, height: 1200 });
  });

  it('pillarboxes beyond 21:9', () => {
    expect(computeStageSize(3440, 1080)).toEqual({ width: 2520, height: 1080 });
  });

  it('letterboxes below 4:3', () => {
    expect(computeStageSize(800, 1000)).toEqual({ width: 800, height: 600 });
  });

  it('returns an empty stage for an empty window', () => {
    expect(computeStageSize(0, 600)).toEqual({ width: 0, height: 0 });
    expect(computeStageSize(Number.NaN, 600)).toEqual({ width: 0, height: 0 });
  });

  it('always fits the window and stays in the aspect range (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 200, max: 6000 }), fc.integer({ min: 200, max: 4000 }), (w, h) => {
        const s = computeStageSize(w, h);
        const aspect = s.width / s.height;
        return s.width <= w && s.height <= h && aspect >= MIN_ASPECT - 0.01 && aspect <= MAX_ASPECT + 0.01;
      }),
    );
  });
});

describe('cameraZoomFor', () => {
  it('shows exactly 1080 world units of height', () => {
    expect(cameraZoomFor(1080)).toBe(1);
    expect(cameraZoomFor(540)).toBe(0.5);
  });
});
