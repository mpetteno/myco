import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { catalogues, createI18n } from './i18n';
import type { Catalogues } from './i18n';

const I18nContext = createContext(createI18n('en'));

export function I18nProvider({ children, locale, messages = catalogues }: {
  children: ReactNode; locale?: string; messages?: Catalogues;
}) {
  const language = locale ?? (typeof navigator === 'undefined' ? 'en' : navigator.language);
  const value = useMemo(() => createI18n(language, messages), [language, messages]);
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = value.locale;
    return () => { document.documentElement.lang = previous; };
  }, [value.locale]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export const useI18n = () => useContext(I18nContext);
