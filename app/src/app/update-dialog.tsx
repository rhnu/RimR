import type { ComponentProps } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { rimrClient } from '@/commands';
import { downloadPercent, supportsUpdateInstall } from '@/domain/updates';
import { updateErrorMessage } from '@/commands/updater-client';
import { reportError, unwrap } from '@/queries/client';
import type { useAppUpdater } from './use-app-updater';

type Updater = ReturnType<typeof useAppUpdater>;
type UpdateDialogProps = {
  updater: Updater;
  onCloseAutoFocus: ComponentProps<typeof DialogContent>['onCloseAutoFocus'];
};

function updateStatus({ operation, query, desktop }: Updater, t: TFunction): string {
  if (!desktop) return t('updates.desktopOnly');
  if (query.isFetching) return t('updates.checking');
  if (operation.phase === 'failed')
    return t(operation.retry === 'restart' ? 'updates.restartFailed' : 'updates.failed');
  if (operation.phase === 'blocked')
    return t(
      operation.reason === 'operations'
        ? 'updates.waitForOperations'
        : operation.resume === 'download'
          ? 'updates.saveBeforeDownload'
          : 'updates.saveBeforeInstall',
    );
  if (operation.phase === 'downloading') return t('updates.downloading');
  if (operation.phase === 'verifying') return t('updates.verifying');
  if (operation.phase === 'installing') return t('updates.installing');
  if (operation.phase === 'restarting') return t('updates.restarting');
  if (query.isError) return t('updates.checkFailed');
  if (query.data?.update) return t('updates.available', { version: query.data.update.version });
  return t('updates.upToDate');
}

export function UpdateDialog({ updater, onCloseAutoFocus }: UpdateDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={updater.open} onOpenChange={updater.setOpen}>
      <DialogContent
        className="max-w-sm gap-4 p-5"
        showCloseButton={!updater.busy}
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={(event) => {
          if (updater.busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (updater.busy) event.preventDefault();
        }}
      >
        <DialogHeader className="gap-1.5 pr-5">
          <DialogTitle>{t('updates.title')}</DialogTitle>
          <DialogDescription>{t('updates.description')}</DialogDescription>
        </DialogHeader>
        <UpdateDetails updater={updater} />
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={updater.busy}
            onClick={() => updater.setOpen(false)}
          >
            {t('window.close')}
          </Button>
          <UpdateAction updater={updater} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateDetails({ updater }: { updater: Updater }) {
  const { t } = useTranslation();
  const { operation, query, busy } = updater;
  const update = query.data?.update;
  const canInstall = query.data && supportsUpdateInstall(query.data.bundleType);
  return (
    <div className="space-y-3 text-xs" aria-live="polite" aria-busy={busy}>
      <p className="flex items-center gap-2">
        {busy ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : null}
        {updateStatus(updater, t)}
      </p>
      {operation.phase === 'downloading' ? (
        <DownloadProgress downloaded={operation.downloaded} total={operation.total} />
      ) : null}
      {query.isError && !query.isFetching ? (
        <p className="break-words text-destructive">{updateErrorMessage(query.error)}</p>
      ) : null}
      {operation.phase === 'failed' ? (
        <p className="break-words text-destructive">{operation.message}</p>
      ) : null}
      {update && !canInstall ? (
        <p className="text-muted-foreground">{t('updates.manualInstall')}</p>
      ) : null}
      {update && canInstall && !busy && operation.phase === 'idle' ? (
        <p className="text-muted-foreground">{t('updates.restartNotice')}</p>
      ) : null}
      {update?.body && !busy ? (
        <div className="max-h-40 overflow-auto border-t border-border pt-3 whitespace-pre-wrap text-muted-foreground">
          {update.body}
        </div>
      ) : null}
    </div>
  );
}

function DownloadProgress({ downloaded, total }: { downloaded: number; total?: number }) {
  const { t } = useTranslation();
  const percent = downloadPercent(downloaded, total);
  return (
    <div className="space-y-1">
      <progress
        className="h-2 w-full accent-primary"
        aria-label={t('updates.downloading')}
        max={100}
        value={percent}
      />
      <p className="text-right text-muted-foreground">
        {percent === undefined
          ? t('updates.downloaded', { size: (downloaded / 1024 / 1024).toFixed(1) })
          : `${Math.floor(percent)}%`}
      </p>
    </div>
  );
}

function UpdateAction({ updater }: { updater: Updater }) {
  const { t } = useTranslation();
  const { operation, query } = updater;
  if (!updater.desktop || updater.busy) return null;
  if (query.isError || !query.data?.update)
    return (
      <Button size="sm" onClick={() => void updater.check()}>
        {t('common.retry')}
      </Button>
    );
  if (!supportsUpdateInstall(query.data.bundleType))
    return (
      <Button
        size="sm"
        onClick={() => {
          void unwrap(rimrClient.openReleasesPage()).catch(reportError);
        }}
      >
        {t('updates.openReleases')}
      </Button>
    );
  const label =
    operation.phase === 'failed'
      ? operation.retry === 'restart'
        ? 'updates.restart'
        : 'common.retry'
      : operation.phase === 'blocked' && operation.resume === 'restart'
        ? 'updates.restart'
        : operation.phase === 'blocked' && operation.resume === 'install'
          ? 'updates.install'
          : 'updates.downloadInstall';
  return (
    <Button size="sm" onClick={() => void updater.install()}>
      {t(label)}
    </Button>
  );
}
