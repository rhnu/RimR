import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { updaterClient, logUpdate, updateErrorMessage } from '@/commands/updater-client';
import { supportsUpdateInstall } from '@/domain/updates';
import { queryKeys } from '@/queries/keys';
import { releaseUpdate, useUpdateCheck, type UpdateCheck } from '@/queries/updates';
import { installUpdate } from './update-installation';

export type UpdateOperation =
  | { phase: 'idle' }
  | {
      phase: 'blocked';
      resume: 'download' | 'install' | 'restart';
      reason: 'drafts' | 'operations';
    }
  | { phase: 'downloading'; downloaded: number; total?: number }
  | { phase: 'verifying' }
  | { phase: 'installing' }
  | { phase: 'restarting' }
  | { phase: 'failed'; message: string; retry: 'download' | 'restart' };

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
  const started = useRef(false);
  useEffect(() => {
    if (import.meta.env.DEV || !desktop || started.current) return;
    started.current = true;
    void check(true);
  }, [check, desktop]);
  useEffect(
    () => () => {
      const result = client.getQueryData<UpdateCheck>(queryKeys.update);
      client.removeQueries({ queryKey: queryKeys.update });
      void releaseUpdate(result);
    },
    [client],
  );
}

/** One controller serializes checks, downloads and installation for the entire app. */
export function useAppUpdater() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const query = useUpdateCheck();
  const { refetch } = query;
  const [open, setOpen] = useState(false);
  const [operation, setOperation] = useState<UpdateOperation>({ phase: 'idle' });
  const running = useRef(false);
  const desktop = updaterClient.isDesktop();
  const busy =
    query.isFetching ||
    ['downloading', 'verifying', 'installing', 'restarting'].includes(operation.phase);
  const check = useCallback(
    async (automatic = false) => {
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
        await checkForUpdate(refetch, automatic, () => setOpen(true), t);
      } finally {
        running.current = false;
      }
    },
    [desktop, operation, refetch, t],
  );
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

  return {
    open,
    setOpen: (nextOpen: boolean) => {
      if (!busy) setOpen(nextOpen);
    },
    operation,
    query,
    desktop,
    busy,
    check: () => check(false),
    install,
  };
}
