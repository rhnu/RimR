// AppShell-level binding for the unified OrderDialog store.
//
// Mod-list dialogs (new / rename / saveAs / delete) are handled directly
// here. Other dialog kinds (alias, group, separator, diff, etc.) only ever
// open inside the OrderWorkspaceProvider, which registers its
// `handleDialogSubmit` into `useOrderDialogStore` so this hook can dispatch
// to it via a lazy `getState()` lookup.
//
// See docs/state-management.md.

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import type { ModListDto } from '@/commands';
import { useCreateModList, useDeleteModList, useLibrary, useSaveModList } from '@/hooks/commands';
import { ModListMenuAction } from '@/features/order/ModListMenu';
import { isModListDialog, type ModListDialog } from '@/features/order/types';
import { useOrderDialogStore } from '@/stores/orderDialogStore';

export function useAppOrderDialogActions(draft?: ModListDto) {
  const { t } = useTranslation();
  const open = useOrderDialogStore((state) => state.open);
  const library = useLibrary();
  const createModList = useCreateModList();
  const deleteModList = useDeleteModList();
  const saveModList = useSaveModList();

  const currentModList = library.data?.currentModList;
  const canDelete = (library.data?.modListsIndex.modLists.length ?? 0) > 1;

  const handleAction = useCallback(
    (action: ModListMenuAction) => {
      if (!currentModList) return;
      switch (action.kind) {
        case 'new':
          open({ kind: 'newModList', value: t('order.newModListDefault') });
          break;
        case 'rename':
          open({ kind: 'renameModList', value: currentModList.name });
          break;
        case 'saveAs':
          open({
            kind: 'saveAsModList',
            value: `${currentModList.name} ${t('order.copySuffix')}`,
          });
          break;
        case 'delete':
          open({ kind: 'deleteModList' });
          break;
      }
    },
    [currentModList, open, t],
  );

  const handleSubmit = useCallback(
    (value: string) => {
      const { dialog, close, orderEditHandler } = useOrderDialogStore.getState();
      if (!dialog) return;
      if (isModListDialog(dialog)) {
        submitModListDialog(
          value,
          {
            dialog,
            currentModList,
            draft,
            canDelete,
            createModList,
            saveModList,
            deleteModList,
            closeDialog: close,
            refetchLibrary: () => {
              void library.refetch();
            },
          },
          t,
        );
        return;
      }
      orderEditHandler?.(value);
    },
    [currentModList, draft, canDelete, createModList, saveModList, deleteModList, library, t],
  );

  return {
    onAction: handleAction,
    onSubmit: handleSubmit,
    currentModList,
    canDelete,
  };
}

type SubmitContext = {
  dialog: ModListDialog;
  currentModList: NonNullable<ReturnType<typeof useLibrary>['data']>['currentModList'] | undefined;
  draft: ModListDto | undefined;
  canDelete: boolean;
  createModList: ReturnType<typeof useCreateModList>;
  saveModList: ReturnType<typeof useSaveModList>;
  deleteModList: ReturnType<typeof useDeleteModList>;
  closeDialog: () => void;
  refetchLibrary: () => void;
};

function submitModListDialog(value: string, context: SubmitContext, t: TFunction): void {
  if (!context.currentModList) return;
  const trimmed = value.trim();
  const closeAndRefetch = () => {
    context.closeDialog();
    context.refetchLibrary();
  };
  switch (context.dialog.kind) {
    case 'newModList':
      if (trimmed) createNewModList(context, trimmed, closeAndRefetch);
      break;
    case 'renameModList':
      if (trimmed) renameModList(context, trimmed, closeAndRefetch);
      break;
    case 'saveAsModList':
      if (trimmed) saveAsModList(context, trimmed, closeAndRefetch, t);
      break;
    case 'deleteModList':
      if (context.canDelete) {
        context.deleteModList.mutate(
          { modListId: context.currentModList.id },
          { onSuccess: closeAndRefetch },
        );
      }
      break;
  }
}

function createNewModList(context: SubmitContext, name: string, onSuccess: () => void): void {
  if (!context.currentModList) return;
  context.createModList.mutate({ name }, { onSuccess });
}

function saveAsModList(
  context: SubmitContext,
  name: string,
  closeAndRefetch: () => void,
  t: TFunction,
): void {
  const source = context.draft ?? context.currentModList;
  if (!source) return;
  context.createModList.mutate(
    {
      name,
      baseModList: source,
    },
    {
      onSuccess: (modList) => {
        closeAndRefetch();
        toast.success(t('toast.modListSavedAs', { name: modList.name }));
      },
    },
  );
}

function renameModList(context: SubmitContext, name: string, onSuccess: () => void): void {
  if (!context.currentModList) return;
  context.saveModList.mutate({ modList: { ...context.currentModList, name } }, { onSuccess });
}
