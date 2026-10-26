import { create } from 'zustand';
import type { LibraryDialog } from '@/features/library/types';
import type { OrderDialog } from '@/features/order/types';
import type { ModListDto } from '@/commands';
import { useOrderDraftStore } from './order-draft-store';

type AppDialog = LibraryDialog | OrderDialog | null;
type OrderDialogState = {
  dialog: AppDialog;
  draftAtOpen: ModListDto | null;
  open: (dialog: Exclude<AppDialog, null>) => void;
  close: () => void;
  updateValue: (value: string) => void;
};

/** Shared dialog data; each feature renders and submits its own variants. */
export const useOrderDialogStore = create<OrderDialogState>((set) => ({
  dialog: null,
  draftAtOpen: null,
  open: (dialog) => set({ dialog, draftAtOpen: useOrderDraftStore.getState().draft }),
  close: () => set({ dialog: null, draftAtOpen: null }),
  updateValue: (value) =>
    set((state) => {
      const { dialog } = state;
      return dialog && 'value' in dialog ? { dialog: { ...dialog, value } } : state;
    }),
}));
