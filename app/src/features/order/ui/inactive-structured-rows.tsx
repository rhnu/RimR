import type { MouseEvent } from 'react';
import { DiagnosticRowMenu, type RowDiagnosticNavigation } from './diagnostic-row-menu';
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
import { ModTypeIcon } from '@/components/mod/mod-type-icon';
import {
  InactiveChildMenu,
  InactiveEntryMenu,
} from '@/features/order/ui/inactive-structured-menus';
import type { InactiveRenderRow } from '@/features/order/model';
import { labelForIdentity, resolveInstalledMod } from '@/domain/mods/identity';
import { TagColorBar } from '@/components/mod/tags/tag-color-bar';
import { colorsForIdentity } from '@/domain/mods/tags';
import type { Selection } from '@/features/order/types';
import { cn } from '@/lib/utils';

type TagRowProps = {
  diagnosticNavigation: RowDiagnosticNavigation;
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
  diagnosticNavigation,
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
  ...menuActions
}: InactiveEntryRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: row.id });
  const mod =
    row.entry.kind === 'mod' ? resolveInstalledMod(row.entry.identity, modByPackageId) : undefined;
  return (
    <DiagnosticRowMenu
      target={{ kind: 'entry', entry: row.entry }}
      navigation={diagnosticNavigation}
      onOpen={() => onContextOpen(row.entry)}
      trigger={
        <div
          ref={setNodeRef}
          onPointerEnter={() => onWarmFileInfo(mod?.sourceKey)}
          onDoubleClick={() => onDoubleClick(row.entry.id)}
          className={inactiveRowClassName(isDragging, row.missing)}
          {...attributes}
          {...listeners}
        >
          {row.entry.kind === 'mod' && (
            <TagColorBar colors={colorsForIdentity(modTags, tagDefs, row.entry.identity)} />
          )}
          <InactiveEntryIcon entry={row.entry} mod={mod} />
          <button
            type="button"
            className="h-full min-w-0 flex-1 truncate text-left text-sm font-medium"
            onPointerDown={() => onWarmFileInfo(mod?.sourceKey, true)}
            onFocus={() => onWarmFileInfo(mod?.sourceKey, true)}
            onClick={(event) => onSelect(row.entry, selectionForInactiveEntry(row.entry), event)}
          >
            {inactiveEntryLabel(row.entry, aliases, modByPackageId)}
            {row.missing ? (
              <span className="ml-2 text-xs text-destructive">{t('order.missing')}</span>
            ) : null}
          </button>
        </div>
      }
    >
      <InactiveEntryMenu
        {...menuActions}
        entry={row.entry}
        mod={mod}
        onRenameGroup={onRenameGroup}
        onAddActive={onAddActive}
        tagDefs={tagDefs}
        modTags={modTags}
        tagTargetIdentities={tagTargetIdentities}
      />
    </DiagnosticRowMenu>
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
  diagnosticNavigation,
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
  const mod = resolveInstalledMod(row.child.identity, modByPackageId);
  return (
    <DiagnosticRowMenu
      target={{ kind: 'mod', identity: row.child.identity }}
      navigation={diagnosticNavigation}
      trigger={
        <div
          ref={setNodeRef}
          onPointerEnter={() => onWarmFileInfo(mod?.sourceKey)}
          onDoubleClick={() => onDoubleClick(row.groupId, row.child.id)}
          className={cn(inactiveRowClassName(isDragging, row.missing), 'h-6 pl-8')}
          {...attributes}
          {...listeners}
        >
          <TagColorBar colors={colorsForIdentity(modTags, tagDefs, row.child.identity)} />
          <ModTypeIcon hasAssemblies={mod?.hasAssemblies ?? false} sourceKind={mod?.sourceKind} />
          <button
            type="button"
            className="h-full min-w-0 flex-1 truncate text-left text-sm"
            onPointerDown={() => onWarmFileInfo(mod?.sourceKey, true)}
            onFocus={() => onWarmFileInfo(mod?.sourceKey, true)}
            onClick={() => onSelect(row.child)}
          >
            {labelForIdentity(row.child.identity, aliases, modByPackageId)}
            {row.missing ? (
              <span className="ml-2 text-xs text-destructive">{t('order.missing')}</span>
            ) : null}
          </button>
        </div>
      }
    >
      <InactiveChildMenu
        row={row}
        mod={mod}
        onAddActive={onAddActive}
        onEditAlias={onEditAlias}
        onOpenModFolder={onOpenModFolder}
        onOpenSteamWorkshopPage={onOpenSteamWorkshopPage}
        tagDefs={tagDefs}
        modTags={modTags}
        onToggleModTag={onToggleModTag}
        onCreateTag={onCreateTag}
        onRenameTag={onRenameTag}
        onSetTagColor={onSetTagColor}
        onDeleteTag={onDeleteTag}
        onReorderModTags={onReorderModTags}
      />
    </DiagnosticRowMenu>
  );
}

function InactiveEntryIcon({
  entry,
  mod,
}: {
  entry: ModListEntryDto;
  mod: ModMetadataDto | undefined;
}) {
  if (entry.kind === 'group') return <Layers className="size-4 text-muted-foreground" />;
  if (entry.kind === 'mod') {
    return <ModTypeIcon hasAssemblies={mod?.hasAssemblies ?? false} sourceKind={mod?.sourceKind} />;
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

function inactiveRowClassName(isDragging: boolean, missing: boolean): string {
  return cn(
    'relative flex h-7 select-none items-center gap-2 border-b border-border px-2 text-left text-sm',
    missing && 'text-muted-foreground',
    isDragging ? 'opacity-40' : 'hover:bg-accent/50',
  );
}
