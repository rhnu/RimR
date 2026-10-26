import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { ModListDto } from '@/commands';
import { useCreateModList, useDeleteModList, useLibrary, useSaveModList } from '@/queries/library';
import type { ModListMenuAction } from '../mod-list-menu';
import { isLibraryDialog } from '../types';
import { useOrderDialogStore } from '@/stores/order-dialog-store';
import { useOrderDraftStore } from '@/stores/order-draft-store';

export function useLibraryDialogActions(draft?: ModListDto) {
  const { t } = useTranslation();
  const library = useLibrary();
  const createModList = useCreateModList();
  const deleteModList = useDeleteModList();
  const saveModList = useSaveModList();
  const currentModList = library.data?.currentModList;
  const canDelete = (library.data?.modListsIndex.modLists.length ?? 0) > 1;
  function onAction(action: ModListMenuAction): void {
    if (!currentModList) return;
    const { open } = useOrderDialogStore.getState();
    switch (action.kind) {
      case 'new':
        open({ kind: 'newModList', value: t('order.newModListDefault') });
        break;
      case 'rename':
        open({ kind: 'renameModList', value: currentModList.name });
        break;
      case 'saveAs':
        open({ kind: 'saveAsModList', value: `${currentModList.name} ${t('order.copySuffix')}` });
        break;
      case 'delete':
        open({ kind: 'deleteModList' });
        break;
    }
  }
  async function submit(value: string): Promise<void> {
    const dialog = useOrderDialogStore.getState().dialog;
    if (!isLibraryDialog(dialog) || !currentModList) return;
    const name = value.trim();
    if (dialog.kind !== 'deleteModList' && !name) return;
    switch (dialog.kind) {
      case 'newModList':
        await createModList.mutateAsync({ name });
        break;
      case 'renameModList': {
        const submitted = { ...currentModList, name };
        const saved = await saveModList.mutateAsync({ modList: submitted });
        useOrderDraftStore.getState().acceptSaved(currentModList, saved);
        break;
      }
      case 'saveAsModList': {
        const saved = await createModList.mutateAsync({
          name,
          baseModList: draft ?? currentModList,
        });
        toast.success(t('toast.modListSavedAs', { name: saved.name }));
        break;
      }
      case 'deleteModList':
        if (!canDelete) return;
        await deleteModList.mutateAsync({ modListId: currentModList.id });
        break;
    }
    // Do not dismiss a newer dialog opened while the write was in flight.
    if (useOrderDialogStore.getState().dialog === dialog) useOrderDialogStore.getState().close();
  }
  return {
    onAction,
    onSubmit: (value: string) => {
      void submit(value).catch(() => undefined);
    },
    currentModList,
    canDelete,
    pending: createModList.isPending || deleteModList.isPending || saveModList.isPending,
  };
}
