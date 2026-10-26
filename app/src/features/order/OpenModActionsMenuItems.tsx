import { FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SteamWorkshopOpenTarget } from '@/commands';
import { ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { SteamWorkshopMenuItems } from './SteamWorkshopMenuItems';

type OpenModActionsMenuItemsProps = {
  sourceKey: string | null | undefined;
  workshopSourceKey: string | null | undefined;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
  trailingSeparator?: boolean;
};

export function OpenModActionsMenuItems({
  sourceKey,
  workshopSourceKey,
  onOpenModFolder,
  onOpenSteamWorkshopPage,
  trailingSeparator = true,
}: OpenModActionsMenuItemsProps) {
  const { t } = useTranslation();
  if (!sourceKey && !workshopSourceKey) return null;
  return (
    <>
      <ContextMenuSeparator />
      {sourceKey ? (
        <ContextMenuItem onSelect={() => onOpenModFolder(sourceKey)}>
          <FolderOpen className="size-4" />
          {t('order.context.openModFolder')}
        </ContextMenuItem>
      ) : null}
      <SteamWorkshopMenuItems
        sourceKey={workshopSourceKey}
        onOpenSteamWorkshopPage={onOpenSteamWorkshopPage}
      />
      {trailingSeparator ? <ContextMenuSeparator /> : null}
    </>
  );
}
