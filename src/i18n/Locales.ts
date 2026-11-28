import en from '../../content/locale/en.json';
import { I18n, pseudoMessages, PSEUDO_LOCALE, type Messages } from './I18n';

/** Languages players can pick (spec 8.6 Language: English, more later). */
export const SUPPORTED_LANGUAGES = ['en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const ENGLISH: Messages = en;

/**
 * The locale to use: an explicit test override (`?lang=en-XA`), the player's choice, or the first
 * device language we support, else English.
 */
export function resolveLocale(
  chosen: Language | null,
  deviceLanguages: readonly string[],
  override: string | null = null,
): string {
  if (override === PSEUDO_LOCALE) return PSEUDO_LOCALE;
  if (override !== null && (SUPPORTED_LANGUAGES as readonly string[]).includes(override)) return override;
  if (chosen !== null) return chosen;
  for (const tag of deviceLanguages) {
    const base = tag.toLowerCase().split('-')[0] ?? '';
    if ((SUPPORTED_LANGUAGES as readonly string[]).includes(base)) return base;
  }
  return 'en';
}

export function createTranslator(locale: string, onMissing?: (key: string) => void): I18n {
  const messages = locale === PSEUDO_LOCALE ? pseudoMessages(ENGLISH) : ENGLISH;
  return new I18n(locale, messages, { fallback: ENGLISH, ...(onMissing ? { onMissing } : {}) });
}
