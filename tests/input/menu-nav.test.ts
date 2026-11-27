import { describe, expect, it } from 'vitest';
import { Button } from '../../src/core/InputTypes';
import { GamepadControls, PadButton, type GamepadLike } from '../../src/input/GamepadControls';
import { InputRouter } from '../../src/input/InputRouter';
import { KeyboardMouseControls } from '../../src/input/KeyboardMouseControls';
import { MenuIntentQueue, menuIntentForKey } from '../../src/input/MenuNav';

function pad(buttons: number[] = [], axes: number[] = [0, 0, 0, 0]): GamepadLike {
  const pressed = new Set(buttons);
  return {
    index: 0,
    id: 'Test Pad (STANDARD GAMEPAD)',
    connected: true,
    mapping: 'standard',
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: pressed.has(i),
      value: pressed.has(i) ? 1 : 0,
    })),
    axes,
  };
}

describe('menu navigation intents (spec 8.13)', () => {
  it('maps keys; up and down follow key repeat, confirm and back do not; Escape stays pause', () => {
    expect(menuIntentForKey('ArrowUp', false)).toBe('up');
    expect(menuIntentForKey('KeyW', true)).toBe('up');
    expect(menuIntentForKey('ArrowDown', true)).toBe('down');
    expect(menuIntentForKey('Enter', false)).toBe('confirm');
    expect(menuIntentForKey('Enter', true)).toBeNull();
    expect(menuIntentForKey('Space', false)).toBe('confirm');
    expect(menuIntentForKey('Backspace', false)).toBe('back');
    expect(menuIntentForKey('Escape', false)).toBeNull();
    expect(menuIntentForKey('KeyQ', false)).toBeNull();
  });

  it('the queue is bounded and drains once', () => {
    const q = new MenuIntentQueue();
    for (let i = 0; i < 20; i += 1) q.push('down');
    expect(q.take()).toHaveLength(8);
    expect(q.take()).toEqual([]);
  });

  it('keyboard: menu keys are handled (default prevented) and Space still jumps in play', () => {
    const kb = new KeyboardMouseControls();
    const router = new InputRouter([kb]);
    expect(kb.keyDown('ArrowUp', false, 0)).toBe(true);
    expect(kb.keyDown('Enter', false, 0)).toBe(true);
    expect(kb.keyDown('Space', false, 0)).toBe(true);
    expect(kb.menu.take()).toEqual(['up', 'confirm', 'confirm']);
    expect(router.nextFrame().held & Button.Jump).toBe(Button.Jump);
    kb.keyDown('ArrowDown', false, 0);
    router.releaseAll();
    expect(kb.menu.take()).toEqual([]);
  });

  it('gamepad: one intent per press, stick steps with hysteresis, A confirms, B goes back', () => {
    const g = new GamepadControls();
    g.poll([pad([PadButton.DpadDown])], 0);
    g.poll([pad([PadButton.DpadDown])], 16);
    g.poll([pad()], 32);
    g.poll([pad([PadButton.DpadUp])], 48);
    expect(g.menu.take()).toEqual(['down', 'up']);

    g.poll([pad([], [0, 0.7, 0, 0])], 64);
    g.poll([pad([], [0, 0.45, 0, 0])], 80); // still above the release threshold: no new step
    g.poll([pad([], [0, 0.7, 0, 0])], 96);
    g.poll([pad([], [0, 0.1, 0, 0])], 112);
    g.poll([pad([], [0, 0.7, 0, 0])], 128);
    expect(g.menu.take()).toEqual(['down', 'down']);

    g.poll([pad([PadButton.South])], 144);
    g.poll([pad([PadButton.East])], 160);
    g.poll([pad([PadButton.Start])], 176);
    expect(g.menu.take()).toEqual(['confirm', 'back']);
    expect(g.takePause()).toBe(true);
  });

  it('gamepad: a button held while the menu opens does not fire', () => {
    const g = new GamepadControls();
    g.poll([pad([PadButton.South])], 0);
    g.releaseAll(); // the menu opens: queued intents are dropped
    g.poll([pad([PadButton.South])], 16);
    expect(g.menu.take()).toEqual([]);
  });
});
