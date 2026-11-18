import { useMemo } from 'react';
import type { ModIdentityDto, ModListDto } from '@/commands';
import { useTagCommands } from '@/features/library/hooks/use-tag-commands';
import { catalogItemKey, isPackageAddressableMod } from '@/domain/mods/catalog';
import {
  canCreateActiveGroup,
  canCreateInactiveGroup,
  selectedActiveModIdentities,
  selectedInactiveModIdentities,
} from '../model';
import type { createDiagnosticTargets, OrderDiagnosticTarget } from '../model/diagnostic-targets';
import { ActiveModsPanel } from '../ui/active-mods-panel';
import { InactiveModsPanel } from '../ui/inactive-mods-panel';
import type { DiagnosticActions } from '../ui/diagnostic-report';
import { useOpenHandlers } from './workspace-hooks';
import type {
  OrderDerived,
  OrderDrag,
  OrderEditActions,
  OrderFilters,
  OrderModSettings,
  OrderPreview,
  OrderSelection,
} from './workspace-types';

type OrderListsProps = {
  settings: OrderModSettings;
  entries: ModListDto['entries'];
  selection: OrderSelection;
  filters: OrderFilters;
  derived: Pick<
    OrderDerived,
    | 'activeRows'
    | 'activeCount'
    | 'inactiveRows'
    | 'sortedInactiveMods'
    | 'modByPackageId'
    | 'modByCatalogKey'
  >;
  preview: OrderPreview;
  edit: OrderEditActions;
  dropIndicatorStore: OrderDrag['dropIndicatorStore'];
  diagnostics: ReturnType<typeof createDiagnosticTargets>;
  diagnosticActions: DiagnosticActions;
};

export function OrderWorkspaceLists(props: OrderListsProps) {
  const rows = useListRows(props);
  const { activeRows } = props.derived;
  const { selectedEntryIds } = props.selection;
  const selectedActiveTags = useMemo(
    () => selectedActiveModIdentities(activeRows, selectedEntryIds),
    [activeRows, selectedEntryIds],
  );
  return (
    <>
      <WorkspaceInactiveList {...props} rowProps={rows} selectedActiveTags={selectedActiveTags} />
      <WorkspaceActiveList {...props} rowProps={rows} selectedActiveTags={selectedActiveTags} />
    </>
  );
}

function useListRows({
  settings,
  entries,
  selection,
  derived,
  preview,
  diagnostics,
  diagnosticActions,
}: OrderListsProps) {
  const { aliases, tagDefs, modTags } = settings;
  const { selectedEntryIds, selectedInactiveCatalogKeys } = selection;
  const { modByPackageId, modByCatalogKey } = derived;
  const open = useOpenHandlers();
  const tagCommands = useTagCommands();
  const diagnosticMenus = useMemo(
    () => ({
      forTarget: (target: OrderDiagnosticTarget) =>
        diagnostics.menuForTarget(target, {
          entryIds: selectedEntryIds,
          catalogKeys: selectedInactiveCatalogKeys,
          entries,
          catalog: modByCatalogKey,
        }),
      actions: diagnosticActions,
      modByPackageId,
    }),
    [
      diagnostics,
      selectedEntryIds,
      selectedInactiveCatalogKeys,
      entries,
      modByCatalogKey,
      modByPackageId,
      diagnosticActions,
    ],
  );
  return {
    aliases,
    tagDefs,
    modTags,
    modByPackageId,
    diagnosticsForTarget: diagnostics.forTarget,
    diagnosticMenus,
    onWarmFileInfo: preview.warmModPreview,
    onOpenModFolder: open.handleOpenModFolder,
    onOpenSteamWorkshopPage: open.handleOpenSteamWorkshopPage,
    onToggleModTag: tagCommands.handleToggleModTags,
    onCreateTag: tagCommands.handleCreateTag,
    onRenameTag: tagCommands.handleRenameTag,
    onSetTagColor: tagCommands.handleSetTagColor,
    onDeleteTag: tagCommands.handleDeleteTag,
    onReorderModTags: tagCommands.handleReorderModTags,
  };
}

