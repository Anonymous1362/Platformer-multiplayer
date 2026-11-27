import { describe, expect, it } from 'vitest';
import { Button } from '../../src/core/InputTypes';
import { InputRouter } from '../../src/input/InputRouter';
import { TouchControls } from '../../src/input/TouchControls';
import { classicLayout, hitTest, TOUCH_METRICS, type TouchLayout } from '../../src/input/TouchLayout';

/** A landscape phone: 844 × 390 CSS px. */
const W = 844;
const H = 390;

function center(layout: TouchLayout, role: string): { x: number; y: number } {
  const b = layout.buttons.find((button) => button.role === role);
  if (!b) throw new Error(`no ${role} button`);
  return { x: b.cx, y: b.cy };
}

function setup(): { touch: TouchControls; router: InputRouter; layout: TouchLayout } {
  const layout = classicLayout(W, H);
  const touch = new TouchControls(layout);
  return { touch, router: new InputRouter([touch]), layout };
}

const STICK_START = { x: 150, y: 300 };

describe('touch controls (spec section 14.5)', () => {
  it('two fingers: move + jump', () => {
    const { touch, router, layout } = setup();
    touch.begin(1, STICK_START.x, STICK_START.y, 0);
    touch.move(1, STICK_START.x + 60, STICK_START.y);
    const jump = center(layout, 'jump');
    touch.begin(2, jump.x, jump.y, 10);
    const frame = router.nextFrame();
    expect(frame.moveX).toBeGreaterThan(0.8);
    expect(frame.held & Button.Jump).toBe(Button.Jump);
  });

  it('three fingers: move + jump + shoot', () => {
    const { touch, router, layout } = setup();
    touch.begin(1, STICK_START.x, STICK_START.y, 0);
    touch.move(1, STICK_START.x - 64, STICK_START.y);
    const jump = center(layout, 'jump');
    const shoot = center(layout, 'shoot');
    touch.begin(2, jump.x, jump.y, 5);
    touch.begin(3, shoot.x, shoot.y, 6);
    const frame = router.nextFrame();
    expect(frame.moveX).toBe(-1);
    expect(frame.held).toBe(Button.Jump | Button.Shoot);
  });

  it('releasing jump while moving keeps moving; other fingers keep their controls', () => {
    const { touch, router, layout } = setup();
    touch.begin(1, STICK_START.x, STICK_START.y, 0);
    touch.move(1, STICK_START.x + 64, STICK_START.y);
    const jump = center(layout, 'jump');
    const shoot = center(layout, 'shoot');
    touch.begin(2, jump.x, jump.y, 1);
    touch.begin(3, shoot.x, shoot.y, 2);
    router.nextFrame();
    touch.end(2);
    const frame = router.nextFrame();
    expect(frame.moveX).toBe(1);
    expect(frame.held).toBe(Button.Shoot);
  });

  it('touchcancel releases only the cancelled finger', () => {
    const { touch, router, layout } = setup();
    touch.begin(1, STICK_START.x, STICK_START.y, 0);
    touch.move(1, STICK_START.x + 64, STICK_START.y);
    const dash = center(layout, 'dash');
    touch.begin(2, dash.x, dash.y, 1);
    touch.end(1); // cancelled
    const frame = router.nextFrame();
    expect(frame.moveX).toBe(0);
    expect(frame.held).toBe(Button.Dash);
  });

  it('a finger that slides across another control keeps the control it started on', () => {
    const { touch, router, layout } = setup();
    const jump = center(layout, 'jump');
    const shoot = center(layout, 'shoot');
    touch.begin(1, STICK_START.x, STICK_START.y, 0);
    touch.move(1, jump.x, jump.y); // stick finger slides over Jump
    touch.begin(2, shoot.x, shoot.y, 1);
    touch.move(2, STICK_START.x, STICK_START.y); // shoot finger slides into the stick zone
    const frame = router.nextFrame();
    expect(frame.held).toBe(Button.Shoot);
    expect(frame.moveX).toBeCloseTo(1, 3); // still the stick, saturated toward Jump
  });

  it('a resize mid-touch moves the controls but keeps every finger on its control', () => {
    const { touch, router } = setup();
    const jump = center(touch.currentLayout, 'jump');
    touch.begin(1, STICK_START.x, STICK_START.y, 0);
    touch.move(1, STICK_START.x + 64, STICK_START.y);
    touch.begin(2, jump.x, jump.y, 1);
    touch.setLayout(classicLayout(700, 400));
    const frame = router.nextFrame();
    expect(frame.moveX).toBe(1);
    expect(frame.held).toBe(Button.Jump);
    // New touches use the new layout.
    const newJump = center(touch.currentLayout, 'jump');
    expect(newJump.x).toBe(700 - 88);
  });

  it('orientation change (release-all) clears every role; fingers still down stay released', () => {
    const { touch, router, layout } = setup();
    const jump = center(layout, 'jump');
    touch.begin(1, STICK_START.x, STICK_START.y, 0);
    touch.move(1, STICK_START.x + 64, STICK_START.y);
    touch.begin(2, jump.x, jump.y, 1);
    router.releaseAll();
    touch.move(1, STICK_START.x - 64, STICK_START.y); // old finger keeps moving: ignored
    const frame = router.nextFrame();
    expect(frame).toEqual({ moveX: 0, moveY: 0, held: 0, aimMrad: 0 });
    touch.begin(3, jump.x, jump.y, 2); // a fresh press works again
    expect(router.nextFrame().held).toBe(Button.Jump);
  });

  it('two fingers on the same button: the first owner wins', () => {
    const { touch, router, layout } = setup();
    const jump = center(layout, 'jump');
    touch.begin(1, jump.x, jump.y, 0);
    touch.begin(2, jump.x + 5, jump.y, 1);
    touch.end(2); // the second finger lifts: Jump is still held by the first
    expect(router.nextFrame().held).toBe(Button.Jump);
    touch.end(1);
    expect(router.nextFrame().held).toBe(0);
  });

  it('no drift: a stick finger resting inside the deadzone outputs exactly zero', () => {
    const { touch, router } = setup();
    touch.begin(1, STICK_START.x, STICK_START.y, 0);
    touch.move(1, STICK_START.x + 6, STICK_START.y - 4);
    const frame = router.nextFrame();
    expect(Object.is(frame.moveX, 0)).toBe(true);
    expect(Object.is(frame.moveY, 0)).toBe(true);
  });

  it('diagonals are never faster than straight lines', () => {
    const { touch, router } = setup();
    touch.begin(1, STICK_START.x, STICK_START.y, 0);
    touch.move(1, STICK_START.x + 200, STICK_START.y + 200);
    const frame = router.nextFrame();
    expect(Math.hypot(frame.moveX, frame.moveY)).toBeCloseTo(1, 9);
    expect(frame.moveY).toBeGreaterThanOrEqual(0.6); // a down-diagonal counts as Down
  });

  it('a tap shorter than one tick is latched into the next tick, then released', () => {
    const { touch, router, layout } = setup();
    const jump = center(layout, 'jump');
    touch.begin(1, jump.x, jump.y, 0);
    touch.end(1);
    expect(router.nextFrame().held).toBe(Button.Jump);
    expect(router.nextFrame().held).toBe(0);
  });

  it('overlapping hit areas are split down the middle: one press never triggers two buttons', () => {
    // Enlarged buttons (as the layout editor allows) whose hit circles overlap.
    const base = classicLayout(W, H);
    const layout: TouchLayout = {
      ...base,
      buttons: [
        { role: 'jump', cx: 700, cy: 300, radius: 50, hitRadius: 62 },
        { role: 'dash', cx: 700, cy: 200, radius: 50, hitRadius: 62 },
      ],
    };
    expect(hitTest(layout, 700, 251)).toBe('jump');
    expect(hitTest(layout, 700, 249)).toBe('dash');
    const touch = new TouchControls(layout);
    const router = new InputRouter([touch]);
    touch.begin(1, 700, 251, 0);
    expect(router.nextFrame().held).toBe(Button.Jump);
  });

  it('no Classic hit areas overlap on a small phone', () => {
    const layout = classicLayout(640, 360);
    for (const a of layout.buttons) {
      for (const b of layout.buttons) {
        if (a === b) continue;
        expect(Math.hypot(a.cx - b.cx, a.cy - b.cy), `${a.role}/${b.role}`).toBeGreaterThan(
          a.hitRadius + b.hitRadius,
        );
      }
    }
  });

  it('hit areas extend 12 px past the visual edge', () => {
    const layout = classicLayout(W, H);
    const jump = layout.buttons.find((b) => b.role === 'jump');
    if (!jump) throw new Error('no jump');
    expect(hitTest(layout, jump.cx + jump.radius + TOUCH_METRICS.hitSlopPx - 1, jump.cy)).toBe('jump');
    expect(hitTest(layout, jump.cx + jump.radius + TOUCH_METRICS.hitSlopPx + 1, jump.cy)).toBeNull();
  });

  it('the floating stick lives in the left 40% by bottom 60%; elsewhere nothing starts', () => {
    const layout = classicLayout(W, H);
    expect(hitTest(layout, 10, H - 10)).toBe('move');
    expect(hitTest(layout, W * 0.4 - 1, H * 0.4 + 1)).toBe('move');
    expect(hitTest(layout, W * 0.4 + 5, H - 10)).toBeNull();
    expect(hitTest(layout, 10, H * 0.4 - 5)).toBeNull();
  });

  it('the pause button is a tap, not a held control', () => {
    const { touch, router, layout } = setup();
    const pause = center(layout, 'pause');
    touch.begin(1, pause.x, pause.y, 0);
    expect(router.takePause()).toBe(true);
    expect(router.takePause()).toBe(false);
    expect(router.nextFrame().held).toBe(0);
  });

  it('fixed-stick mode anchors the stick at (+120, +120) from the bottom-left', () => {
    const layout = classicLayout(W, H, false);
    const touch = new TouchControls(layout);
    expect(hitTest(layout, 120, H - 120)).toBe('move');
    touch.begin(1, 130, H - 110, 0);
    touch.move(1, 120 + 64, H - 120);
    expect(touch.stick().x).toBe(1);
  });
});
