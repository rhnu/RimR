import type { MouseEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { Layers } from 'lucide-react';
import type {
  DisplayAliasDto,
  ModIdentityDto,
  ModListEntryDto,
  ModListGroupChildDto,
  ModMetadataDto,
  ModTagBindingDto,
  SteamWorkshopOpenTarget,
  TagDefDto,
} from '@/commands';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { ModTypeIcon } from '@/components/mod/ModTypeIcon';
import { InactiveChildMenu, InactiveEntryMenu } from '@/features/order/InactiveStructuredMenus';
import type { InactiveRenderRow } from '@/features/order/model';
import { labelForIdentity } from '@/features/order/identity';
import { TagColorBar } from '@/features/tags/TagColorBar';
import { colorsForIdentity } from '@/features/tags/tagModel';
import type { Selection } from '@/features/order/types';
import { cn } from '@/lib/utils';

type TagRowProps = {
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

type InactiveEntryRowProps = {
  row: Extract<InactiveRenderRow, { kind: 'entry' }>;
  aliases: DisplayAliasDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  onWarmFileInfo: (sourceKey: string | null | undefined, immediate?: boolean) => void;
  onSelect: (
    entry: ModListEntryDto,
    selection: Selection,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void;
  onContextOpen: (entry: ModListEntryDto) => void;
  onRenameGroup: (entryId: string, name: string) => void;
  onAddActive: (entryId: string) => void;
  onDoubleClick: (entryId: string) => void;
  onEditAlias: (identity: ModIdentityDto) => void;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
} & TagRowProps;

export function InactiveEntryRow({
  row,
  aliases,
  tagDefs,
  modTags,
  tagTargetIdentities,
  modByPackageId,
  onWarmFileInfo,
  onSelect,
  onContextOpen,
  onRenameGroup,
  onAddActive,
  onDoubleClick,
  onEditAlias,
  onOpenModFolder,
  onOpenSteamWorkshopPage,
  onToggleModTag,
  onCreateTag,
  onRenameTag,
  onSetTagColor,
  onDeleteTag,
  onReorderModTags,
}: InactiveEntryRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: row.id });
  const sourceKey = row.entry.kind === 'mod' ? row.entry.identity.sourceKey : null;
  return (
    <ContextMenu onOpenChange={(open) => open && onContextOpen(row.entry)}>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          onPointerEnter={() => warmInactiveEntry(row.entry, onWarmFileInfo)}
          onDoubleClick={() => onDoubleClick(row.entry.id)}
          className={inactiveRowClassName(isDragging, row.missing)}
          {...attributes}
          {...listeners}
        >
          {row.entry.kind === 'mod' && (
            <TagColorBar colors={colorsForIdentity(modTags, tagDefs, row.entry.identity)} />
          )}
          <InactiveEntryIcon entry={row.entry} modByPackageId={modByPackageId} />
          <button
            type="button"
            className="h-full min-w-0 flex-1 truncate text-left text-sm font-medium"
            onPointerDown={() => sourceKey && onWarmFileInfo(sourceKey, true)}
            onFocus={() => sourceKey && onWarmFileInfo(sourceKey, true)}
            onClick={(event) => onSelect(row.entry, selectionForInactiveEntry(row.entry), event)}
          >
            {inactiveEntryLabel(row.entry, aliases, modByPackageId)}
            {row.missing ? (
              <span className="ml-2 text-xs text-destructive">{t('order.missing')}</span>
            ) : null}
          </button>
        </div>
      </ContextMenuTrigger>
      <InactiveEntryMenu
        entry={row.entry}
        sourceKey={sourceKey}
        onRenameGroup={onRenameGroup}
        onAddActive={onAddActive}
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
    </ContextMenu>
  );
}

type InactiveChildRowProps = {
  row: Extract<InactiveRenderRow, { kind: 'child' }>;
  aliases: DisplayAliasDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  onWarmFileInfo: (sourceKey: string | null | undefined, immediate?: boolean) => void;
  onSelect: (child: ModListGroupChildDto) => void;
  onAddActive: (groupId: string, childId: string) => void;
  onDoubleClick: (groupId: string, childId: string) => void;
  onEditAlias: (identity: ModIdentityDto) => void;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
} & TagRowProps;

export function InactiveChildRow({
  row,
  aliases,
  tagDefs,
  modTags,
  modByPackageId,
  onWarmFileInfo,
  onSelect,
  onAddActive,
  onDoubleClick,
  onEditAlias,
  onOpenModFolder,
  onOpenSteamWorkshopPage,
  onToggleModTag,
  onCreateTag,
  onRenameTag,
  onSetTagColor,
  onDeleteTag,
  onReorderModTags,
}: InactiveChildRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: row.id });
  const sourceKey = row.child.identity.sourceKey;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          onPointerEnter={() => onWarmFileInfo(sourceKey)}
          onDoubleClick={() => onDoubleClick(row.groupId, row.child.id)}
          className={cn(inactiveRowClassName(isDragging, row.missing), 'h-6 pl-8')}
          {...attributes}
          {...listeners}
        >
          <TagColorBar colors={colorsForIdentity(modTags, tagDefs, row.child.identity)} />
          <ModTypeIcon
            hasAssemblies={modByPackageId.get(row.child.identity.packageId)?.hasAssemblies ?? false}
            sourceKind={modByPackageId.get(row.child.identity.packageId)?.sourceKind}
          />
          <button
            type="button"
            className="h-full min-w-0 flex-1 truncate text-left text-sm"
            onPointerDown={() => onWarmFileInfo(sourceKey, true)}
            onFocus={() => onWarmFileInfo(sourceKey, true)}
            onClick={() => onSelect(row.child)}
          >
            {labelForIdentity(row.child.identity, aliases, modByPackageId)}
            {row.missing ? (
              <span className="ml-2 text-xs text-destructive">{t('order.missing')}</span>
            ) : null}
          </button>
        </div>
      </ContextMenuTrigger>
      <InactiveChildMenu
        row={row}
        sourceKey={sourceKey}
        onAddActive={onAddActive}
        onEditAlias={onEditAlias}
        onOpenModFolder={onOpenModFolder}
        onOpenSteamWorkshopPage={onOpenSteamWorkshopPage}
        modByPackageId={modByPackageId}
        tagDefs={tagDefs}
        modTags={modTags}
        onToggleModTag={onToggleModTag}
        onCreateTag={onCreateTag}
        onRenameTag={onRenameTag}
        onSetTagColor={onSetTagColor}
        onDeleteTag={onDeleteTag}
        onReorderModTags={onReorderModTags}
      />
    </ContextMenu>
  );
}

