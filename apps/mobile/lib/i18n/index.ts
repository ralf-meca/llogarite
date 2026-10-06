import { createContext, useContext } from 'react';
import { en } from './en';
import { sq } from './sq';

export type Language = 'sq' | 'en';
export type TranslationKey = keyof typeof en;

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { en, sq };

export function translate(
  language: Language,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const template = DICTIONARIES[language][key];
  if (!params) {
    return template;
  }
  return Object.entries(params).reduce(
    (result, [paramKey, value]) => result.split(`{${paramKey}}`).join(String(value)),
    template,
  );
}

// The language the app is showing, for code that runs outside any component:
// the API layer throws its messages from plain functions, with no hook to ask.
let activeLanguage: Language = 'sq';

export function setActiveLanguage(language: Language): void {
  activeLanguage = language;
}

export function tr(key: TranslationKey, params?: Record<string, string | number>): string {
  return translate(activeLanguage, key, params);
}

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

export const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
