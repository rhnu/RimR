import { useOrderDraftStore } from '@/stores/order-draft-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { OrderSync } from '../context/workspace-types';
import { flattenModListEntries, activeModsKey } from '@/domain/mod-list/normalize';
import { toast } from 'sonner';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModListDto, ModMetadataDto, CatalogSnapshotDto } from '@/commands';
import { classifyMissingEntries, removeMissingEntries } from '@/domain/mod-list/missing-entries';
import { syncModListFromGame } from '@/domain/mod-list/sync-from-game';
import { type GameSyncResult, type ModListAction } from '@/domain/mod-list/types';
import type { OrderDialog } from '@/features/order/types';
import { useOrderCommandStore } from '@/stores/order-command-store';

export function useOrderSync({
  draft,
  mods,
  modListDirty,
  activeMods,
  refetchScan,
  refetchActiveList,
  applyDraft,
  resetSelections,
  setDialog,
}: {
  draft: ModListDto | null;
  mods: ModMetadataDto[];
  modListDirty: boolean;
  activeMods: string[] | undefined;
  refetchScan: () => Promise<CatalogSnapshotDto | undefined>;
  refetchActiveList: () => Promise<string[] | undefined>;
  applyDraft: (action: ModListAction) => void;
  resetSelections: () => void;
  setDialog: (dialog: OrderDialog) => void;
}): OrderSync {
  const { t } = useTranslation();

  function applyGameSync(result: GameSyncResult): void {
    applyDraft({ type: 'replace', modList: result.modList });
    resetSelections();
    toast.success(t('toast.syncedFromGame'));
  }

  function applyMissingModRemoval(modList: ModListDto, packageIds: string[]): void {
    applyDraft({ type: 'replace', modList });
    resetSelections();
    toast.success(t('toast.activeMissingModsRemoved', { count: packageIds.length }));
  }

  function handleRebuildCatalog(): void {
    if (!draft) return;
    const epoch = useWorkspaceStore.getState().epoch;
    void refetchScan()
      .then((scan) => {
        if (
          useWorkspaceStore.getState().epoch !== epoch ||
          useOrderDraftStore.getState().draft !== draft
        )
          return;
        handleCatalogScanResult({
          draft,
          fallbackMods: mods,
          scan,
          applyDraft,
          resetSelections,
          setDialog,
          t,
        });
        void refetchActiveList().catch(() => undefined);
      })
      .catch(() => undefined);
  }

  const { handleSyncFromGame } = useSyncFromGame({
    draft,
    mods,
    modListDirty,
    activeMods,
    refetchActiveList,
    applyGameSync,
    setDialog,
  });

  const { applySaveSync } = useSaveSync({
    draft,
    mods,
    modListDirty,
    applyDraft,
    resetSelections,
    setDialog,
  });

  return {
    handleSyncFromGame,
    handleRebuildCatalog,
    applyGameSync,
    applySaveSync,
    applyMissingModRemoval,
  };
}

function useSyncFromGame({
  draft,
  mods,
  modListDirty,
  activeMods,
  refetchActiveList,
  applyGameSync,
  setDialog,
}: {
  draft: ModListDto | null;
  mods: ModMetadataDto[];
  modListDirty: boolean;
  activeMods: string[] | undefined;
  refetchActiveList: () => Promise<string[] | undefined>;
  applyGameSync: (result: GameSyncResult) => void;
  setDialog: (dialog: OrderDialog) => void;
}) {
  const { t } = useTranslation();
  function handleSyncFromGame(): void {
    if (!draft) return;
    const epoch = useWorkspaceStore.getState().epoch;
    void refetchActiveList()
      .then((nextActiveMods) => {
        if (
          useWorkspaceStore.getState().epoch !== epoch ||
          useOrderDraftStore.getState().draft !== draft
        )
          return;
        const gameActiveMods = nextActiveMods ?? activeMods;
        if (!gameActiveMods) return;
        const sync = syncModListFromGame(draft, gameActiveMods, mods);
        if (activeModsEqual(sync.modList, draft)) {
          toast.info(t('toast.gameOrderAlreadySynced'));
          return;
        }
        confirmOrApplySync(
          sync,
          applyGameSync,
          setDialog,
          requiresConfirmation(sync, modListDirty),
          'syncFromGame',
        );
      })
      .catch(() => undefined);
  }
  return { handleSyncFromGame };
}

