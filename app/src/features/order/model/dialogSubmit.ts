import type { ModIdentityDto, ModListDto } from '@/commands';
import { separatorEntry } from './entries';
import { createSeparatorId } from './ids';
import type { GameSyncResult, ModListAction } from './types';
import type { OrderDialog } from '@/features/order/types';

export type DialogSubmitActions = {
  applyDraft: (action: ModListAction) => void;
  onSaveAlias: (identity: ModIdentityDto, displayAlias: string) => void;
  onApplyGameSync: (result: GameSyncResult) => void;
  onApplySaveSync: (result: GameSyncResult) => void;
  onApplyToGame: (modList: ModListDto) => void;
  onRemoveMissingMods: (modList: ModListDto, packageIds: string[]) => void;
  onDiscardDraft: () => void;
  createActiveGroup: (name: string) => void;
  createInactiveGroup: (name: string) => void;
};

export function submitOrderDialog(
  dialog: Exclude<OrderDialog, null>,
  value: string,
  actions: DialogSubmitActions,
): void {
  const trimmed = value.trim();
  switch (dialog.kind) {
    case 'editAlias':
      if (!trimmed) {
        if (dialog.hadAlias) {
          actions.onSaveAlias(dialog.identity, '');
        }
        break;
      }
      if (trimmed !== dialog.initialValue.trim()) {
        actions.onSaveAlias(dialog.identity, value);
      }
      break;
    case 'createActiveGroup':
      actions.createActiveGroup(value);
      break;
    case 'createInactiveGroup':
      actions.createInactiveGroup(value);
      break;
    case 'renameGroup':
      if (trimmed)
        actions.applyDraft({ type: 'renameGroup', groupId: dialog.entryId, name: trimmed });
      break;
    case 'addSeparator':
      if (trimmed)
        actions.applyDraft({
          type: 'insertSeparator',
          separator: separatorEntry(createSeparatorId(), trimmed),
          index: dialog.index,
        });
      break;
    case 'renameSeparator':
      if (trimmed)
        actions.applyDraft({ type: 'renameSeparator', entryId: dialog.entryId, title: trimmed });
      break;
    case 'activeMissingMods':
      actions.onRemoveMissingMods(dialog.modList, dialog.packageIds);
      break;
    case 'diffConfirm':
      submitDiffConfirmDialog(dialog, actions);
      break;
    case 'discardDraft':
      actions.onDiscardDraft();
      break;
    case 'newModList':
    case 'renameModList':
    case 'deleteModList':
      break;
  }
}

function submitDiffConfirmDialog(
  dialog: Extract<Exclude<OrderDialog, null>, { kind: 'diffConfirm' }>,
  actions: DialogSubmitActions,
): void {
  if (dialog.action === 'syncFromGame') {
    actions.onApplyGameSync(dialog.result);
  } else if (dialog.action === 'syncFromSave') {
    actions.onApplySaveSync(dialog.result);
  } else {
    actions.onApplyToGame(dialog.modList);
  }
}
