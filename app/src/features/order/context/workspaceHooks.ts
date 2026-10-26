import { useCallback, useEffect, useState } from 'react';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { SteamWorkshopOpenTarget } from '@/commands';
import { useOpenModFolder, useOpenSteamWorkshopPage } from '@/hooks/commands';
import { buildApplyProjection, buildOrderDiff, type ModListAction } from '@/features/order/model';
import { useOrderCommands } from '@/features/order/hooks/useOrderCommands';
import type { useOrderData } from '@/features/order/hooks/useOrderData';
import type { useOrderDerivedData } from '@/features/order/hooks/useOrderDerivedData';
import { useOrderDrag } from '@/features/order/hooks/useOrderDrag';
import type { useOrderDraft } from '@/features/order/hooks/useOrderDraft';
import type { useOrderSelection } from '@/features/order/hooks/useOrderSelection';
import { useOrderSync } from '@/features/order/hooks/useOrderSync';
import { ACTIVE_DROP_ID, INACTIVE_DROP_ID } from '@/features/order/workspaceConstants';
import type { OrderDialog } from '@/features/order/types';
import type { OrderFilters } from './OrderWorkspaceContext';

type OrderData = ReturnType<typeof useOrderData>;
type OrderDraftState = ReturnType<typeof useOrderDraft>;
type OrderDerived = ReturnType<typeof useOrderDerivedData>;
type OrderSelection = ReturnType<typeof useOrderSelection>;

export function useOrderFilters(): OrderFilters {
  const [availableSortKey, setAvailableSortKey] =
    useState<OrderFilters['availableSortKey']>('name');
  const [availableSortDirection, setAvailableSortDirection] =
    useState<OrderFilters['availableSortDirection']>('asc');
  const [inactiveSearch, setInactiveSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const toggleAvailableSortDirection = useCallback(() => {
    setAvailableSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
  }, []);
  return {
    availableSortKey,
    setAvailableSortKey,
    availableSortDirection,
    toggleAvailableSortDirection,
    inactiveSearch,
    setInactiveSearch,
    activeSearch,
    setActiveSearch,
  };
}

export function useOrderSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
}

export function useControllerCommands(data: OrderData, draftState: OrderDraftState) {
  return useOrderCommands({
    draft: draftState.draft,
    library: data.library.data,
    replaceSavedDraft: draftState.replaceSavedDraft,
    refetchActiveList: () => {
      void data.activeList.refetch();
    },
    refetchLibrary: () => {
      void data.library.refetch();
    },
  });
}

export function useControllerSync(
  data: OrderData,
  draftState: OrderDraftState,
  mods: OrderDerived['mods'],
  selection: OrderSelection,
  setDialog: (dialog: OrderDialog) => void,
) {
  return useOrderSync({
    draft: draftState.draft,
    mods,
    modListDirty: draftState.modListDirty,
    activeMods: data.activeList.data?.activeMods,
    refetchScan: () => data.scan.refetch().then((result) => result.data),
    refetchActiveList: () => data.activeList.refetch().then((result) => result.data?.activeMods),
    applyDraft: draftState.applyDraft as (action: ModListAction) => void,
    resetSelections: selection.resetSelections,
    setDialog,
  });
}

export function useControllerDrag(
  data: OrderData,
  draftState: OrderDraftState,
  derived: OrderDerived,
  selection: OrderSelection,
) {
  return useOrderDrag({
    activeDropId: ACTIVE_DROP_ID,
    inactiveDropId: INACTIVE_DROP_ID,
    draft: draftState.draft,
    aliases: data.library.data?.settings.aliases ?? [],
    modByPackageId: derived.modByPackageId,
    modByCatalogKey: derived.modByCatalogKey,
    selectedInactivePackageIds: selection.selectedInactivePackageIds,
    inactivePackageIds: derived.inactiveCatalogKeys,
    selectedEntryIds: selection.selectedEntryIds,
    visibleActiveEntryIds: derived.visibleActiveEntryIds,
    tagDefs: data.library.data?.settings.tagDefs ?? [],
    modTags: data.library.data?.settings.modTags ?? [],
    applyDraft: draftState.applyDraft,
  });
}

export function useOpenHandlers() {
  const { t } = useTranslation();
  const openModFolder = useOpenModFolder();
  const openSteamWorkshopPage = useOpenSteamWorkshopPage();
  const handleOpenModFolder = useCallback(
    (sourceKey: string) => {
      void openModFolder.mutateAsync({ sourceKey }).catch((error: { message?: string }) => {
        toast.error(error.message ?? t('error.transport'));
      });
    },
    [openModFolder, t],
  );
  const handleOpenSteamWorkshopPage = useCallback(
    (sourceKey: string, target: SteamWorkshopOpenTarget) => {
      void openSteamWorkshopPage
        .mutateAsync({ sourceKey, target })
        .catch((error: { message?: string }) => {
          toast.error(error.message ?? t('error.transport'));
        });
    },
    [openSteamWorkshopPage, t],
  );
  return { handleOpenModFolder, handleOpenSteamWorkshopPage };
}

export function useResetSelectionsOnModListChange(
  currentModList: unknown,
  resetSelections: () => void,
) {
  useEffect(() => {
    if (currentModList) {
      resetSelections();
    }
  }, [currentModList, resetSelections]);
}

export function useApplyWithDiff(
  data: OrderData,
  draftState: OrderDraftState,
  derived: OrderDerived,
  setDialog: (dialog: OrderDialog) => void,
) {
  return useCallback(() => {
    const draft = draftState.draft;
    if (!draft) return;
    void data.activeList
      .refetch()
      .then((result) => {
        const before = result.data?.activeMods ?? data.activeList.data?.activeMods ?? [];
        const projection = buildApplyProjection(draft, derived.modByPackageId);
        const diff = buildOrderDiff(before, projection.activeMods, projection.events);
        setDialog({ kind: 'diffConfirm', action: 'apply', modList: draft, diff });
      })
      .catch(() => undefined);
  }, [data.activeList, derived.modByPackageId, draftState.draft, setDialog]);
}