function useSaveSync({
  draft,
  mods,
  modListDirty,
  applyDraft,
  resetSelections,
  setDialog,
}: {
  draft: ModListDto | null;
  mods: ModMetadataDto[];
  modListDirty: boolean;
  applyDraft: (action: ModListAction) => void;
  resetSelections: () => void;
  setDialog: (dialog: OrderDialog) => void;
}) {
  const { t } = useTranslation();
  const pending = useOrderCommandStore((state) => state.pending);
  const clearPending = useOrderCommandStore((state) => state.clear);

  const applySaveSync = useCallback(
    (result: GameSyncResult): void => {
      applyDraft({ type: 'replace', modList: result.modList });
      resetSelections();
      toast.success(t('toast.syncedFromSave'));
    },
    [applyDraft, resetSelections, t],
  );

  useEffect(() => {
    if (!pending || pending.kind !== 'syncFromSave') return;
    if (!draft) {
      clearPending();
      return;
    }
    const sync = syncModListFromGame(draft, pending.modIds, mods);
    if (activeModsEqual(sync.modList, draft)) {
      toast.info(t('toast.saveOrderAlreadySynced'));
      clearPending();
      return;
    }
    confirmOrApplySync(
      sync,
      applySaveSync,
      setDialog,
      requiresConfirmation(sync, modListDirty),
      'syncFromSave',
    );
    clearPending();
  }, [pending, draft, mods, modListDirty, setDialog, t, clearPending, applySaveSync]);

  return { applySaveSync };
}

function handleCatalogScanResult({
  draft,
  fallbackMods,
  scan,
  applyDraft,
  resetSelections,
  setDialog,
  t,
}: {
  draft: ModListDto;
  fallbackMods: ModMetadataDto[];
  scan: CatalogSnapshotDto | undefined;
  applyDraft: (action: ModListAction) => void;
  resetSelections: () => void;
  setDialog: (dialog: OrderDialog) => void;
  t: ReturnType<typeof useTranslation>['t'];
}): void {
  const catalogMods = scan?.catalog.mods ?? fallbackMods;
  const missing = classifyMissingEntries(draft, catalogMods);
  let nextDraft = draft;

  if (missing.inactive.length > 0) {
    nextDraft = removeMissingEntries(nextDraft, missing.inactive);
    applyDraft({ type: 'replace', modList: nextDraft });
    resetSelections();
    toast.info(t('toast.inactiveMissingModsRemoved', { count: missing.inactive.length }));
  }

  if (missing.active.length > 0) {
    setDialog({
      kind: 'activeMissingMods',
      packageIds: missing.active,
      modList: removeMissingEntries(nextDraft, missing.active),
    });
  } else if (missing.inactive.length === 0) {
    toast.success(t('toast.catalogRescanned'));
  }
}

function requiresConfirmation(result: GameSyncResult, dirty: boolean): boolean {
  return dirty || result.diff.items.some((item) => item.kind !== 'noChange');
}

function confirmOrApplySync(
  result: GameSyncResult,
  apply: (result: GameSyncResult) => void,
  openDialog: (dialog: OrderDialog) => void,
  confirm: boolean,
  action: 'syncFromGame' | 'syncFromSave',
): void {
  if (confirm) {
    openDialog({
      kind: 'diffConfirm',
      action,
      result,
      diff: result.diff,
    });
    return;
  }
  apply(result);
}

function activeModsEqual(a: ModListDto, b: ModListDto): boolean {
  return (
    activeModsKey(flattenModListEntries(a.entries)) ===
    activeModsKey(flattenModListEntries(b.entries))
  );
}
