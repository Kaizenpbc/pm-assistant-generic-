import { create } from 'zustand';

type Translations = Record<string, any>;

interface LocaleState {
  locale: string;
  translations: Translations;
  setLocale: (locale: string) => void;
}

// Eager-load English as default
import en from '../i18n/en.json';

const loaders: Record<string, () => Promise<{ default: Translations }>> = {
  en: () => Promise.resolve({ default: en }),
  fr: () => import('../i18n/fr.json'),
  es: () => import('../i18n/es.json'),
};

export const useLocaleStore = create<LocaleState>((set) => {
  const stored = localStorage.getItem('pm-locale') || 'en';

  // Load initial locale
  if (stored !== 'en' && loaders[stored]) {
    loaders[stored]().then(m => set({ translations: m.default }));
  }

  return {
    locale: stored,
    translations: en,
    setLocale: (locale: string) => {
      localStorage.setItem('pm-locale', locale);
      const loader = loaders[locale];
      if (loader) {
        loader().then(m => set({ locale, translations: m.default }));
      } else {
        set({ locale, translations: en });
      }
    },
  };
});
