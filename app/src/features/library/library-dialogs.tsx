import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DialogForm } from '@/components/ui/dialog-form';
import { Input } from '@/components/ui/input';
import { useOrderDialogStore } from '@/stores/order-dialog-store';
import { useOrderDraftStore } from '@/stores/order-draft-store';
import { useLibraryDialogActions } from './hooks/use-library-dialog-actions';
import { isLibraryDialog } from './types';

const titles = {
  newModList: 'order.dialog.newModListTitle',
  renameModList: 'order.dialog.renameModListTitle',
  saveAsModList: 'order.dialog.saveAsModListTitle',
  deleteModList: 'order.dialog.deleteModListTitle',
} as const;

export function LibraryDialogs() {
  const { t } = useTranslation();
  const dialog = useOrderDialogStore((state) => state.dialog);
  const close = useOrderDialogStore((state) => state.close);
  const updateValue = useOrderDialogStore((state) => state.updateValue);
  const draft = useOrderDraftStore((state) => state.draft);
  const actions = useLibraryDialogActions(draft ?? undefined);
  if (!isLibraryDialog(dialog)) return null;
  const deleting = dialog.kind === 'deleteModList';
  const description = deleting
    ? 'order.dialog.deleteModListDesc'
    : dialog.kind === 'saveAsModList'
      ? 'order.dialog.saveAsModListDesc'
      : 'order.dialog.editDesc';
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(titles[dialog.kind])}</DialogTitle>
          <DialogDescription>{t(description)}</DialogDescription>
        </DialogHeader>
        <DialogForm
          onCancel={close}
          onSubmit={() => actions.onSubmit('value' in dialog ? dialog.value : '')}
          submitLabel={t(deleting ? 'common.delete' : 'common.save')}
          submitVariant={deleting ? 'destructive' : 'default'}
          submitDisabled={actions.pending || (deleting && !actions.canDelete)}
        >
          {'value' in dialog ? (
            <Input value={dialog.value} onChange={(event) => updateValue(event.target.value)} />
          ) : null}
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
