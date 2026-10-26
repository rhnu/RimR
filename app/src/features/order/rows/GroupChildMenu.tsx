import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ModIdentityDto } from '@/commands';
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { OpenModActionsMenuItems } from '@/features/order/OpenModActionsMenuItems';
import { TagMenuItems } from '@/features/tags/TagMenuItems';
import { tagIdsForIdentities } from '@/features/tags/tagModel';
import { steamWorkshopSourceKey } from '@/lib/steamWorkshopLinks';
import type { GroupChildRowProps } from './rowTypes';

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
