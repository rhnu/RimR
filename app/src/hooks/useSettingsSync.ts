import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { rimrClient } from '@/commands';
import type { AppConfig } from '@/commands';
import { useAppConfig, queryKeys } from '@/hooks/commands';
import { useThemeStore } from '@/stores/theme';
import { useLocaleStore } from '@/stores/locale';
import { createSettingsSyncController, type SyncController } from '@/lib/settingsSync';

export function useSettingsSync(): void {
  const queryClient = useQueryClient();
  const appConfig = useAppConfig();
  const backendRef = useRef<AppConfig | null>(null);
  backendRef.current = appConfig.data ?? null;

  const controllerRef = useRef<SyncController | null>(null);
  if (controllerRef.current == null) {
    controllerRef.current = createSettingsSyncController({
      getTheme: () => useThemeStore.getState().theme,
      setTheme: (theme) => useThemeStore.getState().setTheme(theme),
      getLocale: () => useLocaleStore.getState().locale,
      setLocale: (locale) => useLocaleStore.getState().setLocale(locale),
      getBackend: () => {
        const cfg = backendRef.current;
        return cfg ? { theme: cfg.ui.theme, locale: cfg.ui.locale } : null;
      },
      save: async (prefs) => {
        const current = backendRef.current;
        if (current == null) return;
        const next: AppConfig = {
          ...current,
          ui: { theme: prefs.theme, locale: prefs.locale },
        };
        const result = await rimrClient.saveAppConfig(next);
        if (result.isErr()) {
          toast.error(i18n.t('toast.preferencesSyncFailed'));
          throw result.error;
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.appConfig });
      },
    });
  }

  useEffect(() => {
    const controller = controllerRef.current;
    if (controller == null) return;
    const unsubTheme = useThemeStore.subscribe(() => controller.notifyClientChange());
    const unsubLocale = useLocaleStore.subscribe(() => controller.notifyClientChange());
    return () => {
      unsubTheme();
      unsubLocale();
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.notifyBackendChange();
  }, [appConfig.data]);

  useEffect(() => {
    return () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, []);
}
