import { Pencil, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  ModIdentityDto,
  ModListEntryDto,
  ModMetadataDto,
  ModTagBindingDto,
  SteamWorkshopOpenTarget,
  TagDefDto,
} from '@/commands';
import { ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu';
import { OpenModActionsMenuItems } from '@/features/order/OpenModActionsMenuItems';
import { TagMenuItems } from '@/features/tags/TagMenuItems';
import { tagIdsForIdentities } from '@/features/tags/tagModel';
import type { InactiveRenderRow } from '@/features/order/model';
import { steamWorkshopSourceKey } from '@/lib/steamWorkshopLinks';

type TagMenuProps = {
  tagDefs: TagDefDto[];
  modTags: ModTagBindingDto[];
  tagTargetIdentities?: ModIdentityDto[];
  onToggleModTag: (identities: ModIdentityDto[], tagId: string) => void;
  onCreateTag: (name: string, color: string | null) => void;
  onRenameTag: (tagId: string, name: string) => void;
  onSetTagColor: (tagId: string, color: string | null) => void;
  onDeleteTag: (tagId: string) => void;
  onReorderModTags: (identity: ModIdentityDto, tagIds: string[]) => void;
};

export function InactiveEntryMenu({
  entry,
  sourceKey,
  onRenameGroup,
  onAddActive,
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
}: {
  entry: ModListEntryDto;
  sourceKey: string | null | undefined;
  onRenameGroup: (entryId: string, name: string) => void;
  onAddActive: (entryId: string) => void;
  onEditAlias: (identity: ModIdentityDto) => void;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
  modByPackageId: Map<string, ModMetadataDto>;
} & TagMenuProps) {
  const { t } = useTranslation();
  return (
    <ContextMenuContent>
      <ContextMenuItem onSelect={() => onAddActive(entry.id)}>
        <Plus className="size-4" />
        {t('order.context.addToActive')}
      </ContextMenuItem>
      {entry.kind === 'group' ? (
        <ContextMenuItem onSelect={() => onRenameGroup(entry.id, entry.name)}>
          <Pencil className="size-4" />
          {t('order.context.renameGroup')}
        </ContextMenuItem>
      ) : null}
      {entry.kind === 'mod' ? (
        <ModEntryMenuItems
          identity={entry.identity}
          sourceKey={sourceKey}
          onEditAlias={onEditAlias}
          onOpenModFolder={onOpenModFolder}
          onOpenSteamWorkshopPage={onOpenSteamWorkshopPage}
          modByPackageId={modByPackageId}
          tagDefs={tagDefs}
          modTags={modTags}
          tagTargetIdentities={tagTargetIdentities}
          onToggleModTag={onToggleModTag}
          onCreateTag={onCreateTag}
          onRenameTag={onRenameTag}
          onSetTagColor={onSetTagColor}
          onDeleteTag={onDeleteTag}
          onReorderModTags={onReorderModTags}
        />
      ) : null}
    </ContextMenuContent>
  );
}

export function InactiveChildMenu({
  row,
  sourceKey,
  onAddActive,
  onEditAlias,
  onOpenModFolder,
  onOpenSteamWorkshopPage,
  modByPackageId,
  tagDefs,
  modTags,
  onToggleModTag,
  onCreateTag,
  onRenameTag,
  onSetTagColor,
  onDeleteTag,
  onReorderModTags,
}: {
  row: Extract<InactiveRenderRow, { kind: 'child' }>;
  sourceKey: string | null | undefined;
  onAddActive: (groupId: string, childId: string) => void;
  onEditAlias: (identity: ModIdentityDto) => void;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
  modByPackageId: Map<string, ModMetadataDto>;
} & TagMenuProps) {
  const { t } = useTranslation();
  return (
    <ContextMenuContent>
      <ContextMenuItem onSelect={() => onAddActive(row.groupId, row.child.id)}>
        <Plus className="size-4" />
        {t('order.context.addToActive')}
      </ContextMenuItem>
      <ModEntryMenuItems
        identity={row.child.identity}
        sourceKey={sourceKey}
        onEditAlias={onEditAlias}
        onOpenModFolder={onOpenModFolder}
        onOpenSteamWorkshopPage={onOpenSteamWorkshopPage}
        modByPackageId={modByPackageId}
        tagDefs={tagDefs}
        modTags={modTags}
        tagTargetIdentities={[row.child.identity]}
        onToggleModTag={onToggleModTag}
        onCreateTag={onCreateTag}
        onRenameTag={onRenameTag}
        onSetTagColor={onSetTagColor}
        onDeleteTag={onDeleteTag}
        onReorderModTags={onReorderModTags}
      />
    </ContextMenuContent>
  );
}

function ModEntryMenuItems({
  identity,
  sourceKey,
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
}: {
  identity: ModIdentityDto;
  sourceKey: string | null | undefined;
  onEditAlias: (identity: ModIdentityDto) => void;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
  modByPackageId: Map<string, ModMetadataDto>;
} & TagMenuProps) {
  const { t } = useTranslation();
  const workshopSourceKey = steamWorkshopSourceKey(identity, modByPackageId);
  const targetIdentities = tagTargetIdentities?.length ? tagTargetIdentities : [identity];
  return (
    <>
      <OpenModActionsMenuItems
        sourceKey={sourceKey}
        workshopSourceKey={workshopSourceKey}
        onOpenModFolder={onOpenModFolder}
        onOpenSteamWorkshopPage={onOpenSteamWorkshopPage}
      />
      <ContextMenuItem onSelect={() => onEditAlias(identity)}>
        <Pencil className="size-4" />
        {t('order.context.editAlias')}
      </ContextMenuItem>
      <TagMenuItems
        identity={identity}
        tagDefs={tagDefs}
        boundTagIds={tagIdsForIdentities(modTags, targetIdentities)}
        onToggleTag={(tagId) => onToggleModTag(targetIdentities, tagId)}
        onCreateTag={onCreateTag}
        onRenameTag={onRenameTag}
        onSetTagColor={onSetTagColor}
        onDeleteTag={onDeleteTag}
        onReorderModTags={onReorderModTags}
      />
    </>
  );
}
