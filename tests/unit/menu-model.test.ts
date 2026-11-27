import { describe, expect, it } from 'vitest';
import { MenuModel } from '../../src/hud/MenuModel';

describe('menu selection (spec 8.13)', () => {
  it('up and down wrap around; confirm activates the selected item; back leaves', () => {
    const m = new MenuModel(['resume', 'restart'] as const);
    expect(m.selected).toBe(0);
    expect(m.apply('down')).toEqual({ type: 'moved', index: 1 });
    expect(m.apply('down')).toEqual({ type: 'moved', index: 0 });
    expect(m.apply('up')).toEqual({ type: 'moved', index: 1 });
    expect(m.apply('confirm')).toEqual({ type: 'activate', id: 'restart' });
    expect(m.apply('back')).toEqual({ type: 'back' });
  });

  it('pointer or focus selection sets the item that confirm activates', () => {
    const m = new MenuModel(['a', 'b', 'c'] as const, 2);
    expect(m.selected).toBe(2);
    m.select(0);
    expect(m.apply('confirm')).toEqual({ type: 'activate', id: 'a' });
    m.select(9);
    expect(m.selected).toBe(0);
  });
});
