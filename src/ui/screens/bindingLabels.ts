import type { PadFamily } from '../../input/Bindings';
import type { TFunction } from '../context';

/** Display names for key codes (spec 8.11: every visible word is a translation key). */
const NAMED_KEYS: Readonly<Record<string, string>> = {
  Space: 'key.space',
  ShiftLeft: 'key.shift',
  Escape: 'key.escape',
  Enter: 'key.enter',
  NumpadEnter: 'key.enter',
  Backspace: 'key.backspace',
  ArrowLeft: 'key.arrowLeft',
  ArrowRight: 'key.arrowRight',
  ArrowUp: 'key.arrowUp',
  ArrowDown: 'key.arrowDown',
  CapsLock: 'key.capsLock',
  Delete: 'key.delete',
  Insert: 'key.insert',
  Home: 'key.home',
  End: 'key.end',
  PageUp: 'key.pageUp',
  PageDown: 'key.pageDown',
};

const SYMBOLS: Readonly<Record<string, string>> = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
};

export function keyLabel(code: string | null, t: TFunction): string {
  if (code === null) return t('bindings.empty');
  const named = NAMED_KEYS[code];
  if (named) return t(named);
  if (/^Key[A-Z]$/.test(code)) return t('key.char', { char: code.slice(3) });
  if (/^Digit\d$/.test(code)) return t('key.char', { char: code.slice(5) });
  if (/^Numpad\d$/.test(code)) return t('key.numpad', { char: code.slice(6) });
  const symbol = SYMBOLS[code];
  if (symbol) return t('key.char', { char: symbol });
  return t('key.char', { char: code });
}

/** Standard-mapping button glyphs per family (the D-pad and generic pads use words). */
const GLYPHS: Readonly<Record<Exclude<PadFamily, 'generic'>, readonly string[]>> = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS'],
  playstation: [
    'Cross',
    'Circle',
    'Square',
    'Triangle',
    'L1',
    'R1',
    'L2',
    'R2',
    'Create',
    'Options',
    'L3',
    'R3',
  ],
  nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'LS', 'RS'],
};

const DPAD_KEYS: Readonly<Record<number, string>> = {
  12: 'pad.dpadUp',
  13: 'pad.dpadDown',
  14: 'pad.dpadLeft',
  15: 'pad.dpadRight',
};

export function padLabel(family: PadFamily, button: number | null, t: TFunction): string {
  if (button === null) return t('bindings.empty');
  const dpad = DPAD_KEYS[button];
  if (dpad) return t(dpad);
  if (family === 'generic') return t('pad.generic', { n: button + 1 });
  const glyph = GLYPHS[family][button];
  return glyph ? t('pad.button', { name: glyph }) : t('pad.generic', { n: button + 1 });
}

export const FAMILY_KEYS: Readonly<Record<PadFamily, string>> = {
  xbox: 'pad.family.xbox',
  playstation: 'pad.family.playstation',
  nintendo: 'pad.family.nintendo',
  generic: 'pad.family.generic',
};

export const ACTION_KEYS: Readonly<Record<string, string>> = {
  left: 'action.left',
  right: 'action.right',
  down: 'action.down',
  jump: 'action.jump',
  shoot: 'action.shoot',
  dash: 'action.dash',
  parry: 'action.parry',
  gadget: 'action.gadget',
  pause: 'action.pause',
};
