import { useMemo, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  DiagnosticDto,
  DisplayAliasDto,
  ModIdentityDto,
  ModListEntryDto,
  ModListGroupChildDto,
  ModMetadataDto,
  ModTagBindingDto,
  SteamWorkshopOpenTarget,
  TagDefDto,
} from '@/commands';
import { Input } from '@/components/ui/input';
import { DroppablePanel } from '@/features/order/Panels';
import { ActiveEntryRow, GroupChildRow } from '@/features/order/Rows';
import type { Selection } from '@/features/order/types';
import type { ActiveRenderRow } from '@/features/order/model';
import {
  canCreateActiveGroup,
  selectedActiveModIdentities,
  tagTargetsForEntry,
} from '@/features/order/model';
import type { DropIndicatorStore } from '@/features/order/hooks/dropIndicatorStore';
import { ACTIVE_DROP_ID } from './workspaceConstants';
import {
  useOrderWorkspaceData,
  useOrderWorkspaceDerived,
  useOrderWorkspaceDraftState,
  useOrderWorkspaceDrag,
  useOrderWorkspaceEditActions,
  useOrderWorkspaceFilters,
  useOrderWorkspaceOpenHandlers,
  useOrderWorkspacePreview,
  useOrderWorkspaceSelection,
  useOrderWorkspaceTagCommands,
} from './context/hooks';

