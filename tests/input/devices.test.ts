import { describe, expect, it } from 'vitest';
import { Button } from '../../src/core/InputTypes';
import { GamepadControls, PadButton, type GamepadLike } from '../../src/input/GamepadControls';
import { installInputCleanup, InputRouter } from '../../src/input/InputRouter';
import { KeyboardMouseControls } from '../../src/input/KeyboardMouseControls';
import { TouchControls } from '../../src/input/TouchControls';
import { classicLayout } from '../../src/input/TouchLayout';

function pad(
  overrides: { buttons?: number[]; axes?: number[]; values?: Record<number, number> } = {},
): GamepadLike {
  const pressed = new Set(overrides.buttons ?? []);
  return {
    index: 0,
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD)',
    connected: true,
    mapping: 'standard',
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: pressed.has(i),
      value: overrides.values?.[i] ?? (pressed.has(i) ? 1 : 0),
    })),
    axes: overrides.axes ?? [0, 0, 0, 0],
  };
}

describe('keyboard and mouse (spec 8.9, 14.4)', () => {
  it('both keyboard columns work at the same time', () => {
    const kb = new KeyboardMouseControls();
    const router = new InputRouter([kb]);
    kb.keyDown('KeyD', false, 0);
    kb.keyDown('KeyZ', false, 0);
    kb.keyDown('ShiftLeft', false, 0);
    const frame = router.nextFrame();
    expect(frame.moveX).toBe(1);
    expect(frame.held).toBe(Button.Jump | Button.Dash);
  });

  it('OS key repeat is ignored, and a key cleared by a blur stays released until pressed again', () => {
    const kb = new KeyboardMouseControls();
    const router = new InputRouter([kb]);
    kb.keyDown('Space', false, 0);
    router.releaseAll(); // blur
    kb.keyDown('Space', true, 10); // repeat events keep arriving for the still-held key
    expect(router.nextFrame().held).toBe(0);
    kb.keyUp('Space');
    kb.keyDown('Space', false, 20);
    expect(router.nextFrame().held).toBe(Button.Jump);
  });

  it('left + down is normalized (diagonals never faster) and still counts as Down', () => {
    const kb = new KeyboardMouseControls();
    const router = new InputRouter([kb]);
    kb.keyDown('ArrowLeft', false, 0);
    kb.keyDown('ArrowDown', false, 0);
    const frame = router.nextFrame();
    expect(Math.hypot(frame.moveX, frame.moveY)).toBeCloseTo(1, 9);
    expect(frame.moveY).toBeGreaterThanOrEqual(0.6);
  });

  it('opposite directions cancel', () => {
    const kb = new KeyboardMouseControls();
    const router = new InputRouter([kb]);
    kb.keyDown('KeyA', false, 0);
    kb.keyDown('ArrowRight', false, 0);
    expect(router.nextFrame().moveX).toBe(0);
  });

  it('a key tap between two ticks is latched for exactly one tick', () => {
    const kb = new KeyboardMouseControls();
    const router = new InputRouter([kb]);
    kb.keyDown('Space', false, 0);
    kb.keyUp('Space');
    expect(router.nextFrame().held).toBe(Button.Jump);
    expect(router.nextFrame().held).toBe(0);
  });

  it('left mouse shoots toward the cursor; right mouse parries; unbound keys are not handled', () => {
    const kb = new KeyboardMouseControls();
    const router = new InputRouter([kb]);
    kb.setAimResolver((x, y) => Math.round(Math.atan2(y, x) * 1000));
    kb.pointerMove(0, 10);
    kb.pointerDown(0, 0);
    kb.pointerDown(2, 0);
    const frame = router.nextFrame();
    expect(frame.held).toBe(Button.Shoot | Button.Parry);
    expect(frame.aimMrad).toBe(1571);
    expect(kb.keyDown('KeyQ', false, 0)).toBe(false);
  });

  it('Esc and P pause once per press', () => {
    const kb = new KeyboardMouseControls();
    const router = new InputRouter([kb]);
    kb.keyDown('Escape', false, 0);
    kb.keyDown('Escape', true, 1);
    expect(router.takePause()).toBe(true);
    expect(router.takePause()).toBe(false);
  });
});

