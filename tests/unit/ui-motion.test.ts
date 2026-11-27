import { describe, expect, it } from 'vitest';
import {
  animatedProperties,
  COUNTER_MS,
  counterValue,
  Duration,
  logoShardOffset,
  MOTIONS,
  motionTotalMs,
  Spring,
  springDurationMs,
  springEasing,
  springPosition,
  type MotionKind,
} from '../../src/ui/motion';
import { coverRadius, transitionTimings } from '../../src/ui/Transitions';

const KINDS = Object.keys(MOTIONS) as MotionKind[];

describe('motion tokens (spec 8.4)', () => {
  it('durations', () => {
    expect(Duration).toMatchObject({ instant: 80, fast: 140, base: 220, slow: 360 });
  });

  it('every motion animates only transform and opacity', () => {
    for (const kind of KINDS) {
      for (const reduced of [false, true]) {
        const props = animatedProperties(MOTIONS[kind](reduced, { origin: '10% 10%' }).keyframes);
        const allowed = new Set(['opacity', 'transform', 'transformOrigin']);
        expect(
          props.every((p) => allowed.has(p)),
          `${kind} reduced=${String(reduced)}: ${props.join()}`,
        ).toBe(true);
      }
    }
  });

  it('every motion has a reduced variant that is opacity-only (or a no-op)', () => {
    for (const kind of KINDS) {
      const props = animatedProperties(MOTIONS[kind](true, {}).keyframes);
      expect(props, kind).toEqual(['opacity']);
    }
  });

  it('panel open and close follow the table', () => {
    const open = MOTIONS.panelOpen(false, {});
    expect(open.options.duration).toBe(220);
    expect(open.options.easing).toBe('cubic-bezier(0.05, 0.7, 0.1, 1)');
    expect(open.keyframes[0]).toMatchObject({ opacity: 0, transform: 'translateY(12px) scale(0.94)' });
    const close = MOTIONS.panelClose(false, {});
    expect(close.options.duration).toBe(140);
    expect(close.options.easing).toBe('cubic-bezier(0.3, 0, 0.8, 0.15)');
    expect(MOTIONS.panelOpen(true, {}).options.duration).toBe(120);
    expect(MOTIONS.backdropIn(false, {}).options.duration).toBe(160);
  });

  it('tab switch slides 16 units in the direction of travel over 180 ms; list entrance staggers 30 ms, max 8', () => {
    expect(MOTIONS.tabSwitch(false, { direction: -1 }).keyframes[0]).toMatchObject({
      transform: 'translateX(-16px)',
    });
    expect(MOTIONS.tabSwitch(false, { direction: 1 }).options.duration).toBe(180);
    expect(MOTIONS.listEntrance(false, { index: 2 }).options.delay).toBe(60);
    expect(MOTIONS.listEntrance(false, { index: 50 }).options.delay).toBe(7 * 30);
    expect(MOTIONS.listEntrance(true, { index: 5 }).options.delay).toBeUndefined();
  });

  it('button press scales to 0.93 and releases with the bouncy spring', () => {
    expect(MOTIONS.buttonPress(false, {}).keyframes[1]).toMatchObject({ transform: 'scale(0.93)' });
    expect(String(MOTIONS.buttonRelease(false, {}).options.easing)).toMatch(/^linear\(/);
  });

  it('the toast drops in over 220 ms', () => {
    expect(MOTIONS.toastIn(false, {}).options.duration).toBe(220);
    expect(motionTotalMs(MOTIONS.toastIn(false, {}))).toBe(220);
  });

  it('the logo assembles over about 1.2 s with a quick fade under reduced motion', () => {
    const last = MOTIONS.logoAssemble(false, { index: 11 });
    expect(motionTotalMs(last)).toBeGreaterThanOrEqual(1100);
    expect(motionTotalMs(last)).toBeLessThanOrEqual(1250);
    expect(MOTIONS.logoAssemble(true, { index: 11 }).options.duration).toBe(120);
  });
});

describe('springs (mass 1)', () => {
  it('start at 0 and settle at 1', () => {
    for (const spring of Object.values(Spring)) {
      expect(springPosition(spring, 0)).toBe(0);
      expect(springPosition(spring, 3)).toBeCloseTo(1, 3);
    }
  });

  it('bouncy overshoots; snappy and gentle are damped more', () => {
    const peak = (s: (typeof Spring)[keyof typeof Spring]): number => {
      let max = 0;
      for (let t = 0; t < 1.5; t += 0.005) max = Math.max(max, springPosition(s, t));
      return max;
    };
    expect(peak(Spring.bouncy)).toBeGreaterThan(1.1);
    expect(peak(Spring.snappy)).toBeLessThan(peak(Spring.bouncy));
    expect(peak(Spring.gentle)).toBeLessThan(peak(Spring.bouncy));
  });

  it('settle time is bounded and the easing is a CSS linear() ending at 1', () => {
    for (const spring of Object.values(Spring)) {
      expect(springDurationMs(spring)).toBeGreaterThan(100);
      expect(springDurationMs(spring)).toBeLessThanOrEqual(1500);
      const easing = springEasing(spring);
      expect(easing).toMatch(/^linear\(0, .*, 1\)$/);
    }
  });
});

describe('counter roll', () => {
  it('rolls over 600 ms with ease-out and is instant under reduced motion', () => {
    expect(COUNTER_MS).toBe(600);
    expect(counterValue(0, 100, 0, false)).toBe(0);
    expect(counterValue(0, 100, 300, false)).toBeGreaterThan(50); // ease-out is front-loaded
    expect(counterValue(0, 100, 600, false)).toBe(100);
    expect(counterValue(0, 100, 10, true)).toBe(100);
    expect(counterValue(40, 10, 300, false)).toBeLessThan(40);
  });
});

describe('transitions', () => {
  it('menu fade is 300 ms total, iris 450 ms, both fades under reduced motion', () => {
    const sum = (k: 'fade' | 'iris', r: boolean): number => {
      const t = transitionTimings(k, r);
      return t.cover + t.reveal;
    };
    expect(sum('fade', false)).toBe(300);
    expect(sum('iris', false)).toBe(450);
    expect(sum('iris', true)).toBe(sum('fade', true));
  });

  it('the iris disc covers the whole screen from any origin', () => {
    const r = coverRadius(800, 600, { x: 0, y: 0 });
    expect(r).toBeGreaterThanOrEqual(1000);
    expect(coverRadius(800, 600, { x: 400, y: 300 })).toBeGreaterThanOrEqual(500);
    expect(coverRadius(800, 600, { x: 800, y: 600 })).toBeGreaterThanOrEqual(1000);
  });
});

describe('logo shards', () => {
  it('offsets are deterministic and spread out', () => {
    expect(logoShardOffset(3)).toEqual(logoShardOffset(3));
    const xs = new Set(Array.from({ length: 12 }, (_, i) => logoShardOffset(i).dx));
    expect(xs.size).toBeGreaterThan(8);
  });
});
