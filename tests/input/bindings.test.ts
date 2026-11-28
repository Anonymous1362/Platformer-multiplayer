import { describe, expect, it } from 'vitest';
import { Button } from '../../src/core/InputTypes';
import {
  bind,
  conflicts,
  DEFAULT_KEYS,
  DEFAULT_PAD,
  DEFAULT_PAD_BY_FAMILY,
  isBindableCode,
  padFamily,
} from '../../src/input/Bindings';
import { GamepadControls, PadButton, type GamepadLike } from '../../src/input/GamepadControls';
import { KeyboardMouseControls } from '../../src/input/KeyboardMouseControls';
import { BINDINGS_KEY, BindingsStore, parseBindings } from '../../src/settings/BindingsStore';
import type { SettingsStorage } from '../../src/settings/SettingsStore';

/** Spec 8.13: rebinding, conflicts, per-family controller bindings, menu navigation by pad. */

function pad(
  buttons: number[] = [],
  axes: number[] = [0, 0, 0, 0],
  id = 'Xbox Wireless Controller',
): GamepadLike {
  return {
    index: 0,
    id,
    connected: true,
    mapping: 'standard',
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: buttons.includes(i),
      value: buttons.includes(i) ? 1 : 0,
    })),
    axes,
  };
}

class MemoryStorage implements SettingsStorage {
  readonly map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

describe('binding model', () => {
  it('defaults follow spec 8.9 (both keyboard columns) and the pad column', () => {
    expect(DEFAULT_KEYS.jump).toEqual(['Space', 'KeyZ']);
    expect(DEFAULT_KEYS.pause).toEqual(['Escape', 'KeyP']);
    expect(DEFAULT_PAD.shoot).toEqual([PadButton.West, PadButton.RightTrigger]);
    expect(conflicts(DEFAULT_KEYS).size).toBe(0);
    expect(conflicts(DEFAULT_PAD).size).toBe(0);
  });

  it('flags every action that shares an input', () => {
    const b = bind(DEFAULT_KEYS, 'dash', 1, 'Space');
    const c = conflicts(b);
    expect(c.get('dash')).toEqual(['jump']);
    expect(c.get('jump')).toEqual(['dash']);
  });

  it('binding the same input into the other slot clears the duplicate', () => {
    const b = bind(DEFAULT_KEYS, 'jump', 1, 'Space');
    expect(b.jump).toEqual([null, 'Space']);
  });

  it('Tab, Ctrl, Alt, and the OS keys are never bindable', () => {
    for (const code of ['Tab', 'ControlLeft', 'AltRight', 'MetaLeft', ''])
      expect(isBindableCode(code)).toBe(false);
    expect(isBindableCode('KeyJ')).toBe(true);
  });

  it('recognises controller families from Gamepad.id', () => {
    expect(padFamily('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('xbox');
    expect(padFamily('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe(
      'playstation',
    );
    expect(padFamily('Pro Controller (STANDARD GAMEPAD Vendor: 057e)')).toBe('nintendo');
    expect(padFamily('USB Gamepad')).toBe('generic');
  });
});

describe('keyboard rebinding', () => {
  it('a rebound key drives the action and the old one no longer does', () => {
    const kb = new KeyboardMouseControls();
    kb.setBindings(bind(DEFAULT_KEYS, 'jump', 0, 'KeyJ'));
    kb.keyDown('KeyJ', false, 0);
    expect(kb.sample().held & Button.Jump).toBe(Button.Jump);
    kb.keyUp('KeyJ');
    kb.consumeLatched();
    kb.keyDown('Space', false, 1);
    expect(kb.sample().held & Button.Jump).toBe(0);
    kb.keyDown('KeyZ', false, 2); // the alternate still works
    expect(kb.sample().held & Button.Jump).toBe(Button.Jump);
  });

  it('a conflicting key drives both actions while flagged', () => {
    const kb = new KeyboardMouseControls(bind(DEFAULT_KEYS, 'dash', 1, 'Space'));
    kb.keyDown('Space', false, 0);
    expect(kb.sample().held & (Button.Jump | Button.Dash)).toBe(Button.Jump | Button.Dash);
  });

  it('either Shift key counts as Shift', () => {
    const kb = new KeyboardMouseControls();
    kb.keyDown('ShiftRight', false, 0);
    expect(kb.sample().held & Button.Dash).toBe(Button.Dash);
  });
});

describe('controller rebinding', () => {
  it('uses the bindings of the pad family', () => {
    const gp = new GamepadControls();
    gp.setBindings({ ...DEFAULT_PAD_BY_FAMILY, xbox: bind(DEFAULT_PAD, 'jump', 0, PadButton.North) });
    gp.poll([pad([PadButton.North])], 0);
    expect(gp.sample().held & Button.Jump).toBe(Button.Jump);
    gp.poll([pad([])], 1);
    gp.poll([pad([PadButton.South])], 2);
    expect(gp.sample().held & Button.Jump).toBe(0);
    // A PlayStation pad keeps its own (default) bindings.
    gp.poll([pad([], undefined, 'DualSense Wireless Controller')], 3);
    gp.poll([pad([PadButton.South], undefined, 'DualSense Wireless Controller')], 4);
    expect(gp.sample().held & Button.Jump).toBe(Button.Jump);
  });

  it('capture takes the next new press, and nothing reaches the game or menus meanwhile', () => {
    const gp = new GamepadControls();
    gp.poll([pad([PadButton.South])], 0); // already held: not a new press
    gp.menu.take(); // that press was a menu confirm before the capture began
    const got: [number, string][] = [];
    gp.captureNext((b, f) => got.push([b, f]));
    gp.poll([pad([PadButton.South])], 1);
    expect(got).toEqual([]);
    gp.poll([pad([PadButton.South, PadButton.LeftBumper])], 2);
    expect(got).toEqual([[PadButton.LeftBumper, 'xbox']]);
    expect(gp.sample().held).toBe(0);
    expect(gp.menu.take()).toEqual([]);
    expect(gp.capturing).toBe(false);
  });

  it('a cancelled capture takes nothing', () => {
    const gp = new GamepadControls();
    const got: number[] = [];
    const cancel = gp.captureNext((b) => got.push(b));
    cancel();
    gp.poll([pad([PadButton.East])], 0);
    expect(got).toEqual([]);
  });
});

describe('controller menu navigation (spec 8.13)', () => {
  it('D-pad and stick give left/right; bumpers switch tabs', () => {
    const gp = new GamepadControls();
    gp.poll([pad([PadButton.DpadLeft])], 0);
    gp.poll([pad([])], 1);
    gp.poll([pad([PadButton.RightBumper])], 2);
    gp.poll([pad([])], 3);
    gp.poll([pad([PadButton.LeftBumper])], 4);
    gp.poll([pad([], [0.9, 0, 0, 0])], 5);
    expect(gp.menu.take()).toEqual(['left', 'nextTab', 'prevTab', 'right']);
  });
});

describe('bindings store', () => {
  it('persists per device and survives a restart; reset per device', () => {
    const storage = new MemoryStorage();
    const a = new BindingsStore(storage);
    a.setKey('jump', 0, 'KeyJ');
    a.setPad('playstation', 'dash', 1, PadButton.LeftBumper);
    const b = new BindingsStore(storage);
    expect(b.get().keyboard.jump).toEqual(['KeyJ', 'KeyZ']);
    expect(b.get().pads.playstation.dash).toEqual([PadButton.East, PadButton.LeftBumper]);
    expect(b.get().pads.xbox.dash).toEqual(DEFAULT_PAD.dash);
    b.resetKeyboard();
    expect(new BindingsStore(storage).get().keyboard).toEqual(DEFAULT_KEYS);
    b.resetPad('playstation');
    expect(new BindingsStore(storage).get().pads.playstation).toEqual(DEFAULT_PAD);
  });

  it('refuses unbindable keys and falls back per action on bad data', () => {
    const store = new BindingsStore(new MemoryStorage());
    store.setKey('jump', 0, 'Tab');
    expect(store.get().keyboard.jump).toEqual(DEFAULT_KEYS.jump);
    const parsed = parseBindings({
      keyboard: { jump: ['KeyJ', 9], dash: ['KeyQ', null] },
      pads: { xbox: { jump: [99, null] } },
    });
    expect(parsed.keyboard.jump).toEqual(DEFAULT_KEYS.jump);
    expect(parsed.keyboard.dash).toEqual(['KeyQ', null]);
    expect(parsed.pads.xbox.jump).toEqual(DEFAULT_PAD.jump);
    for (const junk of [null, 3, 'x', []]) expect(parseBindings(junk).keyboard).toEqual(DEFAULT_KEYS);
    const s = new MemoryStorage();
    s.setItem(BINDINGS_KEY, '{nope');
    expect(new BindingsStore(s).get().keyboard).toEqual(DEFAULT_KEYS);
  });
});
