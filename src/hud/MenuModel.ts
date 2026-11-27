import type { MenuIntent } from '../input/MenuNav';

export type MenuAction<T extends string> =
  | { readonly type: 'moved'; readonly index: number }
  | { readonly type: 'activate'; readonly id: T }
  | { readonly type: 'back' };

/**
 * Selection state for a vertical menu (spec 8.13): up and down wrap around, confirm activates the
 * selected item, back leaves. Pointer hover and keyboard focus set the selection directly, so the item
 * that confirm activates is always the one shown as selected.
 */
export class MenuModel<T extends string> {
  readonly items: readonly [T, ...T[]];
  private index: number;

  constructor(items: readonly [T, ...T[]], initial = 0) {
    this.items = items;
    this.index = Math.min(Math.max(0, initial), items.length - 1);
  }

  get selected(): number {
    return this.index;
  }

  select(index: number): void {
    if (index >= 0 && index < this.items.length) this.index = index;
  }

  apply(intent: MenuIntent): MenuAction<T> {
    const n = this.items.length;
    switch (intent) {
      case 'up':
        this.index = (this.index - 1 + n) % n;
        return { type: 'moved', index: this.index };
      case 'down':
        this.index = (this.index + 1) % n;
        return { type: 'moved', index: this.index };
      case 'confirm':
        return { type: 'activate', id: this.items[this.index] ?? this.items[0] };
      case 'back':
        return { type: 'back' };
    }
  }
}
