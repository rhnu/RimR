import { useTranslation } from 'react-i18next';
import type { ModMetadataDto } from '@/commands';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DialogForm } from '@/components/ui/dialog-form';
import { Input } from '@/components/ui/input';
import { OrderDiffBody } from '@/features/order/ui/order-diff-view';
import type { OrderDiff } from '@/domain/mod-list/types';
import { dialogHasValue, type OrderDialog } from '@/features/order/types';

export function OrderDialogView({
  dialog,
  modByPackageId,
  onSubmit,
  onClose,
  onValueChange,
}: {
  dialog: OrderDialog;
  modByPackageId: Map<string, ModMetadataDto>;
  onSubmit: (value: string) => void;
  onClose: () => void;
  onValueChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const open = dialog !== null;
  const model = dialog ? getOrderDialogViewModel(dialog) : null;
  const dialogClassName = dialog?.kind === 'diffConfirm' ? 'sm:max-w-3xl' : undefined;
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className={dialogClassName}>
        {model ? (
          <DialogHeader>
            <DialogTitle>{t(model.titleKey)}</DialogTitle>
            <DialogDescription>{t(model.descriptionKey)}</DialogDescription>
          </DialogHeader>
        ) : null}
        <DialogForm
          className="flex-1"
          onCancel={onClose}
          onSubmit={() => onSubmit(dialog && dialogHasValue(dialog) ? dialog.value : '')}
          submitLabel={t(model?.submitLabelKey ?? 'common.save')}
          submitVariant={model?.submitVariant}
          submitDisabled={model?.submitDisabled}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            {dialog && dialogHasValue(dialog) ? (
              <Input value={dialog.value} onChange={(event) => onValueChange(event.target.value)} />
            ) : null}
            {model ? <DialogBodyView body={model.body} modByPackageId={modByPackageId} /> : null}
          </div>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}

type DialogTitleKey =
  | 'order.dialog.newModListTitle'
  | 'order.dialog.renameModListTitle'
  | 'order.dialog.saveAsModListTitle'
  | 'order.dialog.deleteModListTitle'
  | 'order.dialog.editAliasTitle'
  | 'order.dialog.createGroupTitle'
  | 'order.dialog.renameGroupTitle'
  | 'order.dialog.addSeparatorTitle'
  | 'order.dialog.renameSeparatorTitle'
  | 'order.dialog.activeMissingModsTitle'
  | 'order.dialog.syncFromGameTitle'
  | 'order.dialog.syncFromSaveTitle'
  | 'order.dialog.applyToGameTitle'
  | 'order.dialog.discardDraftTitle';

type DialogDescriptionKey =
  | 'order.dialog.deleteModListDesc'
  | 'order.dialog.activeMissingModsDesc'
  | 'order.dialog.syncFromGameDesc'
  | 'order.dialog.syncFromSaveDesc'
  | 'order.dialog.applyToGameDesc'
  | 'order.dialog.discardDraftDesc'
  | 'order.dialog.saveAsModListDesc'
  | 'order.dialog.editDesc';

type DialogSubmitLabelKey =
  | 'common.delete'
  | 'common.save'
  | 'order.apply'
  | 'order.discardDraft'
  | 'order.removeMissingMods'
  | 'order.syncFromGame'
  | 'order.syncFromSave';

type DialogBody =
  | { kind: 'none' }
  | { kind: 'missingPackages'; packageIds: string[] }
  | { kind: 'diff'; diff: OrderDiff };

type OrderDialogViewModel = {
  titleKey: DialogTitleKey;
  descriptionKey: DialogDescriptionKey;
  body: DialogBody;
  submitLabelKey: DialogSubmitLabelKey;
  submitVariant: 'default' | 'destructive';
  submitDisabled: boolean;
};

export function getOrderDialogViewModel(dialog: Exclude<OrderDialog, null>): OrderDialogViewModel {
  return {
    titleKey: dialogTitleKey(dialog),
    descriptionKey: dialogDescriptionKey(dialog),
    body: dialogBody(dialog),
    submitLabelKey: dialogSubmitLabelKey(dialog),
    submitVariant: 'default',
    submitDisabled: false,
  };
}

function dialogTitleKey(dialog: Exclude<OrderDialog, null>): DialogTitleKey {
  switch (dialog.kind) {
    case 'editAlias':
      return 'order.dialog.editAliasTitle';
    case 'createActiveGroup':
    case 'createInactiveGroup':
      return 'order.dialog.createGroupTitle';
    case 'renameGroup':
      return 'order.dialog.renameGroupTitle';
    case 'addSeparator':
      return 'order.dialog.addSeparatorTitle';
    case 'renameSeparator':
      return 'order.dialog.renameSeparatorTitle';
    case 'activeMissingMods':
      return 'order.dialog.activeMissingModsTitle';
    case 'diffConfirm':
      return dialog.action === 'syncFromGame'
        ? 'order.dialog.syncFromGameTitle'
        : dialog.action === 'syncFromSave'
          ? 'order.dialog.syncFromSaveTitle'
          : 'order.dialog.applyToGameTitle';
    case 'discardDraft':
      return 'order.dialog.discardDraftTitle';
  }
}

function dialogDescriptionKey(dialog: Exclude<OrderDialog, null>): DialogDescriptionKey {
  switch (dialog.kind) {
    case 'activeMissingMods':
      return 'order.dialog.activeMissingModsDesc';
    case 'diffConfirm':
      return dialog.action === 'syncFromGame'
        ? 'order.dialog.syncFromGameDesc'
        : dialog.action === 'syncFromSave'
          ? 'order.dialog.syncFromSaveDesc'
          : 'order.dialog.applyToGameDesc';
    case 'discardDraft':
      return 'order.dialog.discardDraftDesc';
    default:
      return 'order.dialog.editDesc';
  }
}

function dialogSubmitLabelKey(dialog: Exclude<OrderDialog, null>): DialogSubmitLabelKey {
  switch (dialog.kind) {
    case 'activeMissingMods':
      return 'order.removeMissingMods';
    case 'diffConfirm':
      return dialog.action === 'syncFromGame'
        ? 'order.syncFromGame'
        : dialog.action === 'syncFromSave'
          ? 'order.syncFromSave'
          : 'order.apply';
    case 'discardDraft':
      return 'order.discardDraft';
    default:
      return 'common.save';
  }
}

function dialogBody(dialog: Exclude<OrderDialog, null>): DialogBody {
  switch (dialog.kind) {
    case 'activeMissingMods':
      return { kind: 'missingPackages', packageIds: dialog.packageIds };
    case 'diffConfirm':
      return { kind: 'diff', diff: dialog.diff };
    default:
      return { kind: 'none' };
  }
}

function DialogBodyView({
  body,
  modByPackageId,
}: {
  body: DialogBody;
  modByPackageId: Map<string, ModMetadataDto>;
}) {
  switch (body.kind) {
    case 'missingPackages':
      return <MissingPackageList packageIds={body.packageIds} />;
    case 'diff':
      return <OrderDiffBody diff={body.diff} modByPackageId={modByPackageId} />;
    case 'none':
      return null;
  }
}

function MissingPackageList({ packageIds }: { packageIds: string[] }) {
  return (
    <div className="max-h-48 overflow-auto border border-border text-xs">
      {packageIds.map((packageId) => (
        <div key={packageId} className="border-b border-border px-2 py-1 font-mono last:border-b-0">
          {packageId}
        </div>
      ))}
    </div>
  );
}
