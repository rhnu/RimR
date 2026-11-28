import type { ComponentProps } from 'react';
import type { LibraryDto, ModListDto, ModTagBindingDto, TagDefDto } from '@/commands';
import { useLaunchGame } from '@/queries/native';
import { useOrderDialogStore } from '@/stores/order-dialog-store';
import { useAutoMissingModsPrompt } from '../hooks/use-auto-missing-mods-prompt';
import { useOrderCommands } from '../hooks/use-order-commands';
import { useOrderDrag } from '../hooks/use-order-drag';
import { useOrderDerivedData } from '../hooks/use-order-derived-data';
import { useOrderEditActions } from '../hooks/use-order-edit-actions';
import { useOrderPreview } from '../hooks/use-order-preview';
import { useOrderSelection } from '../hooks/use-order-selection';
import { useOrderValidation } from '../hooks/use-order-validation';
import type { OrderDialog } from '../types';
import { OrderToolbar } from '../ui/order-toolbar';
import { OrderWorkspaceView } from '../ui/order-workspace-view';
import { OrderInspector } from './order-inspector';
import { OrderWorkspaceDialog } from './order-workspace-dialog';
import { OrderWorkspaceLists } from './order-workspace-lists';
import { useOrderDiagnosticReport } from './use-order-diagnostic-report';
import {
  useApplyWithDiff,
  useControllerSync,
  useOrderFilters,
  useOrderSensors,
  useResetSelectionsOnModListChange,
} from './workspace-hooks';
import type { OrderWorkspaceData, OrderDraftState, OrderModSettings } from './workspace-types';

const EMPTY_ACTIVE_MODS: string[] = [];
const EMPTY_TAG_DEFS: TagDefDto[] = [];
const EMPTY_MOD_TAGS: ModTagBindingDto[] = [];

type OrderWorkspaceProps = {
  data: OrderWorkspaceData;
  library: LibraryDto;
  draftState: OrderDraftState & { draft: ModListDto };
};

export function OrderWorkspace({ data, library, draftState }: OrderWorkspaceProps) {
  const { draft } = draftState;
  const { aliases, tagDefs = EMPTY_TAG_DEFS, modTags = EMPTY_MOD_TAGS } = library.settings;
  const settings = { aliases, tagDefs, modTags };
  const { filters, preview, validation, derived, selection, sensors, drag } = useWorkspaceOrder(
    data,
    library,
    draftState,
    settings,
  );
  const diagnosticReport = useOrderDiagnosticReport(derived, validation.phase);
  const { commands, sync, edit, onApply } = useWorkspaceEditing(
    data,
    draftState,
    derived,
    selection,
    aliases,
    diagnosticReport.dialog !== null,
  );
  const { modByPackageId, modByCatalogKey } = derived;
  return (
    <OrderWorkspaceView
      drag={drag}
      sensors={sensors}
      toolbar={
        <WorkspaceToolbar
          data={data}
          library={library}
          draftState={draftState}
          validation={diagnosticReport.summaryProps}
          differsFromGame={derived.draftActiveModsKey !== derived.gameActiveModsKey}
          commands={commands}
          sync={sync}
          onApply={onApply}
        />
      }
      metadata={
        <OrderInspector
          draft={draft}
          selection={selection.selection}
          modByPackageId={modByPackageId}
          modByCatalogKey={modByCatalogKey}
          settings={settings}
          diagnosticsForTarget={diagnosticReport.targets.forTarget}
          diagnosticActions={diagnosticReport.actions}
        />
      }
      lists={
        <OrderWorkspaceLists
          settings={settings}
          entries={draft.entries}
          selection={selection}
          filters={filters}
          derived={derived}
          preview={preview}
          edit={edit}
          dropIndicatorStore={drag.dropIndicatorStore}
          diagnostics={diagnosticReport.targets}
          onOpenDiagnosticScope={diagnosticReport.open}
        />
      }
      dialog={
        <>
          <OrderWorkspaceDialog
            modByPackageId={modByPackageId}
            onSubmit={edit.handleDialogSubmit}
          />
          {diagnosticReport.dialog}
        </>
      }
    />
  );
}

