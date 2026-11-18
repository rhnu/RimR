import type { OrderEditActions } from '../workspace/workspace-types';
import { useCallback, useRef } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type {
  DisplayAliasDto,
  ModIdentityDto,
  ModListDto,
  ModListEntryDto,
  ModMetadataDto,
} from '@/commands';
import {
  useEditActiveAlias,
  useEditInactiveAlias,
} from '@/features/order/hooks/use-alias-dialog-actions';
import { canCreateActiveGroup, removalTargets, submitOrderDialog } from '@/features/order/model';
import { createGroupId } from '@/domain/mod-list/ids';
import { type GameSyncResult, type ModListAction } from '@/domain/mod-list/types';
import { useCreateGroupFromInactive } from '@/features/order/hooks/use-create-group-from-inactive';
import { entryIndex } from '@/features/order/dnd-ids';
import { isOrderDialog, type OrderDialog } from '@/features/order/types';
import { useOrderDialogStore, type OrderDialogSession } from '@/stores/order-dialog-store';
import { useOrderDraftStore } from '@/stores/order-draft-store';
import { queryKeys } from '@/queries/keys';
import { readCurrentLibrary } from '@/queries/library';
import { toast } from 'sonner';
import type { MutableRefObject } from 'react';

type UseOrderEditActionsParams = {
  setDialog: (dialog: OrderDialog) => void;
  draft: ModListDto | null;
  selectedEntryIds: Set<string>;
  selectedInactiveCatalogKeys: Set<string>;
  sortedInactiveMods: ModMetadataDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  aliases: DisplayAliasDto[];
  applyDraft: (action: ModListAction) => void;
  resetSelections: () => void;
  onSaveAlias: (identity: ModIdentityDto, displayAlias: string) => void;
  onApplyGameSync: (result: GameSyncResult) => void;
  onApplySaveSync: (result: GameSyncResult) => void;
  onApplyToGame: (modList: ModListDto) => void;
  onRemoveMissingMods: (modList: ModListDto, packageIds: string[]) => void;
  onDiscardDraft: () => void;
};

export function useOrderEditActions({
  setDialog,
  draft,
  selectedEntryIds,
  selectedInactiveCatalogKeys,
  sortedInactiveMods,
  modByPackageId,
  aliases,
  applyDraft,
  resetSelections,
  onSaveAlias,
  onApplyGameSync,
  onApplySaveSync,
  onApplyToGame,
  onRemoveMissingMods,
  onDiscardDraft,
}: UseOrderEditActionsParams): OrderEditActions {
  const { t } = useTranslation();
  const client = useQueryClient();
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const handleCreateGroupFromInactive = useCreateGroupFromInactive({
    draftRef,
    selectedInactiveCatalogKeys,
    sortedInactiveMods,
    applyDraft,
    resetSelections,
  });
  const openActions = useDialogOpenActions({
    draftRef,
    setDialog,
    applyDraft,
    modByPackageId,
    aliases,
    selectedEntryIds,
  });

  function handleDialogSubmit(value: string): void {
    const { dialog, sessionAtOpen } = useOrderDialogStore.getState();
    if (!isOrderDialog(dialog)) return;
    if (!isPreviewCurrent(client, dialog, sessionAtOpen)) {
      setDialog(null);
      toast.info(t('order.previewExpired'));
      return;
    }
    submitOrderDialog(dialog, value, {
      applyDraft,
      onSaveAlias,
      onApplyGameSync,
      onApplySaveSync,
      onApplyToGame,
      onRemoveMissingMods,
      onDiscardDraft,
      createActiveGroup: handleCreateActiveGroup,
      createInactiveGroup: handleCreateGroupFromInactive,
    });
    setDialog(null);
  }

  function handleCreateActiveGroup(nameValue: string): void {
    const name = nameValue.trim();
    if (!canCreateActiveGroup(selectedEntryIds) || !name) return;
    applyDraft({
      type: 'createGroup',
      entryIds: [...selectedEntryIds],
      groupId: createGroupId(),
      name,
    });
    resetSelections();
  }

  return {
    setDialog,
    handleDialogSubmit,
    ...openActions,
  };
}

function isPreviewCurrent(
  client: QueryClient,
  dialog: NonNullable<OrderDialog>,
  sessionAtOpen: OrderDialogSession | null,
): boolean {
  if (dialog.kind !== 'diffConfirm' && dialog.kind !== 'activeMissingMods') return true;
  const { epoch, library } = readCurrentLibrary(client);
  const currentDraft = useOrderDraftStore.getState().draft;
  if (
    sessionAtOpen?.workspaceEpoch !== epoch ||
    sessionAtOpen.draft !== currentDraft ||
    currentDraft?.id !== library?.currentModList.id
  )
    return false;
  if (dialog.kind !== 'diffConfirm' || dialog.action !== 'apply') return true;
  const catalog = client.getQueryState(queryKeys.catalogSnapshot(epoch));
  return catalog?.fetchStatus === 'idle' && catalog.dataUpdatedAt === dialog.catalogRevision;
}

