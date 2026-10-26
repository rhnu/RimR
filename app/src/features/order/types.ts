import type { ModIdentityDto, ModListDto } from '@/commands';
import type { GameSyncResult, OrderDiff } from '@/domain/mod-list/types';

export type Selection =
  | { kind: 'mod'; identity: ModIdentityDto; sourceKey?: string }
  | { kind: 'group'; entryId: string }
  | { kind: 'separator'; entryId: string }
  | null;

export type OrderDialog =
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

export function dialogHasValue(dialog: Exclude<OrderDialog, null>): dialog is OrderDialogWithValue {
  return 'value' in dialog;
}

export function isOrderDialog(
  dialog: { kind: string } | null,
): dialog is Exclude<OrderDialog, null> {
  return (
    dialog != null &&
    !['newModList', 'renameModList', 'saveAsModList', 'deleteModList'].includes(dialog.kind)
  );
}
