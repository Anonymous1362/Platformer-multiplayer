import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../content/locale/en.json';
import {
  I18n,
  pseudoLocalize,
  pseudoMessages,
  PSEUDO_CLOSE,
  PSEUDO_LOCALE,
  PSEUDO_OPEN,
} from '../../src/i18n/I18n';
import { createTranslator, ENGLISH, resolveLocale } from '../../src/i18n/Locales';

/** Spec 8.11: stable keys, placeholders, Intl plurals and numbers, the en-XA pseudo-locale. */

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

const SRC = new URL('../../src', import.meta.url).pathname;
const files = sourceFiles(SRC).filter((f) => !f.includes('/gallery/'));
const code = files.map((f) => readFileSync(f, 'utf8')).join('\n');

/** Keys used as string literals: t('a.b'), .t('a.b'), and key tables ('settings.tab.audio'). */
const usedKeys = new Set<string>();
for (const m of code.matchAll(
  /['"]((?:common|notice|title|pause|settings|level|error|safe|webgl|touch)\.[A-Za-z0-9.]+)['"]/g,
)) {
  if (m[1]) usedKeys.add(m[1]);
}

describe('locale files', () => {
  const keys = Object.keys(en);

  it('every key used in the code exists in en.json', () => {
    expect([...usedKeys].filter((k) => !keys.includes(k)).sort()).toEqual([]);
  });

  it('every key in en.json is used (no dead strings)', () => {
    expect(keys.filter((k) => !usedKeys.has(k)).sort()).toEqual([]);
  });

  it('plural messages have an "other" form; placeholders are well formed', () => {
    for (const [key, message] of Object.entries(ENGLISH)) {
      const texts = typeof message === 'string' ? [message] : Object.values(message);
      if (typeof message !== 'string') expect(message.other, key).toBeTypeOf('string');
      for (const text of texts) {
        expect(text, key).not.toMatch(/\{[^}]*$|\{\s*\}/);
      }
    }
  });
});

describe('translator', () => {
  const t = new I18n('en', {
    hello: 'Hello {name}',
    shards: { one: '{count} shard', other: '{count} shards' },
  });

  it('fills placeholders and picks plural forms with Intl.PluralRules', () => {
    expect(t.t('hello', { name: 'Kes' })).toBe('Hello Kes');
    expect(t.t('shards', { count: 1 })).toBe('1 shard');
    expect(t.t('shards', { count: 0 })).toBe('0 shards');
    expect(t.t('shards', { count: 12000 })).toBe('12,000 shards'); // Intl.NumberFormat
  });

  it('leaves unknown placeholders and reports a missing key once', () => {
    const missing: string[] = [];
    const m = new I18n('en', { a: 'x {y}' }, { onMissing: (k) => missing.push(k) });
    expect(m.t('a')).toBe('x {y}');
    expect(m.t('nope')).toBe('nope');
    m.t('nope');
    expect(missing).toEqual(['nope']);
  });

  it('falls back to English for a key a language lacks', () => {
    const fr = new I18n('fr', {}, { fallback: { a: 'English A' } });
    expect(fr.t('a')).toBe('English A');
  });
});

describe('pseudo-locale (en-XA)', () => {
  it('accents letters, keeps placeholders, marks both ends, and is at least 35% longer', () => {
    const text = 'Restart level {count}';
    const p = pseudoLocalize(text);
    expect(p.startsWith(PSEUDO_OPEN) && p.endsWith(PSEUDO_CLOSE)).toBe(true);
    expect(p).toContain('{count}');
    expect(p.replace(/\{\w+\}/g, '')).not.toMatch(/[A-Za-z]{4,}/); // no plain English words survive
    expect(p.length).toBeGreaterThanOrEqual(Math.ceil(text.length * 1.35));
  });

  it('transforms every message, plural forms included', () => {
    const pseudo = pseudoMessages(ENGLISH);
    for (const [key, message] of Object.entries(pseudo)) {
      const texts = typeof message === 'string' ? [message] : Object.values(message);
      for (const text of texts) expect(text.startsWith(PSEUDO_OPEN), key).toBe(true);
    }
    const t = createTranslator(PSEUDO_LOCALE);
    expect(t.t('level.complete', { count: 3 })).toContain('3');
  });
});

describe('locale resolution', () => {
  it('player choice, then device language, then English; en-XA only by override', () => {
    expect(resolveLocale('en', ['fr-FR'])).toBe('en');
    expect(resolveLocale(null, ['en-GB'])).toBe('en');
    expect(resolveLocale(null, ['fr-FR', 'de'])).toBe('en');
    expect(resolveLocale(null, ['de'], 'en-XA')).toBe('en-XA');
    expect(resolveLocale(null, ['de'], 'xx')).toBe('en');
  });
});