function InactiveEntryIcon({
  entry,
  modByPackageId,
}: {
  entry: ModListEntryDto;
  modByPackageId: Map<string, ModMetadataDto>;
}) {
  if (entry.kind === 'group') return <Layers className="size-4 text-muted-foreground" />;
  if (entry.kind === 'mod') {
    return (
      <ModTypeIcon
        hasAssemblies={modByPackageId.get(entry.identity.packageId)?.hasAssemblies ?? false}
        sourceKind={modByPackageId.get(entry.identity.packageId)?.sourceKind}
      />
    );
  }
  return null;
}

function inactiveEntryLabel(
  entry: ModListEntryDto,
  aliases: DisplayAliasDto[],
  modByPackageId: Map<string, ModMetadataDto>,
): string {
  if (entry.kind === 'group') return entry.name;
  if (entry.kind === 'mod') return labelForIdentity(entry.identity, aliases, modByPackageId);
  return entry.title;
}

function selectionForInactiveEntry(entry: ModListEntryDto): Selection {
  if (entry.kind === 'mod') return { kind: 'mod', identity: entry.identity };
  if (entry.kind === 'group') return { kind: 'group', entryId: entry.id };
  return { kind: 'separator', entryId: entry.id };
}

function warmInactiveEntry(
  entry: ModListEntryDto,
  warm: (sourceKey: string | null | undefined, immediate?: boolean) => void,
): void {
  if (entry.kind === 'mod') warm(entry.identity.sourceKey);
}

function inactiveRowClassName(isDragging: boolean, missing: boolean): string {
  return cn(
    'relative flex h-7 select-none items-center gap-2 border-b border-border px-2 text-left text-sm',
    missing && 'text-muted-foreground',
    isDragging ? 'opacity-40' : 'hover:bg-accent/50',
  );
}
