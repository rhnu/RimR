import { useEffect } from 'react';
import { applyThemeClass, useThemeStore } from '@/stores/theme';

export function ThemeBootstrap() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    applyThemeClass(theme);

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => applyThemeClass('system');
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
  }, [theme]);

  return null;
}
