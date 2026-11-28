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
      switch (intent) {
        case 'up':
        case 'down':
          items[stepIndex(items.length, current, intent)]?.focus();
          break;
        case 'confirm':
          (items[current] ?? items[0])?.click();
          break;
        case 'back':
          top.onBack?.();
          break;
        case 'left':
        case 'right':
          if (active instanceof HTMLElement && top.root.contains(active))
            adjust(active, intent === 'right' ? 1 : -1);
          break;
        case 'prevTab':
        case 'nextTab':
          switchTab(top.root, intent === 'nextTab' ? 1 : -1);
          break;
      }
    }
  }
}

/**
 * Left/right on the focused control (spec 8.13 controller menus): a slider steps its value, a radio
 * group or tab list moves its choice. Native keyboard arrows already do this; this is the pad path.
 */
function adjust(el: HTMLElement, dir: 1 | -1): void {
  if (el instanceof HTMLInputElement && el.type === 'range') {
    const step = Number(el.step) || 1;
    const min = Number(el.min);
    const max = Number(el.max);
    const next = Math.min(max, Math.max(min, Number(el.value) + dir * step));
    if (next === Number(el.value)) return;
    el.value = String(next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const group = el.closest('[role="radiogroup"], [role="tablist"]');
  if (!group) return;
  const role = group.getAttribute('role') === 'tablist' ? 'tab' : 'radio';
  const options = [...group.querySelectorAll<HTMLElement>(`[role="${role}"]`)];
  const i = options.indexOf(el);
  const target = options[Math.min(options.length - 1, Math.max(0, i + dir))];
  if (target && target !== el) {
    target.click();
    target.focus();
  }
}

/** The bumpers switch tabs in the topmost scope's first tab list. */
function switchTab(root: HTMLElement, dir: 1 | -1): void {
  const tabs = [...root.querySelectorAll<HTMLElement>('[role="tablist"] [role="tab"]')];
  if (tabs.length === 0) return;
  const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  const target = tabs[(Math.max(0, i) + dir + tabs.length) % tabs.length];
  target?.click();
  target?.focus();
}
