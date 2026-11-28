import { describe, expect, it } from 'vitest';
import {
  buildLayout,
  classicLayout,
  hitTest,
  layoutProfile,
  overrideFromPoint,
  presetAutoFire,
} from '../../src/input/TouchLayout';
import { parseLayouts, TOUCH_LAYOUTS_KEY, TouchLayoutStore } from '../../src/settings/TouchLayoutStore';
import type { SettingsStorage } from '../../src/settings/SettingsStore';

const W = 844;
const H = 390;
const at = (layout: ReturnType<typeof buildLayout>, role: string) =>
  layout.buttons.find((b) => b.role === role);

describe('touch presets (spec 8.8)', () => {
  it('Classic equals the Pass 1D layout', () => {
    expect(buildLayout(W, H, { preset: 'classic' })).toEqual(classicLayout(W, H));
    expect(at(buildLayout(W, H), 'jump')).toMatchObject({ cx: W - 88, cy: H - 88, radius: 42 });
  });

  it('Simple hides Shoot and auto-fires', () => {
    const simple = buildLayout(W, H, { preset: 'simple' });
    expect(at(simple, 'shoot')).toBeUndefined();
    expect(presetAutoFire('simple')).toBe(true);
    expect(presetAutoFire('classic')).toBe(false);
  });

  it('Left-handed mirrors the buttons and the stick', () => {
    const left = buildLayout(W, H, { preset: 'leftHanded' });
    expect(at(left, 'jump')).toMatchObject({ cx: 88, cy: H - 88 });
    expect(left.stickZone.right).toBe(W);
    expect(left.stickZone.left).toBeCloseTo(W * 0.6);
    expect(hitTest(left, W - 20, H - 20)).toBe('move');
    expect(hitTest(left, 88, H - 88)).toBe('jump');
    // Pause stays top-right in every preset.
    expect(at(left, 'pause')?.cx).toBeGreaterThan(W - 60);
  });

  it('an edited control lands where it was dropped and keeps its size', () => {
    const o = overrideFromPoint('classic', W, H, 600, 250, 1.25);
    const layout = buildLayout(W, H, { preset: 'classic', custom: { buttons: { jump: o } } });
    expect(at(layout, 'jump')).toMatchObject({ cx: 600, cy: 250, radius: 42 * 1.25 });
    // The same edit on a bigger screen keeps its distance from the corner.
    const wide = buildLayout(W + 200, H, { preset: 'classic', custom: { buttons: { jump: o } } });
    expect(at(wide, 'jump')?.cx).toBe(800);
  });

  it('left-handed edits mirror back correctly', () => {
    const o = overrideFromPoint('leftHanded', W, H, 150, 300, 1);
    expect(
      at(buildLayout(W, H, { preset: 'leftHanded', custom: { buttons: { dash: o } } }), 'dash'),
    ).toMatchObject({
      cx: 150,
      cy: 300,
    });
  });

  it('controls stay inside the canvas whatever the saved offset', () => {
    const layout = buildLayout(W, H, {
      custom: { buttons: { jump: { x: 4000, y: 4000, scale: 1.5 } }, stick: { x: 4000, y: 0 } },
    });
    const jump = at(layout, 'jump');
    expect(jump?.cx).toBeGreaterThanOrEqual(jump?.radius ?? 0);
    expect(jump?.cy).toBeGreaterThanOrEqual(jump?.radius ?? 0);
    expect(layout.fixedStick.cx).toBeLessThanOrEqual(W - 64);
    expect(layout.fixedStick.cy).toBeLessThanOrEqual(H - 64);
  });

  it('profiles split by orientation and shape', () => {
    expect(layoutProfile(844, 390)).toBe('landscape-wide');
    expect(layoutProfile(1024, 768)).toBe('landscape');
    expect(layoutProfile(390, 844)).toBe('portrait');
  });
});

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

describe('saved layouts', () => {
  it('survive a restart (a new store reads them back) and reset per preset', () => {
    const storage = new MemoryStorage();
    const a = new TouchLayoutStore(storage);
    a.save('landscape-wide', 'classic', { buttons: { jump: { x: 300, y: 120, scale: 1.2 } } });
    a.save('landscape-wide', 'simple', { buttons: { dash: { x: 90, y: 90, scale: 1 } } });
    const b = new TouchLayoutStore(storage);
    expect(b.get('landscape-wide', 'classic')?.buttons.jump).toEqual({ x: 300, y: 120, scale: 1.2 });
    expect(b.get('portrait', 'classic')).toBeNull();
    b.reset('landscape-wide', 'classic');
    expect(new TouchLayoutStore(storage).get('landscape-wide', 'classic')).toBeNull();
    expect(new TouchLayoutStore(storage).get('landscape-wide', 'simple')).not.toBeNull();
  });

  it('drops bad entries on their own and never throws', () => {
    const parsed = parseLayouts({
      profiles: {
        landscape: { classic: { buttons: { jump: { x: 10, y: 10, scale: 9 } } }, simple: { buttons: {} } },
        'BAD KEY': { classic: { buttons: {} } },
        portrait: 'nope',
      },
    });
    expect(parsed['landscape']?.classic).toBeUndefined();
    expect(parsed['landscape']?.simple).toEqual({ buttons: {} });
    expect(Object.keys(parsed)).toEqual(['landscape']);
    for (const junk of [null, 1, 'x', [], { profiles: 3 }]) expect(parseLayouts(junk)).toEqual({});
    const storage = new MemoryStorage();
    storage.setItem(TOUCH_LAYOUTS_KEY, '{oops');
    expect(new TouchLayoutStore(storage).state.get()).toEqual({});
  });
});
