import { useCallback, useEffect, useState } from 'react';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import type { CatalogSnapshotDto, ModListDto, SteamWorkshopOpenTarget } from '@/commands';
import { useOrderDraftStore } from '@/stores/order-draft-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useOpenModFolder, useOpenSteamWorkshopPage } from '@/queries/native';
import { queryKeys } from '@/queries/keys';
import { buildApplyProjection, buildOrderDiff } from '@/domain/mod-list/diff';
import { useOrderSync } from '@/features/order/hooks/use-order-sync';
import type { OrderDialog } from '@/features/order/types';

import type {
  OrderWorkspaceData,
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

export function useControllerSync(
  data: OrderWorkspaceData,
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
    applyDraft: draftState.applyDraft,
    resetSelections: selection.resetSelections,
    setDialog,
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
  currentModList: ModListDto,
  resetSelections: () => void,
) {
  useEffect(() => {
    resetSelections();
  }, [currentModList, resetSelections]);
}

export function useApplyWithDiff(
  data: OrderWorkspaceData,
  draftState: OrderDraftState,
  derived: OrderDerived,
  setDialog: (dialog: OrderDialog) => void,
) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    const draft = draftState.draft;
    const scan = data.scan.data;
    const catalogRevision = data.scan.dataUpdatedAt;
    if (!draft || !scan) return;
    const epoch = useWorkspaceStore.getState().epoch;
    const catalogKey = queryKeys.catalogSnapshot(epoch);
    const isCurrentCatalog = () => {
      const current = queryClient.getQueryState<CatalogSnapshotDto>(catalogKey);
      return (
        current?.data === scan &&
        current.dataUpdatedAt === catalogRevision &&
        current.fetchStatus === 'idle'
      );
    };
    if (!isCurrentCatalog()) return;
    void data.activeList
      .refetch({ throwOnError: true })
      .then((result) => {
        if (
          useWorkspaceStore.getState().epoch !== epoch ||
          useOrderDraftStore.getState().draft !== draft ||
          !isCurrentCatalog()
        )
          return;
        const before = result.data?.activeMods ?? data.activeList.data?.activeMods ?? [];
        const projection = buildApplyProjection(draft, derived.modByPackageId);
        const diff = buildOrderDiff(before, projection.activeMods, projection.events);
        setDialog({ kind: 'diffConfirm', action: 'apply', modList: draft, diff, catalogRevision });
      })
      .catch(() => undefined);
  }, [
    data.activeList,
    data.scan.data,
    data.scan.dataUpdatedAt,
    derived.modByPackageId,
    draftState.draft,
    queryClient,
    setDialog,
  ]);
}
