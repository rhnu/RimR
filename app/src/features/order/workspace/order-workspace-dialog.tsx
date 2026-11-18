import type { ComponentProps } from 'react';
import { useOrderDialogStore } from '@/stores/order-dialog-store';
import { isOrderDialog } from '../types';
import { OrderDialogView } from '../ui/order-dialog-view';

type OrderWorkspaceDialogProps = Pick<
  ComponentProps<typeof OrderDialogView>,
  'modByPackageId' | 'onSubmit'
>;

export function OrderWorkspaceDialog(props: OrderWorkspaceDialogProps) {
  const dialog = useOrderDialogStore((state) =>
    isOrderDialog(state.dialog) ? state.dialog : null,
  );
  const close = useOrderDialogStore((state) => state.close);
  const updateValue = useOrderDialogStore((state) => state.updateValue);
  return <OrderDialogView {...props} dialog={dialog} onClose={close} onValueChange={updateValue} />;
}
