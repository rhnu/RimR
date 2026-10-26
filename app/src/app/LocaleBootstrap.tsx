import { useEffect } from 'react';
import i18n from '@/i18n';
import { useLocaleStore } from '@/stores/locale';

export function LocaleBootstrap() {
  const locale = useLocaleStore((s) => s.locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const onChange = (lng: string) => {
      document.documentElement.lang = lng;
    };
    i18n.on('languageChanged', onChange);
    return () => {
      i18n.off('languageChanged', onChange);
    };
  }, []);

  return null;
}
