import { en } from './en';

export type TranslationKey = keyof typeof en;
export type Messages = Partial<Record<TranslationKey, string>>;
export type Catalogues = Record<string, Messages>;
export type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

// Register future language catalogues here. Missing entries fall back to English.
export const catalogues: Catalogues = { en };

export function createI18n(requestedLocale: string, messages: Catalogues = catalogues) {
  let locale = 'en';
  try {
    let candidate = Intl.getCanonicalLocales(requestedLocale)[0] ?? 'en';
    while (candidate) {
      const match = Object.keys(messages).find((key) => key.toLowerCase() === candidate.toLowerCase());
      if (match) { locale = match; break; }
      candidate = candidate.split('-').slice(0, -1).join('-');
    }
  } catch { /* Invalid or unsupported locales use English. */ }
  const t: Translator = (key, values = {}) => (messages[locale]?.[key] ?? en[key])
    .replace(/\{(\w+)\}/g, (placeholder, name: string) => Object.hasOwn(values, name) ? String(values[name]) : placeholder);
  return { locale, t };
}

export const english = createI18n('en').t;