function useWorkspaceOrder(
  data: OrderWorkspaceData,
  library: LibraryDto,
  { draft, applyDraft }: OrderWorkspaceProps['draftState'],
  settings: OrderModSettings,
) {
  const filters = useOrderFilters();
  const preview = useOrderPreview();
  const validation = useOrderValidation(draft, data.scan.data, data.scan.dataUpdatedAt);
  const derived = useOrderDerivedData({
    scan: data.scan.data,
    library,
    draft,
    activeMods: data.activeList.data?.activeMods ?? EMPTY_ACTIVE_MODS,
    validationResult: validation.validationResult,
    inactiveSearch: filters.inactiveSearch,
    activeSearch: filters.activeSearch,
    availableSortKey: filters.availableSortKey,
    availableSortDirection: filters.availableSortDirection,
  });
  const selection = useOrderSelection({
    modByPackageId: derived.modByPackageId,
    orderedInactiveCatalogKeys: derived.inactiveCatalogKeys,
    inactiveSourceKeys: derived.inactiveSourceKeys,
    visibleActiveEntryIds: derived.visibleActiveEntryIds,
    activeSourceKeys: derived.activeSourceKeys,
    warmSelectedPreview: preview.warmSelectedPreview,
  });
  useResetSelectionsOnModListChange(library.currentModList, selection.resetSelections);
  const sensors = useOrderSensors();
  const drag = useOrderDrag({
    ...settings,
    draft,
    applyDraft,
    modByPackageId: derived.modByPackageId,
    modByCatalogKey: derived.modByCatalogKey,
    selectedInactiveCatalogKeys: selection.selectedInactiveCatalogKeys,
    orderedInactiveCatalogKeys: derived.inactiveCatalogKeys,
    selectedEntryIds: selection.selectedEntryIds,
    visibleActiveEntryIds: derived.visibleActiveEntryIds,
  });
  return { filters, preview, validation, derived, selection, sensors, drag };
}

function useWorkspaceEditing(
  data: OrderWorkspaceData,
  draftState: OrderWorkspaceProps['draftState'],
  derived: ReturnType<typeof useWorkspaceOrder>['derived'],
  selection: ReturnType<typeof useWorkspaceOrder>['selection'],
  aliases: LibraryDto['settings']['aliases'],
  hasDiagnosticReport: boolean,
) {
  const { draft, applyDraft } = draftState;
  const hasOpenDialog = useOrderDialogStore((state) => state.dialog !== null);
  useAutoMissingModsPrompt({
    draft,
    mods: derived.mods,
    hasOpenDialog: hasOpenDialog || hasDiagnosticReport,
    setDialog,
  });
  const commands = useOrderCommands({ draft, acceptSaved: draftState.acceptSaved });
  const sync = useControllerSync(data, draftState, derived.mods, selection, setDialog);
  const onApply = useApplyWithDiff(data, draftState, derived, setDialog);
  const edit = useOrderEditActions({
    setDialog,
    draft,
    selectedEntryIds: selection.selectedEntryIds,
    selectedInactiveCatalogKeys: selection.selectedInactiveCatalogKeys,
    sortedInactiveMods: derived.sortedInactiveMods,
    modByPackageId: derived.modByPackageId,
    aliases,
    applyDraft,
    resetSelections: selection.resetSelections,
    onSaveAlias: commands.handleSaveAlias,
    onApplyGameSync: sync.applyGameSync,
    onApplySaveSync: sync.applySaveSync,
    onApplyToGame: commands.handleApply,
    onRemoveMissingMods: sync.applyMissingModRemoval,
    onDiscardDraft: draftState.resetToBaseline,
  });
  return { commands, sync, edit, onApply };
}

function setDialog(dialog: OrderDialog) {
  const { open, close } = useOrderDialogStore.getState();
  if (dialog) open(dialog);
  else close();
}

function WorkspaceToolbar({
  data,
  library,
  draftState,
  validation,
  commands,
  sync,
  differsFromGame,
  onApply,
}: OrderWorkspaceProps & {
  validation: ComponentProps<typeof OrderToolbar>['validation'];
  commands: ReturnType<typeof useOrderCommands>;
  sync: ReturnType<typeof useControllerSync>;
  differsFromGame: boolean;
  onApply: () => void;
}) {
  const launch = useLaunchGame();
  return (
    <OrderToolbar
      modLists={library.modListsIndex.modLists}
      current={draftState.draft}
      onChange={commands.handleSetCurrentModList}
      modListDirty={draftState.modListDirty}
      hasConflict={draftState.hasConflict}
      differsFromGame={data.activeList.data != null && differsFromGame}
      validation={validation}
      savePending={commands.savePending}
      applyPending={commands.applyPending}
      applyDisabled={data.scan.fetchStatus !== 'idle'}
      activeListFetching={data.activeList.isFetching}
      catalogFetching={data.scan.isFetching}
      launchPending={launch.isPending}
      onSave={commands.handleSaveModList}
      onApply={onApply}
      onDiscardDraft={() => setDialog({ kind: 'discardDraft' })}
      onSyncFromGame={sync.handleSyncFromGame}
      onRebuildCatalog={sync.handleRebuildCatalog}
      onLaunch={() => launch.mutate()}
    />
  );
}
