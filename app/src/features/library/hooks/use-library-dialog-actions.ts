import { isCancelledError, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { LibraryDto } from '@/commands';
import {
  readCurrentLibrary,
  useCreateModList,
  useDeleteModList,
  useLibrary,
  useSaveModList,
} from '@/queries/library';
import { useOrderDialogStore } from '@/stores/order-dialog-store';
import { useOrderDraftStore } from '@/stores/order-draft-store';
import type { ModListMenuAction } from '../mod-list-menu';
import { isLibraryDialog, type LibraryDialog } from '../types';

function dialogForAction(
  action: ModListMenuAction,
  library: LibraryDto,
  t: TFunction,
): LibraryDialog | undefined {
  const { id: modListId, name } = library.currentModList;
  switch (action.kind) {
    case 'new':
      return { kind: 'newModList', value: t('order.newModListDefault') };
    case 'rename':
      return { kind: 'renameModList', modListId, value: name };
    case 'saveAs':
      return { kind: 'saveAsModList', modListId, value: `${name} ${t('order.copySuffix')}` };
    case 'delete':
      return library.modListsIndex.modLists.length > 1
        ? { kind: 'deleteModList', modListId }
        : undefined;
  }
}

export function useLibraryDialogActions() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const library = useLibrary();
  const createModList = useCreateModList();
  const deleteModList = useDeleteModList();
  const saveModList = useSaveModList();
  const canDelete = (library.data?.modListsIndex.modLists.length ?? 0) > 1;
  const pending = createModList.isPending || deleteModList.isPending || saveModList.isPending;

  function onAction(action: ModListMenuAction): void {
    const { library: latest } = readCurrentLibrary(client);
    if (!latest || pending) return;
    const dialog = dialogForAction(action, latest, t);
    if (dialog) useOrderDialogStore.getState().open(dialog);
  }
  async function submit(): Promise<void> {
    const { dialog, sessionAtOpen, close } = useOrderDialogStore.getState();
    if (!isLibraryDialog(dialog) || pending) return;
    const { epoch, library: latest } = readCurrentLibrary(client);
    if (
      !latest ||
      sessionAtOpen?.workspaceEpoch !== epoch ||
      ('modListId' in dialog && dialog.modListId !== latest.currentModList.id)
    ) {
      close();
      return;
    }
    const name = 'value' in dialog ? dialog.value.trim() : '';
    if (dialog.kind !== 'deleteModList' && !name) return;
    try {
      switch (dialog.kind) {
        case 'newModList':
          await createModList.mutateAsync({ name });
          break;
        case 'renameModList': {
          const submitted = { ...latest.currentModList, name };
          const saved = await saveModList.mutateAsync({
            modList: submitted,
            expectedCurrentModListId: dialog.modListId,
          });
          useOrderDraftStore.getState().acceptSaved(latest.currentModList, saved);
          break;
        }
        case 'saveAsModList': {
          const { draft } = useOrderDraftStore.getState();
          const saved = await createModList.mutateAsync({
            name,
            baseModList: draft?.id === dialog.modListId ? draft : latest.currentModList,
            expectedCurrentModListId: dialog.modListId,
          });
          toast.success(t('toast.modListSavedAs', { name: saved.name }));
          break;
        }
        case 'deleteModList':
          if (latest.modListsIndex.modLists.length < 2) return;
          await deleteModList.mutateAsync({
            modListId: dialog.modListId,
            expectedCurrentModListId: dialog.modListId,
          });
          break;
      }
    } catch (error) {
      // The mutation cache reports write errors. A changed target retires this dialog.
      if (!isCancelledError(error)) return;
    }
    // Do not dismiss a newer dialog opened while the write was in flight.
    if (useOrderDialogStore.getState().dialog === dialog) close();
  }
  return {
    onAction,
    onSubmit: () => void submit(),
    hasCurrentModList: library.data !== undefined,
    canDelete,
    pending,
  };
}
