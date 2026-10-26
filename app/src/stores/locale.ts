import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n, { type Locale, DEFAULT_LOCALE, SUPPORTED_LOCALES, getInitialLocale } from '@/i18n';

type LocaleState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const SUPPORTED_LOCALES_LIST = SUPPORTED_LOCALES;

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: getInitialLocale(),
      setLocale: (locale) => {
        void i18n.changeLanguage(locale);
        set({ locale });
      },
    }),
    {
      name: 'rimr-locale',
      onRehydrateStorage: () => (state) => {
        if (state) {
          void i18n.changeLanguage(state.locale);
        }
      },
    },
  ),
);

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export { DEFAULT_LOCALE };
export type { Locale };
