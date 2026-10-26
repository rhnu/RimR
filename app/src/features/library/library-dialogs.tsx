import { useTranslation } from 'react-i18next';
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
        <form
          className="flex min-h-0 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            actions.onSubmit('value' in dialog ? dialog.value : '');
          }}
        >
          {'value' in dialog ? (
            <Input value={dialog.value} onChange={(event) => updateValue(event.target.value)} />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant={deleting ? 'destructive' : 'default'}
              disabled={actions.pending || (deleting && !actions.canDelete)}
            >
              {t(deleting ? 'common.delete' : 'common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
