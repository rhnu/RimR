import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useTagCommands } from '@/features/tags/useTagCommands';
import { useAutoMissingModsPrompt } from '@/features/order/hooks/useAutoMissingModsPrompt';
import type { useOrderData } from '@/features/order/hooks/useOrderData';
import { useOrderDerivedData } from '@/features/order/hooks/useOrderDerivedData';
import { useOrderDraft } from '@/features/order/hooks/useOrderDraft';
import { useOrderEditActions } from '@/features/order/hooks/useOrderEditActions';
import { useOrderPreview } from '@/features/order/hooks/useOrderPreview';
import { useOrderSelection } from '@/features/order/hooks/useOrderSelection';
import { useOrderValidation } from '@/features/order/hooks/useOrderValidation';
import type { OrderDialog } from '@/features/order/types';
import { useOrderDialogStore } from '@/stores/orderDialogStore';
import { ModCatalogProvider } from './ModCatalogContext';
import {
  OrderWorkspaceContext,
  type OrderFilters,
  type OrderWorkspaceValue,
} from './OrderWorkspaceContext';
import {
  useApplyWithDiff,
  useControllerCommands,
  useControllerDrag,
  useControllerSync,
  useOpenHandlers,
  useOrderFilters,
  useOrderSensors,
  useResetSelectionsOnModListChange,
} from './workspaceHooks';

type OrderData = ReturnType<typeof useOrderData>;
type OrderDraftState = ReturnType<typeof useOrderDraft>;
type OrderDerived = ReturnType<typeof useOrderDerivedData>;
type OrderSelection = ReturnType<typeof useOrderSelection>;
type OrderCommandsBase = ReturnType<typeof useControllerCommands>;
type OrderSync = ReturnType<typeof useControllerSync>;
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
  const value = useOrderWorkspaceValue(data);
  return (
    <OrderWorkspaceContext.Provider value={value}>
      <ModCatalogProvider value={value.derived.modByPackageId}>
        <RegisterOrderEditHandler handler={value.editActions.handleDialogSubmit} />
        {children}
      </ModCatalogProvider>
    </OrderWorkspaceContext.Provider>
  );
}

function RegisterOrderEditHandler({ handler }: { handler: (value: string) => void }) {
  useEffect(() => {
    useOrderDialogStore.getState().setOrderEditHandler(handler);
    return () => {
      useOrderDialogStore.getState().setOrderEditHandler(null);
    };
  }, [handler]);
  return null;
}

function useOrderWorkspaceValue(data: OrderData): OrderWorkspaceValue {
  const core = useOrderWorkspaceCore(data);
  const aux = useOrderWorkspaceAux(data, core);
  const dialog = useOrderDialogStore((state) => state.dialog);
  useAutoMissingModsPrompt({
    draft: core.draftState.draft,
    mods: core.derived.mods,
    dialog,
    setDialog: core.setDialog,
  });
  const { commandsBase: _commandsBase, ...corePublic } = core;
  void _commandsBase;
  return { ...corePublic, ...aux };
}

type OrderWorkspaceCore = {
  data: OrderData;
  preview: ReturnType<typeof useOrderPreview>;
  draftState: OrderDraftState;
  setDialog: (dialog: OrderDialog) => void;
  filters: OrderFilters;
  validation: ReturnType<typeof useOrderValidation>;
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
  const validation = useOrderValidation(draftState.draft, data.scan.data);
  const derived = useDerivedWithDiff(data, draftState, validation, filters);
  const selection = useOrderSelection({
    modByPackageId: derived.modByPackageId,
    inactivePackageIds: derived.inactiveCatalogKeys,
    inactiveSourceKeys: derived.inactiveSourceKeys,
    visibleActiveEntryIds: derived.visibleActiveEntryIds,
    activeSourceKeys: derived.activeSourceKeys,
    warmSelectedPreview: preview.warmSelectedPreview,
  });
  const commandsBase = useControllerCommands(data, draftState);
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
  validation: ReturnType<typeof useOrderValidation>,
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

type OrderWorkspaceAux = Omit<OrderWorkspaceValue, keyof OrderWorkspaceCore>;

function useOrderWorkspaceAux(data: OrderData, core: OrderWorkspaceCore): OrderWorkspaceAux {
  const handleApplyWithDiff = useApplyWithDiff(data, core.draftState, core.derived, core.setDialog);
  const commands = useMemo(
    () => ({ ...core.commandsBase, handleApplyWithDiff }),
    [core.commandsBase, handleApplyWithDiff],
  );
  const editActions = useEditActions(core);
  const drag = useControllerDrag(data, core.draftState, core.derived, core.selection);
  const openHandlers = useOpenHandlers();
  const tagCommands = useTagCommands({
    library: data.library.data,
    refetchLibrary: () => {
      void data.library.refetch();
    },
  });
  useResetSelectionsOnModListChange(
    data.library.data?.currentModList,
    core.selection.resetSelections,
  );
  return { commands, editActions, drag, tagCommands, ...openHandlers, sensors: useOrderSensors() };
}

function useEditActions(core: OrderWorkspaceCore) {
  return useOrderEditActions({
    setDialog: core.setDialog,
    draft: core.draftState.draft,
    selectedEntryIds: core.selection.selectedEntryIds,
    selectedInactivePackageIds: core.selection.selectedInactivePackageIds,
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
