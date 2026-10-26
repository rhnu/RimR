import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Locale } from '@/commands';
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

export type { Locale };

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'zh-CN'];
export const DEFAULT_LOCALE: Locale = 'en';

function detectLocale(): Locale {
  if (typeof navigator !== 'undefined') {
    const langs = [...navigator.languages, navigator.language];
    for (const lang of langs) {
      if (!lang) continue;
      if (lang.toLowerCase().startsWith('zh')) return 'zh-CN';
      if (lang.toLowerCase().startsWith('en')) return 'en';
    }
  }
  return DEFAULT_LOCALE;
}

function readStoredLocale(): Locale | null {
  try {
    const raw = localStorage.getItem('rimr-locale');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { locale?: unknown } };
    const value = parsed.state?.locale;
    if (typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)) {
      return value as Locale;
    }
  } catch {
    // ignore malformed storage
  }
  return null;
}

export function getInitialLocale(): Locale {
  return readStoredLocale() ?? detectLocale();
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-CN': { translation: zhCN },
  },
  lng: getInitialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
