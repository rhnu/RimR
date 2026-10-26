import type { ModIdentityDto, ModListDto } from '@/commands';
import type { GameSyncResult, OrderDiff } from '@/features/order/model';

export type Selection =
  | { kind: 'mod'; identity: ModIdentityDto }
  | { kind: 'group'; entryId: string }
  | { kind: 'separator'; entryId: string }
  | null;

export type OrderDialog =
  | { kind: 'newModList'; value: string }
  | { kind: 'renameModList'; value: string }
  | { kind: 'saveAsModList'; value: string }
  | { kind: 'deleteModList' }
  | {
      kind: 'editAlias';
      identity: ModIdentityDto;
      value: string;
      baseValue: string;
      initialValue: string;
      hadAlias: boolean;
    }
  | { kind: 'createActiveGroup'; value: string }
  | { kind: 'createInactiveGroup'; value: string }
  | { kind: 'renameGroup'; entryId: string; value: string }
  | { kind: 'addSeparator'; index: number; value: string }
  | { kind: 'renameSeparator'; entryId: string; value: string }
  | { kind: 'activeMissingMods'; packageIds: string[]; modList: ModListDto }
  | {
      kind: 'diffConfirm';
      action: 'syncFromGame';
      result: GameSyncResult;
      diff: OrderDiff;
    }
  | {
      kind: 'diffConfirm';
      action: 'syncFromSave';
      result: GameSyncResult;
      diff: OrderDiff;
    }
  | { kind: 'diffConfirm'; action: 'apply'; modList: ModListDto; diff: OrderDiff }
  | { kind: 'discardDraft' }
  | null;

export type OrderDialogWithValue = Extract<Exclude<OrderDialog, null>, { value: string }>;

export type ModListDialog = Extract<
  Exclude<OrderDialog, null>,
  { kind: 'newModList' | 'renameModList' | 'saveAsModList' | 'deleteModList' }
>;

const MOD_LIST_DIALOG_KINDS = new Set([
  'newModList',
  'renameModList',
  'saveAsModList',
  'deleteModList',
]);

export function dialogHasValue(dialog: Exclude<OrderDialog, null>): dialog is OrderDialogWithValue {
  return 'value' in dialog;
}

export function isModListDialog(dialog: Exclude<OrderDialog, null>): dialog is ModListDialog {
  return MOD_LIST_DIALOG_KINDS.has(dialog.kind);
}
