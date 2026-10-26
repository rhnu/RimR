import { useCallback, useMemo, type ReactNode } from 'react';
import { useTagCommands } from '@/features/library/hooks/use-tag-commands';
import { useAutoMissingModsPrompt } from '@/features/order/hooks/use-auto-missing-mods-prompt';
import { useOrderDerivedData } from '@/features/order/hooks/use-order-derived-data';
import { useOrderDraft } from '@/features/order/hooks/use-order-draft';
import { useOrderEditActions } from '@/features/order/hooks/use-order-edit-actions';
import { useOrderPreview } from '@/features/order/hooks/use-order-preview';
import { useOrderSelection } from '@/features/order/hooks/use-order-selection';
import { useOrderValidation } from '@/features/order/hooks/use-order-validation';
import type { OrderDialog } from '@/features/order/types';
import { useOrderDialogStore } from '@/stores/order-dialog-store';
import { ModCatalogProvider } from './mod-catalog-context';
import {
  OrderContentContext,
  OrderInteractionContext,
  OrderActionsContext,
  OrderDragContext,
} from './order-workspace-context';
import type {
  OrderData,
  OrderDraftState,
  OrderDerived,
  OrderSelection,
  OrderCommands,
  OrderSync,
  OrderFilters,
  OrderWorkspaceBase,
  OrderPreview,
} from './workspace-types';
import type { OrderValidation } from '../hooks/use-order-validation';
import { OrderDialogView } from '../ui/order-dialog-view';
import {
  useApplyWithDiff,
  useControllerCommands,
  useControllerDrag,
  useControllerSync,
  useOpenHandlers,
  useOrderFilters,
  useOrderSensors,
  useResetSelectionsOnModListChange,
} from './workspace-hooks';

type OrderCommandsBase = OrderCommands;
type DerivedWithDiff = OrderDerived & { differsFromGame: boolean };

type OrderWorkspaceProviderProps = {
  scan: OrderData['scan'];
  library: OrderData['library'];
  activeList: OrderData['activeList'];
  appConfig: OrderData['appConfig'];
  children: ReactNode;
};

export function OrderWorkspaceProvider({
  scan,
  library,
  activeList,
  appConfig,
  children,
}: OrderWorkspaceProviderProps) {
  const data: OrderData = useMemo(
    () => ({ appConfig, scan, activeList, library }),
    [appConfig, scan, activeList, library],
  );
  const value = useOrderWorkspaceBase(data);
  const content = useMemo(
    () => ({
      data: value.data,
      draftState: value.draftState,
      validation: value.validation,
      derived: value.derived,
    }),
    [value.data, value.draftState, value.validation, value.derived],
  );
  return (
    <OrderContentContext.Provider value={content}>
      <OrderInteractionContext.Provider
        value={{ filters: value.filters, preview: value.preview, selection: value.selection }}
      >
        <OrderActionsContext.Provider
          value={{
            commands: value.commands,
            sync: value.sync,
            editActions: value.editActions,
            tagCommands: value.tagCommands,
            setDialog: value.setDialog,
            handleOpenModFolder: value.handleOpenModFolder,
            handleOpenSteamWorkshopPage: value.handleOpenSteamWorkshopPage,
          }}
        >
          <OrderDragProvider
            data={value.data}
            draftState={value.draftState}
            derived={value.derived}
            selection={value.selection}
          >
            <ModCatalogProvider value={value.derived.modByPackageId}>
              {children}
              <OrderDialogView onSubmit={value.editActions.handleDialogSubmit} />
            </ModCatalogProvider>
          </OrderDragProvider>
        </OrderActionsContext.Provider>
      </OrderInteractionContext.Provider>
    </OrderContentContext.Provider>
  );
}

function useOrderWorkspaceBase(data: OrderData): OrderWorkspaceBase {
  const core = useOrderWorkspaceCore(data);
  const aux = useOrderWorkspaceAux(data, core);
  const dialog = useOrderDialogStore((state) => state.dialog);
  useAutoMissingModsPrompt({
    draft: core.draftState.draft,
    mods: core.derived.mods,
    hasOpenDialog: dialog !== null,
    setDialog: core.setDialog,
  });
  const { commandsBase: _commandsBase, ...corePublic } = core;
  void _commandsBase;
  return { ...corePublic, ...aux };
}

type OrderWorkspaceCore = {
  data: OrderData;
  preview: OrderPreview;
  draftState: OrderDraftState;
  setDialog: (dialog: OrderDialog) => void;
  filters: OrderFilters;
  validation: OrderValidation;
  derived: DerivedWithDiff;
  selection: OrderSelection;
  commandsBase: OrderCommandsBase;
  sync: OrderSync;
};

