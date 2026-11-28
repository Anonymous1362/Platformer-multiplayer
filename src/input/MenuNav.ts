/**
 * Menu navigation, kept apart from gameplay input (spec 8.13): keyboard and gamepad presses become
 * edge-triggered intents that a menu drains once per frame. Escape and Start stay the pause toggle, so
 * they are not intents here. Touch and mouse use the menu's own buttons.
 */
export type MenuIntent = 'up' | 'down' | 'left' | 'right' | 'prevTab' | 'nextTab' | 'confirm' | 'back';

const MAX_QUEUED = 8;

/** Keyboard codes that navigate menus. */
export const MENU_KEYS: Readonly<Record<string, MenuIntent>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  Backspace: 'back',
};

/** Up and down follow OS key repeat while held; confirm and back fire once per press. */
const REPEATING: ReadonlySet<MenuIntent> = new Set<MenuIntent>(['up', 'down', 'left', 'right']);

export function menuIntentForKey(code: string, repeat: boolean): MenuIntent | null {
  const intent = MENU_KEYS[code];
  if (intent === undefined || (repeat && !REPEATING.has(intent))) return null;
  return intent;
}

/** A small bounded queue: intents nobody drains never pile up. */
export class MenuIntentQueue {
  private readonly items: MenuIntent[] = [];

  push(intent: MenuIntent): void {
    if (this.items.length < MAX_QUEUED) this.items.push(intent);
  }

  take(): MenuIntent[] {
    return this.items.splice(0);
  }

  clear(): void {
    this.items.length = 0;
  }
}

/** Left-stick thresholds for menu steps, with hysteresis so one push is one step. */
export const MENU_STICK = { press: 0.6, release: 0.3 } as const;