type ListProps = OrderListsProps & {
  rowProps: ReturnType<typeof useListRows>;
  selectedActiveTags: ModIdentityDto[];
};

function WorkspaceInactiveList({
  derived,
  selection,
  filters,
  edit,
  rowProps,
  selectedActiveTags,
}: ListProps) {
  const { sortedInactiveMods } = derived;
  const { selectedInactiveCatalogKeys } = selection;
  const selectedInactiveTags = useMemo(
    () => selectedInactiveModIdentities(sortedInactiveMods, selectedInactiveCatalogKeys),
    [sortedInactiveMods, selectedInactiveCatalogKeys],
  );
  const canGroupInactive = useMemo(
    () =>
      canCreateInactiveGroup(
        new Set(
          sortedInactiveMods
            .filter(
              (mod) =>
                selectedInactiveCatalogKeys.has(catalogItemKey(mod)) &&
                isPackageAddressableMod(mod),
            )
            .map(catalogItemKey),
        ),
      ),
    [sortedInactiveMods, selectedInactiveCatalogKeys],
  );
  return (
    <InactiveModsPanel
      {...rowProps}
      rows={derived.inactiveRows}
      selectedCatalogKeys={selectedInactiveCatalogKeys}
      selectedInactiveTagIdentities={selectedInactiveTags}
      selectedActiveTagIdentities={selectedActiveTags}
      canCreateGroup={canGroupInactive}
      filters={{
        search: filters.inactiveSearch,
        sortKey: filters.availableSortKey,
        sortDirection: filters.availableSortDirection,
        onSearchChange: filters.setInactiveSearch,
        onSortKeyChange: filters.setAvailableSortKey,
        onToggleSortDirection: filters.toggleAvailableSortDirection,
      }}
      onSelect={selection.selectInactiveMod}
      onSelectEntry={selection.selectActiveEntry}
      onSelectChild={selection.selectGroupChild}
      onContextOpen={selection.ensureInactiveSelected}
      onContextOpenEntry={selection.ensureActiveSelected}
      onAdd={edit.addInactiveMod}
      onActivateEntry={edit.activateInactiveEntry}
      onActivateChild={edit.activateInactiveChild}
      onDoubleClick={edit.addInactiveMod}
      onRenameGroup={edit.renameActiveGroup}
      onCreateGroup={edit.createInactiveGroupDialog}
      onEditAlias={edit.editInactiveAlias}
      onEditActiveAlias={edit.editActiveAlias}
    />
  );
}

function WorkspaceActiveList({
  derived,
  selection,
  filters,
  edit,
  dropIndicatorStore,
  rowProps,
  selectedActiveTags,
}: ListProps) {
  const { selectedEntryIds } = selection;
  return (
    <ActiveModsPanel
      {...rowProps}
      rows={derived.activeRows}
      count={derived.activeCount}
      search={filters.activeSearch}
      onSearchChange={filters.setActiveSearch}
      selectedEntryIds={selectedEntryIds}
      selectedTagIdentities={selectedActiveTags}
      canCreateGroup={canCreateActiveGroup(selectedEntryIds)}
      dropIndicatorStore={dropIndicatorStore}
      onSelectEntry={selection.selectActiveEntry}
      onContextOpen={selection.ensureActiveSelected}
      onRemove={edit.removeActiveEntry}
      onDoubleClickEntry={edit.handleActiveDoubleClick}
      onUngroup={edit.ungroupActiveEntry}
      onCreateGroup={edit.createActiveGroupDialog}
      onEditAlias={edit.editActiveAlias}
      onAddSeparator={edit.addSeparatorAbove}
      onRenameGroup={edit.renameActiveGroup}
      onRenameSeparator={edit.renameActiveSeparator}
      onSelectChild={selection.selectGroupChild}
      onDoubleClickChild={edit.removeGroupChild}
      onRemoveChild={edit.removeGroupChild}
    />
  );
}
