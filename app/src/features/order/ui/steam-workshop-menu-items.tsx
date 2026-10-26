import { ExternalLink, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SteamWorkshopOpenTarget } from '@/commands';
import { ContextMenuItem } from '@/components/ui/context-menu';

export function SteamWorkshopMenuItems({
  sourceKey,
  onOpenSteamWorkshopPage,
}: {
  sourceKey: string | null | undefined;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
}) {
  const { t } = useTranslation();
  if (!sourceKey) return null;
  return (
    <>
      <ContextMenuItem onSelect={() => onOpenSteamWorkshopPage(sourceKey, 'steamClient')}>
        <ExternalLink className="size-4" />
        {t('order.context.openInSteam')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => onOpenSteamWorkshopPage(sourceKey, 'web')}>
        <Globe className="size-4" />
        {t('order.context.openWorkshopPage')}
      </ContextMenuItem>
    </>
  );
}
