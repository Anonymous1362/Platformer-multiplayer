/**
 * Rebindable controls (spec 8.9, 8.13, 14.4): a primary and an alternate key per keyboard action, and
 * per controller family a primary and an alternate button per action (W3C standard-mapping indexes).
 * Pure data and helpers; the adapters apply them and the settings layer stores them.
 */

export const KEY_ACTIONS = [
  'left',
  'right',
  'down',
  'jump',
  'shoot',
  'dash',
  'parry',
  'gadget',
  'pause',
] as const;
export type KeyAction = (typeof KEY_ACTIONS)[number];

export const PAD_ACTIONS = ['jump', 'shoot', 'dash', 'parry', 'gadget', 'pause'] as const;
export type PadAction = (typeof PAD_ACTIONS)[number];

export const PAD_FAMILIES = ['xbox', 'playstation', 'nintendo', 'generic'] as const;
export type PadFamily = (typeof PAD_FAMILIES)[number];

/** [primary, alternate]; null is an empty slot. */
export type Slots<T> = readonly [T | null, T | null];
export type KeyBindings = Readonly<Record<KeyAction, Slots<string>>>;
export type PadBindings = Readonly<Record<PadAction, Slots<number>>>;

/** Spec 8.9: the keyboard-and-mouse column first, the keyboard-only column second. */
export const DEFAULT_KEYS: KeyBindings = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  down: ['KeyS', 'ArrowDown'],
  jump: ['Space', 'KeyZ'],
  shoot: ['KeyX', null],
  dash: ['ShiftLeft', 'KeyC'],
  parry: ['KeyV', null],
  gadget: ['KeyE', 'KeyB'],
  pause: ['Escape', 'KeyP'],
};

/** Standard-mapping indexes (spec 8.9 gamepad column): A jump, X or RT shoot, B dash, RB parry, Y gadget. */
export const DEFAULT_PAD: PadBindings = {
  jump: [0, null],
  shoot: [2, 7],
  dash: [1, null],
  parry: [5, null],
  gadget: [3, null],
  pause: [9, null],
};

export const DEFAULT_PAD_BY_FAMILY: Readonly<Record<PadFamily, PadBindings>> = {
  xbox: DEFAULT_PAD,
  playstation: DEFAULT_PAD,
  nintendo: DEFAULT_PAD,
  generic: DEFAULT_PAD,
};

/** Keys that can never be bound: Tab moves focus, the OS keys belong to the OS. */
/**
 * Keys that can never be bound: Tab moves focus; Ctrl, Alt, and the OS keys are left to the browser
 * and OS (modified key presses are never handled, spec 8.13).
 */
const RESERVED = new Set([
  'Tab',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
  'ContextMenu',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
]);

/** Both Shift (Control, Alt) keys count as one binding, as in Pass 1D. */
export function normalizeCode(code: string): string {
  if (code === 'ShiftRight') return 'ShiftLeft';
  return code;
}

export function isBindableCode(code: string): boolean {
  return code.length > 0 && !RESERVED.has(code);
}

/** The controller family from `Gamepad.id` (spec 8.13), for glyphs and per-family bindings. */
export function padFamily(id: string): PadFamily {
  const s = id.toLowerCase();
  if (/xbox|xinput|045e/.test(s)) return 'xbox';
  if (/playstation|dualshock|dualsense|sony|054c/.test(s)) return 'playstation';
  if (/nintendo|switch|joy-?con|pro controller|057e/.test(s)) return 'nintendo';
  return 'generic';
}

/** Every action whose slots share an input with another action: action → the other actions. */
export function conflicts<A extends string, T>(bindings: Readonly<Record<A, Slots<T>>>): Map<A, A[]> {
  const byInput = new Map<T, A[]>();
  for (const [action, slots] of Object.entries(bindings) as [A, Slots<T>][]) {
    for (const input of slots) {
      if (input === null) continue;
      const list = byInput.get(input) ?? [];
      if (!list.includes(action)) list.push(action);
      byInput.set(input, list);
    }
  }
  const out = new Map<A, A[]>();
  for (const actions of byInput.values()) {
    if (actions.length < 2) continue;
    for (const a of actions) {
      const others = new Set([...(out.get(a) ?? []), ...actions.filter((b) => b !== a)]);
      out.set(a, [...others]);
    }
  }
  return out;
}

/** Puts `input` into one slot (the other slot keeps its value; an identical other slot is cleared). */
export function bind<A extends string, T>(
  bindings: Readonly<Record<A, Slots<T>>>,
  action: NoInfer<A>,
  slot: 0 | 1,
  input: T | null,
): Readonly<Record<A, Slots<T>>> {
  const current = bindings[action];
  const other = current[slot === 0 ? 1 : 0];
  const keepOther = input !== null && other === input ? null : other;
  const next: Slots<T> = slot === 0 ? [input, keepOther] : [keepOther, input];
  return { ...bindings, [action]: next };
}
