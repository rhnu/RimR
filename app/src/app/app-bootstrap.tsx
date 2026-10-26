import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { rimrClient, windowClient, type UiConfig } from '@/commands';
import { Button } from '@/components/ui/button';
import { Splash } from '@/components/splash';
import { formatRimrError } from '@/commands/errors';
import { readQuery } from '@/queries/client';
import { queryKeys } from '@/queries/keys';
import { useLocaleStore } from '@/stores/locale';
import { useThemeStore } from '@/stores/theme';

export function AppBootstrap({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [prepared, setPrepared] = useState(false);
  const bootstrap = useQuery({
    queryKey: queryKeys.bootstrap,
    queryFn: ({ signal }) => readQuery(rimrClient.getBootstrapStatus(), signal),
    staleTime: Infinity,
  });
  useEffect(() => {
    if (bootstrap.data?.status !== 'ready') return;
    adoptImportedPreferences(bootstrap.data.importedPreferences);
    client.setQueryData(queryKeys.appConfig, bootstrap.data.config);
    setPrepared(true);
  }, [bootstrap.data, client]);

  if (bootstrap.isError) {
    return (
      <StartupFailure
        message={formatRimrError(bootstrap.error).title}
        onRetry={() => void bootstrap.refetch()}
      />
    );
  }
  if (bootstrap.data?.status === 'recoveryRequired') {
    const error = bootstrap.data.error;
    return <StartupFailure message={error.message} path={error.path ?? undefined} />;
  }
  if (!prepared) return <Splash message={t('common.loadingRimr')} className="h-screen" />;
  return children;
}

/** Existing frontend preferences take precedence over the one-time legacy handoff. */
function adoptImportedPreferences(preferences: UiConfig | null): void {
  if (!preferences) return;
  if (preferences.theme && localStorage.getItem('rimr-theme') === null) {
    useThemeStore.getState().setTheme(preferences.theme);
  }
  if (preferences.locale && localStorage.getItem('rimr-locale') === null) {
    useLocaleStore.getState().setLocale(preferences.locale);
  }
}

function StartupFailure({
  message,
  path,
  onRetry,
}: {
  message: string;
  path?: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <main className="flex h-screen items-center justify-center p-6">
      <section className="max-w-xl space-y-3 text-sm" role="alert">
        <h1 className="font-semibold">{t('bootstrap.failed')}</h1>
        <p>{message}</p>
        {path ? <p className="break-all text-muted-foreground">{path}</p> : null}
        <p className="text-muted-foreground">{t('bootstrap.recovery')}</p>
        <div className="flex gap-2">
          {onRetry ? <Button onClick={onRetry}>{t('common.retry')}</Button> : null}
          <Button variant="outline" onClick={() => void windowClient.close()}>
            {t('window.close')}
          </Button>
        </div>
      </section>
    </main>
  );
}
