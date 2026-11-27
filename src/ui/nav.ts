import type { MenuIntent } from '../input/MenuNav';

/** Index after moving one step up or down a list of `count` items; wraps; starts at the ends. */
export function stepIndex(count: number, current: number, intent: 'up' | 'down'): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return intent === 'down' ? 0 : count - 1;
  return (current + (intent === 'down' ? 1 : -1) + count) % count;
}

export const NAV_SELECTOR = '[data-nav]:not(:disabled):not([aria-disabled="true"])';

export interface NavScope {
  readonly root: HTMLElement;
  /** Called for a `back` intent; omit to ignore it. */
  readonly onBack?: (() => void) | undefined;
}

/**
 * Keyboard and gamepad navigation over the topmost scope (spec 8.13): up and down move focus through
 * the scope's `[data-nav]` elements in document order, confirm clicks the focused one, back leaves.
 */
export class NavStack {
  private readonly scopes: NavScope[] = [];

  push(scope: NavScope): () => void {
    this.scopes.push(scope);
    return () => {
      const i = this.scopes.indexOf(scope);
      if (i >= 0) this.scopes.splice(i, 1);
    };
  }

  get top(): NavScope | null {
    return this.scopes[this.scopes.length - 1] ?? null;
  }

  get size(): number {
    return this.scopes.length;
  }

  /** The topmost scope's items. */
  items(): HTMLElement[] {
    const top = this.top;
    return top ? [...top.root.querySelectorAll<HTMLElement>(NAV_SELECTOR)] : [];
  }

  handle(intents: readonly MenuIntent[]): void {
    for (const intent of intents) {
      const top = this.top;
      if (!top) return;
      const items = this.items();
      const active = top.root.ownerDocument.activeElement;
      const current = active instanceof HTMLElement ? items.indexOf(active) : -1;
      if (intent === 'up' || intent === 'down') {
        items[stepIndex(items.length, current, intent)]?.focus();
      } else if (intent === 'confirm') {
        (items[current] ?? items[0])?.click();
      } else {
        top.onBack?.();
      }
    }
  }
}
