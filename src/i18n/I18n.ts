/**
 * Localization (spec 8.11): every player-facing string lives in `content/locale/<lang>.json` under a
 * stable key. Placeholders like `{count}` are filled by `t`; plural forms use `Intl.PluralRules`; numbers
 * go through `Intl.NumberFormat`. No string concatenation in callers.
 */

/** A message: plain text, or one text per plural category (`one`, `other`, ...). */
export type Message = string | Readonly<Partial<Record<Intl.LDMLPluralRule, string>>>;
export type Messages = Readonly<Record<string, Message>>;
export type Params = Readonly<Record<string, string | number>>;

/** The pseudo-locale (accented and 35% longer) used by the overflow screenshot tests. */
export const PSEUDO_LOCALE = 'en-XA';

const ACCENTS: Readonly<Record<string, string>> = {
  a: 'á',
  b: 'ƀ',
  c: 'ç',
  d: 'ð',
  e: 'é',
  f: 'ƒ',
  g: 'ĝ',
  h: 'ĥ',
  i: 'í',
  j: 'ĵ',
  k: 'ķ',
  l: 'ļ',
  m: 'ɱ',
  n: 'ñ',
  o: 'ó',
  p: 'þ',
  q: 'ǫ',
  r: 'ŕ',
  s: 'š',
  t: 'ţ',
  u: 'ú',
  v: 'ṽ',
  w: 'ŵ',
  x: 'ẋ',
  y: 'ý',
  z: 'ž',
  A: 'Á',
  B: 'Ɓ',
  C: 'Ç',
  D: 'Ð',
  E: 'É',
  F: 'Ƒ',
  G: 'Ĝ',
  H: 'Ĥ',
  I: 'Í',
  J: 'Ĵ',
  K: 'Ķ',
  L: 'Ļ',
  M: 'Ṁ',
  N: 'Ñ',
  O: 'Ó',
  P: 'Þ',
  Q: 'Ǫ',
  R: 'Ŕ',
  S: 'Š',
  T: 'Ţ',
  U: 'Ú',
  V: 'Ṽ',
  W: 'Ŵ',
  X: 'Ẋ',
  Y: 'Ý',
  Z: 'Ž',
};

/** Start and end marks of pseudo-localized text: a visible string without them was never translated. */
export const PSEUDO_OPEN = '⟦';
export const PSEUDO_CLOSE = '⟧';

/**
 * Accents every letter, pads the text to about 135% of its length, and wraps it in ⟦…⟧. Placeholders
 * (`{name}`) are left intact so they still fill.
 */
export function pseudoLocalize(text: string): string {
  let out = '';
  let letters = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (ch === '{') {
      const end = text.indexOf('}', i);
      if (end > i) {
        out += text.slice(i, end + 1);
        i = end;
        continue;
      }
    }
    out += ACCENTS[ch] ?? ch;
    if (/[A-Za-z]/.test(ch)) letters += 1;
  }
  const pad = Math.ceil(text.length * 0.35);
  const filler = '·~'.repeat(Math.ceil(pad / 2)).slice(0, Math.max(letters > 0 ? 2 : 0, pad));
  return `${PSEUDO_OPEN}${out}${filler ? ` ${filler}` : ''}${PSEUDO_CLOSE}`;
}

export function pseudoMessages(messages: Messages): Messages {
  const out: Record<string, Message> = {};
  for (const [key, message] of Object.entries(messages)) {
    if (typeof message === 'string') out[key] = pseudoLocalize(message);
    else {
      const forms: Partial<Record<Intl.LDMLPluralRule, string>> = {};
      for (const [form, text] of Object.entries(message) as [Intl.LDMLPluralRule, string][]) {
        forms[form] = pseudoLocalize(text);
      }
      out[key] = forms;
    }
  }
  return out;
}

export interface Translator {
  readonly locale: string;
  /** The text for `key` with `{placeholders}` filled; `count` picks the plural form. */
  t(key: string, params?: Params): string;
  number(value: number, options?: Intl.NumberFormatOptions): string;
}

export class I18n implements Translator {
  readonly locale: string;
  private readonly messages: Messages;
  private readonly fallback: Messages;
  private readonly plural: Intl.PluralRules;
  private readonly numbers = new Map<string, Intl.NumberFormat>();
  private readonly onMissing: (key: string) => void;
  private readonly reported = new Set<string>();

  constructor(
    locale: string,
    messages: Messages,
    options: { readonly fallback?: Messages; readonly onMissing?: (key: string) => void } = {},
  ) {
    this.locale = locale;
    this.messages = messages;
    this.fallback = options.fallback ?? {};
    this.onMissing = options.onMissing ?? (() => undefined);
    // The pseudo-locale keeps English number and plural rules.
    const intlLocale = locale === PSEUDO_LOCALE ? 'en' : locale;
    this.plural = new Intl.PluralRules(intlLocale);
    this.numbers.set('', new Intl.NumberFormat(intlLocale));
  }

  t(key: string, params: Params = {}): string {
    const message = this.messages[key] ?? this.fallback[key];
    if (message === undefined) {
      if (!this.reported.has(key)) {
        this.reported.add(key);
        this.onMissing(key);
      }
      return key;
    }
    let text: string;
    if (typeof message === 'string') text = message;
    else {
      const count = typeof params['count'] === 'number' ? params['count'] : 0;
      text = message[this.plural.select(count)] ?? message.other ?? '';
    }
    return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
      const value = params[name];
      if (value === undefined) return whole;
      return typeof value === 'number' ? this.number(value) : value;
    });
  }

  number(value: number, options?: Intl.NumberFormatOptions): string {
    const key = options ? JSON.stringify(options) : '';
    let format = this.numbers.get(key);
    if (!format) {
      format = new Intl.NumberFormat(this.locale === PSEUDO_LOCALE ? 'en' : this.locale, options);
      this.numbers.set(key, format);
    }
    return format.format(value);
  }
}
