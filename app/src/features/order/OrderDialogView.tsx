import { useTranslation } from 'react-i18next';
import type { ModMetadataDto } from '@/commands';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { OrderDiffBody } from '@/features/order/OrderDiffView';
import type { OrderDiff } from '@/features/order/model';
import { dialogHasValue, type OrderDialog } from '@/features/order/types';
import { useOrderDialogStore } from '@/stores/orderDialogStore';

export function OrderDialogView({
  onSubmit,
  canDeleteModList,
  modByPackageId,
}: {
  onSubmit: (value: string) => void;
  canDeleteModList: boolean;
  modByPackageId: Map<string, ModMetadataDto>;
}) {
  const { t } = useTranslation();
  const dialog = useOrderDialogStore((state) => state.dialog);
  const close = useOrderDialogStore((state) => state.close);
  const updateValue = useOrderDialogStore((state) => state.updateValue);
  const open = dialog !== null;
  const model = dialog ? getOrderDialogViewModel(dialog, canDeleteModList) : null;
  const dialogClassName = dialog?.kind === 'diffConfirm' ? 'sm:max-w-3xl' : undefined;
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <DialogContent className={dialogClassName}>
        {model ? (
          <DialogHeader>
            <DialogTitle>{t(model.titleKey)}</DialogTitle>
            <DialogDescription>{t(model.descriptionKey)}</DialogDescription>
          </DialogHeader>
        ) : null}
        <form
          className="flex min-h-0 flex-1 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(dialog && dialogHasValue(dialog) ? dialog.value : '');
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            {dialog && dialogHasValue(dialog) ? (
              <Input value={dialog.value} onChange={(event) => updateValue(event.target.value)} />
            ) : null}
            {model ? <DialogBodyView body={model.body} modByPackageId={modByPackageId} /> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close()}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant={model?.submitVariant ?? 'default'}
              disabled={model?.submitDisabled ?? false}
            >
              {model ? t(model.submitLabelKey) : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
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

export function getOrderDialogViewModel(
  dialog: Exclude<OrderDialog, null>,
  canDeleteModList: boolean,
): OrderDialogViewModel {
  return {
    titleKey: dialogTitleKey(dialog),
    descriptionKey: dialogDescriptionKey(dialog),
    body: dialogBody(dialog),
    submitLabelKey: dialogSubmitLabelKey(dialog),
    submitVariant: dialog.kind === 'deleteModList' ? 'destructive' : 'default',
    submitDisabled: dialog.kind === 'deleteModList' && !canDeleteModList,
  };
}

function dialogTitleKey(dialog: Exclude<OrderDialog, null>): DialogTitleKey {
  switch (dialog.kind) {
    case 'newModList':
      return 'order.dialog.newModListTitle';
    case 'renameModList':
      return 'order.dialog.renameModListTitle';
    case 'saveAsModList':
      return 'order.dialog.saveAsModListTitle';
    case 'deleteModList':
      return 'order.dialog.deleteModListTitle';
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
    case 'deleteModList':
      return 'order.dialog.deleteModListDesc';
    case 'saveAsModList':
      return 'order.dialog.saveAsModListDesc';
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
    case 'deleteModList':
      return 'common.delete';
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