describe('gamepad, standard mapping (spec 8.9, 14.4)', () => {
  it('A jumps, B dashes, X and RT shoot, RB parries, Y is the gadget', () => {
    const gp = new GamepadControls();
    const router = new InputRouter([gp]);
    gp.poll([pad({ buttons: [PadButton.South, PadButton.East, PadButton.RightBumper, PadButton.North] })], 0);
    expect(router.nextFrame().held).toBe(Button.Jump | Button.Dash | Button.Parry | Button.Gadget);
    gp.poll([pad({ values: { [PadButton.RightTrigger]: 0.8 } })], 1);
    expect(router.nextFrame().held).toBe(Button.Shoot);
  });

  it('left stick moves with the radial deadzone; the D-pad works too', () => {
    const gp = new GamepadControls();
    const router = new InputRouter([gp]);
    gp.poll([pad({ axes: [0.1, 0.05, 0, 0] })], 0);
    expect(router.nextFrame().moveX).toBe(0); // inside the deadzone: no drift
    gp.poll([pad({ axes: [1, 0, 0, 0] })], 1);
    expect(router.nextFrame().moveX).toBe(1);
    gp.poll([pad({ buttons: [PadButton.DpadLeft] })], 2);
    expect(router.nextFrame().moveX).toBe(-1);
  });

  it('the right stick aims (world space, +y down)', () => {
    const gp = new GamepadControls();
    const router = new InputRouter([gp]);
    gp.poll([pad({ axes: [0, 0, 0, 1] })], 0);
    expect(router.nextFrame().aimMrad).toBe(1571);
  });

  it('after a release-all, a button still held does not fire until it is released and pressed again', () => {
    const gp = new GamepadControls();
    const router = new InputRouter([gp]);
    gp.poll([pad({ buttons: [PadButton.South] })], 0);
    expect(router.nextFrame().held).toBe(Button.Jump);
    router.releaseAll(); // the window lost focus
    gp.poll([pad({ buttons: [PadButton.South] })], 1);
    expect(router.nextFrame().held).toBe(0);
    gp.poll([pad()], 2);
    gp.poll([pad({ buttons: [PadButton.South] })], 3);
    expect(router.nextFrame().held).toBe(Button.Jump);
  });

  it('hot-plug: a pad that disappears releases its buttons', () => {
    const gp = new GamepadControls();
    const router = new InputRouter([gp]);
    gp.poll([pad({ buttons: [PadButton.East] })], 0);
    router.nextFrame();
    gp.poll([null], 1);
    expect(router.nextFrame().held).toBe(0);
    expect(gp.connectedIds).toEqual([]);
  });

  it('Start pauses once per press', () => {
    const gp = new GamepadControls();
    const router = new InputRouter([gp]);
    gp.poll([pad({ buttons: [PadButton.Start] })], 0);
    gp.poll([pad({ buttons: [PadButton.Start] })], 1);
    expect(router.takePause()).toBe(true);
    expect(router.takePause()).toBe(false);
  });
});

describe('the router merges every device (spec 14.1)', () => {
  it('keyboard and touch at the same time: buttons combine, the stronger stick wins', () => {
    const touch = new TouchControls(classicLayout(844, 390));
    const kb = new KeyboardMouseControls();
    const router = new InputRouter([touch, kb]);
    touch.begin(1, 150, 300, 0);
    touch.move(1, 150 + 30, 300); // a partial stick push
    kb.keyDown('Space', false, 0);
    const frame = router.nextFrame();
    expect(frame.held).toBe(Button.Jump);
    expect(frame.moveX).toBeGreaterThan(0);
    kb.keyDown('KeyA', false, 1); // the full key press is stronger
    expect(router.nextFrame().moveX).toBe(-1);
    expect(router.lastDevice()).toBe('keyboard');
  });
});

describe('cleanup triggers (M6)', () => {
  function rig() {
    const kb = new KeyboardMouseControls();
    const touch = new TouchControls(classicLayout(844, 390));
    const router = new InputRouter([touch, kb]);
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    const reasons: string[] = [];
    const uninstall = installInputCleanup(router, { window: win, document: doc }, (r) => reasons.push(r));
    const hold = (): void => {
      kb.keyDown('KeyD', false, 0);
      touch.begin(7, 760, 300, 0); // Jump
    };
    return { kb, touch, router, win, doc, reasons, uninstall, hold };
  }

  for (const event of ['blur', 'pagehide', 'orientationchange', 'pointercancel']) {
    it(`${event} releases every key and touch`, () => {
      const r = rig();
      r.hold();
      r.router.nextFrame();
      r.win.dispatchEvent(new Event(event));
      expect(r.router.nextFrame()).toEqual({ moveX: 0, moveY: 0, held: 0, aimMrad: 0 });
      expect(r.reasons).toEqual([event]);
    });
  }

  it('hidden visibility releases everything; becoming visible does not', () => {
    const r = rig();
    r.hold();
    r.doc.visibilityState = 'visible';
    r.doc.dispatchEvent(new Event('visibilitychange'));
    expect(r.router.nextFrame().held).toBe(Button.Jump);
    r.doc.visibilityState = 'hidden';
    r.doc.dispatchEvent(new Event('visibilitychange'));
    expect(r.router.nextFrame().held).toBe(0);
    expect(r.reasons).toEqual(['hidden']);
  });

  it('a DOM panel opening (an explicit release) clears a held touch', () => {
    const r = rig();
    r.hold();
    r.router.releaseAll(); // what the UI calls when a panel opens, and the scene on pause or teardown
    expect(r.router.nextFrame().held).toBe(0);
    expect(r.router.releaseCount).toBe(1);
  });

  it('uninstalling removes the listeners', () => {
    const r = rig();
    r.uninstall();
    r.hold();
    r.win.dispatchEvent(new Event('blur'));
    expect(r.router.nextFrame().held).toBe(Button.Jump);
    expect(r.reasons).toEqual([]);
  });
});
