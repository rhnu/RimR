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
import { downloadPercent } from '@/domain/updates';
import type { AppUpdater, AppUpdaterState } from './use-app-updater';

type UpdateDialogProps = {
  updater: AppUpdater;
  onCloseAutoFocus: ComponentProps<typeof DialogContent>['onCloseAutoFocus'];
};

function updateStatus(
  { operation, check, available, desktop }: AppUpdaterState,
  t: TFunction,
): string {
  if (!desktop) return t('updates.desktopOnly');
  if (check.status === 'checking') return t('updates.checking');
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
  if (check.status === 'failed') return t('updates.checkFailed');
  if (available) return t('updates.available', { version: available.version });
  return t('updates.upToDate');
}

export function UpdateDialog({ updater, onCloseAutoFocus }: UpdateDialogProps) {
  const { t } = useTranslation();
  const { open, busy } = updater.state;
  return (
    <Dialog open={open} onOpenChange={updater.setOpen}>
      <DialogContent
        className="max-w-sm gap-4 p-5"
        showCloseButton={!busy}
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader className="gap-1.5 pr-5">
          <DialogTitle>{t('updates.title')}</DialogTitle>
          <DialogDescription>{t('updates.description')}</DialogDescription>
        </DialogHeader>
        <UpdateDetails state={updater.state} />
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
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

function UpdateDetails({ state }: { state: AppUpdaterState }) {
  const { t } = useTranslation();
  const { operation, check, available, busy } = state;
  return (
    <div className="space-y-3 text-xs" aria-live="polite" aria-busy={busy}>
      <p className="flex items-center gap-2">
        {busy ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : null}
        {updateStatus(state, t)}
      </p>
      {operation.phase === 'downloading' ? (
        <DownloadProgress downloaded={operation.downloaded} total={operation.total} />
      ) : null}
      {check.status === 'failed' ? (
        <p className="break-words text-destructive">{check.message}</p>
      ) : null}
      {operation.phase === 'failed' ? (
        <p className="break-words text-destructive">{operation.message}</p>
      ) : null}
      {available && !available.canInstall ? (
        <p className="text-muted-foreground">{t('updates.manualInstall')}</p>
      ) : null}
      {available?.canInstall && !busy && operation.phase === 'idle' ? (
        <p className="text-muted-foreground">{t('updates.restartNotice')}</p>
      ) : null}
      {available?.body && !busy ? (
        <div className="max-h-40 overflow-auto border-t border-border pt-3 whitespace-pre-wrap text-muted-foreground">
          {available.body}
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

function UpdateAction({ updater }: { updater: AppUpdater }) {
  const { t } = useTranslation();
  const { operation, check, available, desktop, busy } = updater.state;
  if (!desktop || busy) return null;
  if (check.status === 'failed' || !available)
    return (
      <Button size="sm" onClick={updater.check}>
        {t('common.retry')}
      </Button>
    );
  if (!available.canInstall)
    return (
      <Button size="sm" onClick={updater.openReleasesPage}>
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
    <Button size="sm" onClick={updater.install}>
      {t(label)}
    </Button>
  );
}
