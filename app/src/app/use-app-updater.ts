import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { updaterClient, logUpdate, updateErrorMessage } from '@/commands/updater-client';
import { supportsUpdateInstall } from '@/domain/updates';
import { useOpenReleasesPage } from '@/queries/app';
import { disposeUpdateCheck, useUpdateCheck } from '@/queries/updates';
import { installUpdate, type UpdateOperation } from './update-installation';

export type AppUpdaterState = {
  open: boolean;
  busy: boolean;
  desktop: boolean;
  operation: UpdateOperation;
  check: { status: 'checking' | 'idle' } | { status: 'failed'; message: string };
  available: { version: string; body?: string; canInstall: boolean } | null;
};

export type AppUpdater = {
  state: AppUpdaterState;
  check: () => void;
  install: () => void;
  setOpen: (open: boolean) => void;
  openReleasesPage: () => void;
};

async function checkForUpdate(
  refetch: ReturnType<typeof useUpdateCheck>['refetch'],
  automatic: boolean,
  show: () => void,
  t: TFunction,
): Promise<void> {
  logUpdate(`Checking for updates (${automatic ? 'startup' : 'manual'})`);
  const result = await refetch();
  if (result.error) {
    logUpdate(`Update check failed: ${updateErrorMessage(result.error)}`, true);
    return;
  }
  const update = result.data?.update;
  logUpdate(update ? `Version ${update.version} is available` : 'Application is up to date');
  if (automatic && update) {
    toast.info(t('updates.available', { version: update.version }), {
      id: 'app-update',
      duration: 12_000,
      action: { label: t('updates.view'), onClick: show },
    });
  }
}

function useUpdaterLifecycle(check: (automatic: boolean) => Promise<void>, desktop: boolean): void {
  const client = useQueryClient();
  const checkOnStartup = useEffectEvent(() => void check(true));
  useEffect(() => {
    if (!import.meta.env.DEV && desktop) checkOnStartup();
    return () => {
      disposeUpdateCheck(client);
      toast.dismiss('app-update');
    };
  }, [client, desktop]);
}

/** One controller serializes checks, downloads and installation for the entire app. */
export function useAppUpdater(): AppUpdater {
  const { t } = useTranslation();
  const client = useQueryClient();
  const query = useUpdateCheck();
  const openReleases = useOpenReleasesPage();
  const [open, setOpen] = useState(false);
  const [operation, setOperation] = useState<UpdateOperation>({ phase: 'idle' });
  const running = useRef(false);
  const desktop = updaterClient.isDesktop();
  const busy =
    query.isFetching ||
    ['downloading', 'verifying', 'installing', 'restarting'].includes(operation.phase);
  async function check(automatic: boolean): Promise<void> {
    if (running.current) return;
    if (!automatic) setOpen(true);
    if (
      !automatic &&
      ((operation.phase === 'blocked' && operation.resume !== 'download') ||
        (operation.phase === 'failed' && operation.retry === 'restart'))
    )
      return;
    if (!desktop) return;
    running.current = true;
    setOperation({ phase: 'idle' });
    try {
      await checkForUpdate(query.refetch, automatic, () => setOpen(true), t);
    } finally {
      running.current = false;
    }
  }
  useUpdaterLifecycle(check, desktop);

  async function install(): Promise<void> {
    const result = query.data;
    if (running.current || !result?.update || !supportsUpdateInstall(result.bundleType)) return;
    running.current = true;
    toast.dismiss('app-update');
    try {
      await installUpdate({ ...result, update: result.update }, operation, client, setOperation);
    } finally {
      running.current = false;
    }
  }

  const result = query.data;
  return {
    state: {
      open,
      operation,
      desktop,
      busy,
      check: query.isFetching
        ? { status: 'checking' }
        : query.isError
          ? { status: 'failed', message: updateErrorMessage(query.error) }
          : { status: 'idle' },
      available: result?.update
        ? {
            version: result.update.version,
            body: result.update.body,
            canInstall: supportsUpdateInstall(result.bundleType),
          }
        : null,
    },
    setOpen: (nextOpen) => {
      if (!busy) setOpen(nextOpen);
    },
    check: () => void check(false),
    install: () => void install(),
    openReleasesPage: () => openReleases.mutate(),
  };
}