function useOrderWorkspaceCore(data: OrderData): OrderWorkspaceCore {
  const preview = useOrderPreview();
  const draftState = useOrderDraft();
  const setDialog = useDialogSetter();
  const filters = useOrderFilters();
  const validation = useOrderValidation(draftState.draft, data.scan.data, data.scan.dataUpdatedAt);
  const derived = useDerivedWithDiff(data, draftState, validation, filters);
  const selection = useOrderSelection({
    modByPackageId: derived.modByPackageId,
    orderedInactiveCatalogKeys: derived.inactiveCatalogKeys,
    inactiveSourceKeys: derived.inactiveSourceKeys,
    visibleActiveEntryIds: derived.visibleActiveEntryIds,
    activeSourceKeys: derived.activeSourceKeys,
    warmSelectedPreview: preview.warmSelectedPreview,
  });
  const commandsBase = useControllerCommands(draftState);
  const sync = useControllerSync(data, draftState, derived.mods, selection, setDialog);
  return {
    data,
    preview,
    draftState,
    setDialog,
    filters,
    validation,
    derived,
    selection,
    commandsBase,
    sync,
  };
}

function useDialogSetter(): (dialog: OrderDialog) => void {
  const open = useOrderDialogStore((state) => state.open);
  const close = useOrderDialogStore((state) => state.close);
  return useCallback(
    (dialog: OrderDialog) => {
      if (dialog === null) close();
      else open(dialog);
    },
    [open, close],
  );
}

function useDerivedWithDiff(
  data: OrderData,
  draftState: OrderDraftState,
  validation: OrderValidation,
  filters: OrderFilters,
): DerivedWithDiff {
  const base = useOrderDerivedData({
    scan: data.scan.data,
    library: data.library.data,
    draft: draftState.draft,
    activeMods: data.activeList.data?.activeMods ?? [],
    validationResult: validation.validationResult,
    inactiveSearch: filters.inactiveSearch,
    activeSearch: filters.activeSearch,
    availableSortKey: filters.availableSortKey,
    availableSortDirection: filters.availableSortDirection,
  });
  const differsFromGame =
    draftState.draft != null &&
    data.activeList.data != null &&
    base.draftActiveModsKey !== base.gameActiveModsKey;
  return useMemo(() => ({ ...base, differsFromGame }), [base, differsFromGame]);
}

type OrderWorkspaceAux = Omit<OrderWorkspaceBase, keyof OrderWorkspaceCore>;

function useOrderWorkspaceAux(data: OrderData, core: OrderWorkspaceCore): OrderWorkspaceAux {
  const handleApplyWithDiff = useApplyWithDiff(data, core.draftState, core.derived, core.setDialog);
  const commands = useMemo(
    () => ({ ...core.commandsBase, handleApplyWithDiff }),
    [core.commandsBase, handleApplyWithDiff],
  );
  const editActions = useEditActions(core);
  const openHandlers = useOpenHandlers();
  const tagCommands = useTagCommands();
  useResetSelectionsOnModListChange(
    data.library.data?.currentModList,
    core.selection.resetSelections,
  );
  return { commands, editActions, tagCommands, ...openHandlers };
}

function useEditActions(core: OrderWorkspaceCore) {
  return useOrderEditActions({
    setDialog: core.setDialog,
    draft: core.draftState.draft,
    selectedEntryIds: core.selection.selectedEntryIds,
    selectedInactiveCatalogKeys: core.selection.selectedInactiveCatalogKeys,
    sortedInactiveMods: core.derived.sortedInactiveMods,
    modByPackageId: core.derived.modByPackageId,
    aliases: core.data.library.data?.settings.aliases ?? [],
    applyDraft: core.draftState.applyDraft,
    resetSelections: core.selection.resetSelections,
    onSaveAlias: core.commandsBase.handleSaveAlias,
    onApplyGameSync: core.sync.applyGameSync,
    onApplySaveSync: core.sync.applySaveSync,
    onApplyToGame: core.commandsBase.handleApply,
    onRemoveMissingMods: core.sync.applyMissingModRemoval,
    onDiscardDraft: core.draftState.resetToBaseline,
  });
}

function OrderDragProvider({
  data,
  draftState,
  derived,
  selection,
  children,
}: {
  data: OrderData;
  draftState: OrderDraftState;
  derived: OrderDerived;
  selection: OrderSelection;
  children: ReactNode;
}) {
  const drag = useControllerDrag(data, draftState, derived, selection);
  const sensors = useOrderSensors();
  return (
    <OrderDragContext.Provider value={{ drag, sensors }}>{children}</OrderDragContext.Provider>
  );
}
