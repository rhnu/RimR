import { Layers, Pencil, SplitSquareHorizontal, Trash2, Ungroup } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ModListEntryDto } from '@/commands';
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { OpenModActionsMenuItems } from '@/features/order/OpenModActionsMenuItems';
import { TagMenuItems } from '@/features/tags/TagMenuItems';
import { tagIdsForIdentities } from '@/features/tags/tagModel';
import { steamWorkshopSourceKey } from '@/lib/steamWorkshopLinks';
import type { ActiveEntryRowProps } from './rowTypes';

type ActiveEntryMenuProps = Pick<
  ActiveEntryRowProps,
  | 'canCreateGroup'
  | 'onRemove'
  | 'onUngroup'
  | 'onCreateGroup'
  | 'onEditAlias'
  | 'onAddSeparator'
  | 'onRenameGroup'
  | 'onRenameSeparator'
  | 'onOpenModFolder'
  | 'onOpenSteamWorkshopPage'
  | 'modByPackageId'
  | 'tagDefs'
  | 'modTags'
  | 'tagTargetIdentities'
  | 'onToggleModTag'
  | 'onCreateTag'
  | 'onRenameTag'
  | 'onSetTagColor'
  | 'onDeleteTag'
  | 'onReorderModTags'
> & {
  entry: ModListEntryDto;
};

export function ActiveEntryMenu(props: ActiveEntryMenuProps) {
  const { t } = useTranslation();
  return (
    <ContextMenuContent>
      <EntryActions {...props} />
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => props.onAddSeparator(props.entry)}>
        <SplitSquareHorizontal className="size-4" />
        {t('order.context.addSeparatorAbove')}
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

function EntryActions(props: ActiveEntryMenuProps) {
  if (props.entry.kind === 'mod') {
    return <ModEntryActions {...props} entry={props.entry} />;
  }
  if (props.entry.kind === 'group') {
    return <GroupEntryActions {...props} entry={props.entry} />;
  }
  return <SeparatorEntryActions {...props} entry={props.entry} />;
}

function ModEntryActions({
  entry,
  canCreateGroup,
  onRemove,
  onCreateGroup,
  onEditAlias,
  onOpenModFolder,
  onOpenSteamWorkshopPage,
  modByPackageId,
  tagDefs,
  modTags,
  tagTargetIdentities,
  onToggleModTag,
  onCreateTag,
  onRenameTag,
  onSetTagColor,
  onDeleteTag,
  onReorderModTags,
}: ActiveEntryMenuProps) {
  const { t } = useTranslation();
  if (entry.kind !== 'mod') return null;
  const sourceKey = entry.identity.sourceKey;
  const workshopSourceKey = steamWorkshopSourceKey(entry.identity, modByPackageId);
  const targetIdentities = tagTargetIdentities.length > 0 ? tagTargetIdentities : [entry.identity];
  return (
    <>
      <ContextMenuItem onSelect={() => onRemove(entry.id)} variant="destructive">
        <Trash2 className="size-4" />
        {t('order.context.removeFromActive')}
      </ContextMenuItem>
      <ContextMenuItem disabled={!canCreateGroup} onSelect={onCreateGroup}>
        <Layers className="size-4" />
        {t('order.context.createGroup')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => onEditAlias(entry.identity)}>
        <Pencil className="size-4" />
        {t('order.context.editAlias')}
      </ContextMenuItem>
      <TagMenuItems
        identity={entry.identity}
        tagDefs={tagDefs}
        boundTagIds={tagIdsForIdentities(modTags, targetIdentities)}
        onToggleTag={(tagId) => onToggleModTag(targetIdentities, tagId)}
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
    </>
  );
}

function GroupEntryActions({ entry, onRenameGroup, onUngroup, onRemove }: ActiveEntryMenuProps) {
  const { t } = useTranslation();
  if (entry.kind !== 'group') return null;
  return (
    <>
      <ContextMenuItem onSelect={() => onRenameGroup(entry.id, entry.name)}>
        <Pencil className="size-4" />
        {t('order.context.renameGroup')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => onUngroup(entry.id)}>
        <Ungroup className="size-4" />
        {t('order.ungroup')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => onRemove(entry.id)} variant="destructive">
        <Trash2 className="size-4" />
        {t('order.context.removeFromActive')}
      </ContextMenuItem>
    </>
  );
}

function SeparatorEntryActions({ entry, onRenameSeparator, onRemove }: ActiveEntryMenuProps) {
  const { t } = useTranslation();
  if (entry.kind !== 'separator') return null;
  return (
    <>
      <ContextMenuItem onSelect={() => onRenameSeparator(entry.id, entry.title)}>
        <Pencil className="size-4" />
        {t('order.context.renameSeparator')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => onRemove(entry.id)} variant="destructive">
        <Trash2 className="size-4" />
        {t('order.context.deleteSeparator')}
      </ContextMenuItem>
    </>
  );
}