type ActiveRowsProps = {
  rows: ActiveRenderRow[];
  aliases: DisplayAliasDto[];
  tagDefs: TagDefDto[];
  modTags: ModTagBindingDto[];
  selectedEntryIds: Set<string>;
  diagnosticsByPackage: Map<string, DiagnosticDto[]>;
  modByPackageId: Map<string, ModMetadataDto>;
  dropIndicatorStore: DropIndicatorStore;
  onWarmFileInfo: (sourceKey: string | null | undefined, immediate?: boolean) => void;
  onSelectEntry: (
    entry: ModListEntryDto,
    selection: Selection,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void;
  onContextOpen: (entry: ModListEntryDto) => void;
  onRemove: (entryId: string) => void;
  onDoubleClickEntry: (entry: ModListEntryDto) => void;
  onUngroup: (groupId: string) => void;
  onCreateGroup: () => void;
  onEditAlias: (identity: ModIdentityDto) => void;
  onAddSeparator: (entry: ModListEntryDto) => void;
  onRenameGroup: (entryId: string, name: string) => void;
  onRenameSeparator: (entryId: string, title: string) => void;
  onSelectChild: (child: ModListGroupChildDto) => void;
  onDoubleClickChild: (groupId: string, childId: string) => void;
  onRemoveChild: (groupId: string, childId: string) => void;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
  onToggleModTag: (identities: ModIdentityDto[], tagId: string) => void;
  onCreateTag: (name: string, color: string | null) => void;
  onRenameTag: (tagId: string, name: string) => void;
  onSetTagColor: (tagId: string, color: string | null) => void;
  onDeleteTag: (tagId: string) => void;
  onReorderModTags: (identity: ModIdentityDto, tagIds: string[]) => void;
};

export function ActiveModsPanel() {
  const { t } = useTranslation();
  const { library } = useOrderWorkspaceData();
  const { draft } = useOrderWorkspaceDraftState();
  const filters = useOrderWorkspaceFilters();
  const derived = useOrderWorkspaceDerived();
  const selection = useOrderWorkspaceSelection();
  const drag = useOrderWorkspaceDrag();
  const editActions = useOrderWorkspaceEditActions();
  const preview = useOrderWorkspacePreview();
  const open = useOrderWorkspaceOpenHandlers();
  const tagCommands = useOrderWorkspaceTagCommands();
  if (!draft) return null;
  const rowsProps: ActiveRowsProps = {
    rows: derived.activeRows,
    aliases: library.data?.settings.aliases ?? [],
    tagDefs: library.data?.settings.tagDefs ?? [],
    modTags: library.data?.settings.modTags ?? [],
    selectedEntryIds: selection.selectedEntryIds,
    diagnosticsByPackage: derived.diagnosticsMap,
    modByPackageId: derived.modByPackageId,
    dropIndicatorStore: drag.dropIndicatorStore,
    onWarmFileInfo: preview.warmModPreview,
    onSelectEntry: selection.selectActiveEntry,
    onContextOpen: selection.ensureActiveSelected,
    onRemove: editActions.removeActiveEntry,
    onDoubleClickEntry: editActions.handleActiveDoubleClick,
    onUngroup: editActions.ungroupActiveEntry,
    onCreateGroup: editActions.createActiveGroupDialog,
    onEditAlias: editActions.editActiveAlias,
    onAddSeparator: editActions.addSeparatorAbove,
    onRenameGroup: editActions.renameActiveGroup,
    onRenameSeparator: editActions.renameActiveSeparator,
    onSelectChild: selection.selectGroupChild,
    onDoubleClickChild: editActions.removeGroupChild,
    onRemoveChild: editActions.removeGroupChild,
    onOpenModFolder: open.handleOpenModFolder,
    onOpenSteamWorkshopPage: open.handleOpenSteamWorkshopPage,
    onToggleModTag: tagCommands.handleToggleModTags,
    onCreateTag: tagCommands.handleCreateTag,
    onRenameTag: tagCommands.handleRenameTag,
    onSetTagColor: tagCommands.handleSetTagColor,
    onDeleteTag: tagCommands.handleDeleteTag,
    onReorderModTags: tagCommands.handleReorderModTags,
  };
  return (
    <DroppablePanel
      id={ACTIVE_DROP_ID}
      title={t('order.activeModListTitle')}
      count={draft.activeMods.length}
      actions={
        <Input
          value={filters.activeSearch}
          onChange={(event) => filters.setActiveSearch(event.target.value)}
          placeholder={t('order.searchActive')}
          aria-label={t('order.searchActive')}
          className="h-7 w-40 px-2 text-xs shadow-none"
        />
      }
    >
      <ActiveRows {...rowsProps} />
    </DroppablePanel>
  );
}

function ActiveRows(props: ActiveRowsProps) {
  const selectedTagIdentities = useMemo(
    () => selectedActiveModIdentities(props.rows, props.selectedEntryIds),
    [props.rows, props.selectedEntryIds],
  );
  return (
    <>
      {props.rows.map((row, index) =>
        row.kind === 'entry' ? (
          <ActiveEntryRow
            key={row.id}
            entry={row.entry}
            index={index}
            aliases={props.aliases}
            tagDefs={props.tagDefs}
            modTags={props.modTags}
            tagTargetIdentities={tagTargetsForEntry(row.entry, selectedTagIdentities)}
            modByPackageId={props.modByPackageId}
            diagnosticsByPackage={props.diagnosticsByPackage}
            selected={row.entry.kind === 'mod' && props.selectedEntryIds.has(row.entry.id)}
            canCreateGroup={canCreateActiveGroup(props.selectedEntryIds)}
            dropIndicatorStore={props.dropIndicatorStore}
            onWarmFileInfo={props.onWarmFileInfo}
            onSelect={props.onSelectEntry}
            onContextOpen={props.onContextOpen}
            onRemove={props.onRemove}
            onDoubleClick={props.onDoubleClickEntry}
            onUngroup={props.onUngroup}
            onCreateGroup={props.onCreateGroup}
            onEditAlias={props.onEditAlias}
            onAddSeparator={props.onAddSeparator}
            onRenameGroup={props.onRenameGroup}
            onRenameSeparator={props.onRenameSeparator}
            onOpenModFolder={props.onOpenModFolder}
            onOpenSteamWorkshopPage={props.onOpenSteamWorkshopPage}
            onToggleModTag={props.onToggleModTag}
            onCreateTag={props.onCreateTag}
            onRenameTag={props.onRenameTag}
            onSetTagColor={props.onSetTagColor}
            onDeleteTag={props.onDeleteTag}
            onReorderModTags={props.onReorderModTags}
          />
        ) : (
          <GroupChildRow
            key={row.id}
            groupId={row.groupId}
            child={row.child}
            aliases={props.aliases}
            tagDefs={props.tagDefs}
            modTags={props.modTags}
            modByPackageId={props.modByPackageId}
            diagnostics={props.diagnosticsByPackage.get(row.child.identity.packageId) ?? []}
            dropIndicatorStore={props.dropIndicatorStore}
            onWarmFileInfo={props.onWarmFileInfo}
            onSelect={props.onSelectChild}
            onDoubleClick={props.onDoubleClickChild}
            onEditAlias={props.onEditAlias}
            onOpenModFolder={props.onOpenModFolder}
            onOpenSteamWorkshopPage={props.onOpenSteamWorkshopPage}
            onToggleModTag={props.onToggleModTag}
            onCreateTag={props.onCreateTag}
            onRenameTag={props.onRenameTag}
            onSetTagColor={props.onSetTagColor}
            onDeleteTag={props.onDeleteTag}
            onReorderModTags={props.onReorderModTags}
            onRemove={props.onRemoveChild}
          />
        ),
      )}
    </>
  );
}
