import { DiagnosticMenuItems } from '../diagnostic-menu-items';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ModIdentityDto } from '@/commands';
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { OpenModActionsMenuItems } from '@/features/order/ui/open-mod-actions-menu-items';
import { TagMenuItems } from '@/components/mod/tags/tag-menu-items';
import { tagIdsForIdentities } from '@/domain/mods/tags';
import { steamWorkshopSourceKey } from '@/domain/mods/workshop-links';
import type { GroupChildRowProps } from '@/features/order/ui/rows/row-types';

type GroupChildMenuProps = Pick<
  GroupChildRowProps,
  | 'groupId'
  | 'modByPackageId'
  | 'tagDefs'
  | 'modTags'
  | 'onEditAlias'
  | 'onOpenModFolder'
  | 'onOpenSteamWorkshopPage'
  | 'onToggleModTag'
  | 'onCreateTag'
  | 'onRenameTag'
  | 'onSetTagColor'
  | 'onDeleteTag'
  | 'onReorderModTags'
  | 'onRemove'
> & {
  identity: ModIdentityDto;
  sourceKey: string | null | undefined;
  childId: string;
};

export function GroupChildMenu({
  identity,
  sourceKey,
  groupId,
  childId,
  modByPackageId,
  tagDefs,
  modTags,
  onEditAlias,
  onOpenModFolder,
  onOpenSteamWorkshopPage,
  onToggleModTag,
  onCreateTag,
  onRenameTag,
  onSetTagColor,
  onDeleteTag,
  onReorderModTags,
  onRemove,
}: GroupChildMenuProps) {
  const { t } = useTranslation();
  const workshopSourceKey = steamWorkshopSourceKey(identity, modByPackageId);
  return (
    <ContextMenuContent>
      <DiagnosticMenuItems identity={identity} />
      <ContextMenuItem onSelect={() => onEditAlias(identity)}>
        <Pencil className="size-4" />
        {t('order.context.editAlias')}
      </ContextMenuItem>
      <TagMenuItems
        identity={identity}
        tagDefs={tagDefs}
        boundTagIds={tagIdsForIdentities(modTags, [identity])}
        onToggleTag={(tagId) => onToggleModTag([identity], tagId)}
        onCreateTag={onCreateTag}
        onRenameTag={onRenameTag}
        onSetTagColor={onSetTagColor}
        onDeleteTag={onDeleteTag}
        onReorderModTags={onReorderModTags}
      />
      <OpenModActionsMenuItems
        sourceKey={sourceKey}
        workshopSourceKey={workshopSourceKey}
        onOpenModFolder={onOpenModFolder}
        onOpenSteamWorkshopPage={onOpenSteamWorkshopPage}
        trailingSeparator={false}
      />
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => onRemove(groupId, childId)} variant="destructive">
        <Trash2 className="size-4" />
        {t('order.context.removeFromActive')}
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
