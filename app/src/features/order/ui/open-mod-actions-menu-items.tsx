import { FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ModMetadataDto, SteamWorkshopOpenTarget } from '@/commands';
import { ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { SteamWorkshopMenuItems } from '@/features/order/ui/steam-workshop-menu-items';

type OpenModActionsMenuItemsProps = {
  mod: ModMetadataDto | undefined;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
  trailingSeparator?: boolean;
};

export function OpenModActionsMenuItems({
  mod,
  onOpenModFolder,
  onOpenSteamWorkshopPage,
  trailingSeparator = true,
}: OpenModActionsMenuItemsProps) {
  const { t } = useTranslation();
  if (!mod) return null;
  const { sourceKey, sourceKind } = mod;
  return (
    <>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => onOpenModFolder(sourceKey)}>
        <FolderOpen className="size-4" />
        {t('order.context.openModFolder')}
      </ContextMenuItem>
      <SteamWorkshopMenuItems
        sourceKey={sourceKind === 'workshop' ? sourceKey : null}
        onOpenSteamWorkshopPage={onOpenSteamWorkshopPage}
      />
      {trailingSeparator ? <ContextMenuSeparator /> : null}
    </>
  );
}