function useDialogOpenActions({
  draftRef,
  setDialog,
  applyDraft,
  modByPackageId,
  aliases,
  selectedEntryIds,
}: {
  draftRef: MutableRefObject<ModListDto | null>;
  setDialog: (dialog: OrderDialog) => void;
  applyDraft: (action: ModListAction) => void;
  modByPackageId: Map<string, ModMetadataDto>;
  aliases: DisplayAliasDto[];
  selectedEntryIds: Set<string>;
}) {
  const { t } = useTranslation();
  return {
    addInactiveMod: useAddInactiveMod(draftRef, applyDraft),
    activateInactiveEntry: useActivateInactiveEntry(draftRef, applyDraft),
    activateInactiveChild: useActivateInactiveChild(draftRef, applyDraft),
    createInactiveGroupDialog: useCallback(() => {
      setDialog({ kind: 'createInactiveGroup', value: t('order.groupDefault') });
    }, [setDialog, t]),
    editInactiveAlias: useEditInactiveAlias(aliases, setDialog),
    removeActiveEntry: useRemoveEntry(draftRef, applyDraft, selectedEntryIds),
    handleActiveDoubleClick: useCallback(
      (entry: ModListEntryDto) => {
        if (entry.kind === 'mod') {
          applyDraft({ type: 'setEntryActive', entryId: entry.id, active: false });
        }
      },
      [applyDraft],
    ),
    ungroupActiveEntry: useCallback(
      (groupId: string) => applyDraft({ type: 'ungroup', groupId }),
      [applyDraft],
    ),
    createActiveGroupDialog: useCallback(() => {
      setDialog({ kind: 'createActiveGroup', value: t('order.groupDefault') });
    }, [setDialog, t]),
    editActiveAlias: useEditActiveAlias(modByPackageId, aliases, setDialog),
    addSeparatorAbove: useAddSeparatorDialog(draftRef, setDialog),
    renameActiveGroup: useCallback(
      (entryId: string, name: string) => {
        setDialog({ kind: 'renameGroup', entryId, value: name });
      },
      [setDialog],
    ),
    renameActiveSeparator: useCallback(
      (entryId: string, title: string) => {
        setDialog({ kind: 'renameSeparator', entryId, value: title });
      },
      [setDialog],
    ),
    removeGroupChild: useCallback(
      (groupId: string, childId: string) => {
        applyDraft({ type: 'setGroupChildrenActive', groupId, childIds: [childId], active: false });
      },
      [applyDraft],
    ),
  };
}

/**
 * Removes the clicked entry, or the whole selection when the clicked entry is
 * part of it.
 *
 * The context menu opens only after the row has been added to the selection,
 * so acting on the clicked entry alone silently ignored the other selected
 * rows — unlike dragging and grouping, which have always been selection-wide.
 */
function useRemoveEntry(
  draftRef: MutableRefObject<ModListDto | null>,
  applyDraft: (action: ModListAction) => void,
  selectedEntryIds: Set<string>,
) {
  return useCallback(
    (entryId: string): void => {
      const { removeIds, deactivateIds } = removalTargets(
        draftRef.current?.entries ?? [],
        entryId,
        selectedEntryIds,
      );
      if (removeIds.length > 0) {
        applyDraft({ type: 'removeEntries', entryIds: removeIds });
      }
      if (deactivateIds.length > 0) {
        applyDraft({ type: 'setEntriesActive', entryIds: deactivateIds, active: false });
      }
    },
    [applyDraft, draftRef, selectedEntryIds],
  );
}

function useActivateInactiveEntry(
  draftRef: MutableRefObject<ModListDto | null>,
  applyDraft: (action: ModListAction) => void,
) {
  return useCallback(
    (entryId: string): void => {
      const currentDraft = draftRef.current;
      if (!currentDraft?.entries.some((candidate) => candidate.id === entryId)) return;
      applyDraft({
        type: 'moveEntriesToIndexAndSetActive',
        entryIds: [entryId],
        index: currentDraft.entries.length,
        active: true,
      });
    },
    [applyDraft, draftRef],
  );
}

function useActivateInactiveChild(
  draftRef: MutableRefObject<ModListDto | null>,
  applyDraft: (action: ModListAction) => void,
) {
  return useCallback(
    (groupId: string, childId: string): void => {
      const currentDraft = draftRef.current;
      if (!currentDraft) return;
      applyDraft({
        type: 'setGroupChildrenActiveAndMoveGroup',
        groupId,
        childIds: [childId],
        active: true,
        index: currentDraft.entries.length,
      });
    },
    [applyDraft, draftRef],
  );
}

function useAddInactiveMod(
  draftRef: MutableRefObject<ModListDto | null>,
  applyDraft: (action: ModListAction) => void,
) {
  return useCallback(
    (mod: ModMetadataDto): void => {
      const currentDraft = draftRef.current;
      if (!currentDraft) return;
      applyDraft({ type: 'addMod', mod, index: currentDraft.entries.length });
    },
    [applyDraft, draftRef],
  );
}

function useAddSeparatorDialog(
  draftRef: MutableRefObject<ModListDto | null>,
  setDialog: (dialog: OrderDialog) => void,
) {
  const { t } = useTranslation();
  return useCallback(
    (entry: ModListEntryDto): void => {
      const currentDraft = draftRef.current;
      if (!currentDraft) return;
      setDialog({
        kind: 'addSeparator',
        index: entryIndex(currentDraft, entry.id),
        value: t('order.separatorDefault'),
      });
    },
    [draftRef, setDialog, t],
  );
}
