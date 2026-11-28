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
import { ContextMenuItem } from '@/components/ui/context-menu';
import { OpenModActionsMenuItems } from '@/features/order/ui/open-mod-actions-menu-items';
import { TagMenuItems } from '@/components/mod/tags/tag-menu-items';
import { tagIdsForIdentities } from '@/domain/mods/tags';
import type { InactiveRenderRow } from '@/features/order/model';

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
  mod,
  onRenameGroup,
  onAddActive,
  onEditAlias,
  onOpenModFolder,
  onOpenSteamWorkshopPage,
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
  mod: ModMetadataDto | undefined;
  onRenameGroup: (entryId: string, name: string) => void;
  onAddActive: (entryId: string) => void;
  onEditAlias: (identity: ModIdentityDto) => void;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
} & TagMenuProps) {
  const { t } = useTranslation();
  return (
    <>
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
          mod={mod}
          onEditAlias={onEditAlias}
          onOpenModFolder={onOpenModFolder}
          onOpenSteamWorkshopPage={onOpenSteamWorkshopPage}
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
    </>
  );
}

export function InactiveChildMenu({
  row,
  mod,
  onAddActive,
  onEditAlias,
  onOpenModFolder,
  onOpenSteamWorkshopPage,
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
  mod: ModMetadataDto | undefined;
  onAddActive: (groupId: string, childId: string) => void;
  onEditAlias: (identity: ModIdentityDto) => void;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
} & TagMenuProps) {
  const { t } = useTranslation();
  return (
    <>
      <ContextMenuItem onSelect={() => onAddActive(row.groupId, row.child.id)}>
        <Plus className="size-4" />
        {t('order.context.addToActive')}
      </ContextMenuItem>
      <ModEntryMenuItems
        identity={row.child.identity}
        mod={mod}
        onEditAlias={onEditAlias}
        onOpenModFolder={onOpenModFolder}
        onOpenSteamWorkshopPage={onOpenSteamWorkshopPage}
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
    </>
  );
}

function ModEntryMenuItems({
  identity,
  mod,
  onEditAlias,
  onOpenModFolder,
  onOpenSteamWorkshopPage,
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
  mod: ModMetadataDto | undefined;
  onEditAlias: (identity: ModIdentityDto) => void;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
} & TagMenuProps) {
  const { t } = useTranslation();
  const targetIdentities = tagTargetIdentities?.length ? tagTargetIdentities : [identity];
  return (
    <>
      <OpenModActionsMenuItems
        mod={mod}
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
