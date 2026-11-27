import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../src/ui/nav';
import { glassAllowed, resolveReducedMotion, UiPrefs } from '../../src/ui/prefs';
import { Store } from '../../src/ui/store';

describe('menu focus stepping', () => {
  it('wraps both ways', () => {
    expect(stepIndex(3, 0, 'down')).toBe(1);
    expect(stepIndex(3, 2, 'down')).toBe(0);
    expect(stepIndex(3, 0, 'up')).toBe(2);
    expect(stepIndex(3, 1, 'up')).toBe(0);
  });

  it('starts at the first item going down and the last going up when nothing is focused', () => {
    expect(stepIndex(4, -1, 'down')).toBe(0);
    expect(stepIndex(4, -1, 'up')).toBe(3);
    expect(stepIndex(4, 9, 'down')).toBe(0);
  });

  it('an empty list has no selection', () => {
    expect(stepIndex(0, -1, 'down')).toBe(-1);
  });
});

describe('UI preferences', () => {
  it('reduced motion follows the system unless forced', () => {
    expect(resolveReducedMotion('system', true)).toBe(true);
    expect(resolveReducedMotion('system', false)).toBe(false);
    expect(resolveReducedMotion('on', false)).toBe(true);
    expect(resolveReducedMotion('off', true)).toBe(false);
  });

  it('glass needs a tier above Battery, no Safe Mode, no high contrast', () => {
    expect(glassAllowed('balanced', false, false)).toBe(true);
    expect(glassAllowed('high', false, false)).toBe(true);
    expect(glassAllowed('battery', false, false)).toBe(false);
    expect(glassAllowed('high', true, false)).toBe(false);
    expect(glassAllowed('high', false, true)).toBe(false);
  });

  it('patches notify subscribers once per change', () => {
    const prefs = new UiPrefs();
    let calls = 0;
    prefs.state.subscribe(() => {
      calls += 1;
    });
    prefs.patch({ motionMode: 'on' });
    expect(prefs.reduced).toBe(true);
    expect(calls).toBe(1);
  });
});

describe('store', () => {
  it('ignores identical values and unsubscribes', () => {
    const store = new Store(1);
    let calls = 0;
    const off = store.subscribe(() => {
      calls += 1;
    });
    store.set(1);
    store.set(2);
    off();
    store.set(3);
    expect(calls).toBe(1);
    expect(store.get()).toBe(3);
  });
});
