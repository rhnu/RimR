import { useCallback, useEffect, useState } from 'react';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { SteamWorkshopOpenTarget } from '@/commands';
import { useOrderDraftStore } from '@/stores/order-draft-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useOpenModFolder, useOpenSteamWorkshopPage } from '@/queries/native';
import { buildApplyProjection, buildOrderDiff } from '@/domain/mod-list/diff';
import { type ModListAction } from '@/domain/mod-list/types';
import { useOrderCommands } from '@/features/order/hooks/use-order-commands';
import { useOrderDrag } from '@/features/order/hooks/use-order-drag';
import { useOrderSync } from '@/features/order/hooks/use-order-sync';
import { ACTIVE_DROP_ID, INACTIVE_DROP_ID } from '@/features/order/workspace-constants';
import type { OrderDialog } from '@/features/order/types';

import type {
  OrderData,
  OrderDraftState,
  OrderDerived,
  OrderSelection,
  OrderFilters,
} from './workspace-types';

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

export function useControllerCommands(draftState: OrderDraftState) {
  return useOrderCommands({
    draft: draftState.draft,
    acceptSaved: draftState.acceptSaved,
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
    refetchScan: () => data.scan.refetch({ throwOnError: true }).then((result) => result.data),
    refetchActiveList: () =>
      data.activeList.refetch({ throwOnError: true }).then((result) => result.data?.activeMods),
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
    selectedInactiveCatalogKeys: selection.selectedInactiveCatalogKeys,
    orderedInactiveCatalogKeys: derived.inactiveCatalogKeys,
    selectedEntryIds: selection.selectedEntryIds,
    visibleActiveEntryIds: derived.visibleActiveEntryIds,
    tagDefs: data.library.data?.settings.tagDefs ?? [],
    modTags: data.library.data?.settings.modTags ?? [],
    applyDraft: draftState.applyDraft,
  });
}

export function useOpenHandlers() {
  const { mutate: openModFolder } = useOpenModFolder();
  const { mutate: openSteamWorkshopPage } = useOpenSteamWorkshopPage();
  const handleOpenModFolder = useCallback(
    (sourceKey: string) => openModFolder({ sourceKey }),
    [openModFolder],
  );
  const handleOpenSteamWorkshopPage = useCallback(
    (sourceKey: string, target: SteamWorkshopOpenTarget) =>
      openSteamWorkshopPage({ sourceKey, target }),
    [openSteamWorkshopPage],
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
    const epoch = useWorkspaceStore.getState().epoch;
    void data.activeList
      .refetch({ throwOnError: true })
      .then((result) => {
        if (
          useWorkspaceStore.getState().epoch !== epoch ||
          useOrderDraftStore.getState().draft !== draft
        )
          return;
        const before = result.data?.activeMods ?? data.activeList.data?.activeMods ?? [];
        const projection = buildApplyProjection(draft, derived.modByPackageId);
        const diff = buildOrderDiff(before, projection.activeMods, projection.events);
        setDialog({ kind: 'diffConfirm', action: 'apply', modList: draft, diff });
      })
      .catch(() => undefined);
  }, [data.activeList, derived.modByPackageId, draftState.draft, setDialog]);
}
