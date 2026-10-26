import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAppVersion, useGameVersion, useOpenProjectPage } from '@/queries/app';

type AboutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: ComponentProps<typeof DialogContent>['onCloseAutoFocus'];
};

export function AboutDialog({ open, onOpenChange, onCloseAutoFocus }: AboutDialogProps) {
  const { t } = useTranslation();
  const appVersion = useAppVersion();
  const gameVersion = useGameVersion(open);
  const openProjectPage = useOpenProjectPage();
  const appVersionLabel = appVersion.isPending
    ? t('about.versionLoading')
    : appVersion.isError
      ? t('about.versionUnavailable')
      : (appVersion.data ?? t('about.developmentBuild'));
  const gameVersionLabel =
    gameVersion.isFetching || gameVersion.isPending
      ? t('about.versionLoading')
      : gameVersion.isError
        ? t('about.versionUnavailable')
        : (gameVersion.data ?? t('about.gameVersionUndetected'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-4 p-5" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader className="gap-1.5 pr-5">
          <DialogTitle>{t('menu.aboutRimr')}</DialogTitle>
          <DialogDescription>{t('about.description')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-4 text-xs">
          <p className="text-muted-foreground">
            <span aria-label={t('about.author')}>Rhynia</span>
            <span aria-hidden="true"> · </span>
            <span aria-label={t('about.license')}>GPL-3.0</span>
          </p>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            disabled={openProjectPage.isPending}
            onClick={() => openProjectPage.mutate()}
          >
            GitHub
          </Button>
        </div>
        <dl
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 border-t border-border pt-3 text-xs"
          aria-live="polite"
        >
          <dt className="text-muted-foreground">{t('about.rimrVersion')}</dt>
          <dd className="text-right font-mono break-words">{appVersionLabel}</dd>
          <dt className="text-muted-foreground">{t('about.rimworldVersion')}</dt>
          <dd className="text-right font-mono break-words">{gameVersionLabel}</dd>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
