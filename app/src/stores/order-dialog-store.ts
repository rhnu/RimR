import { create } from 'zustand';
import type { LibraryDialog } from '@/features/library/types';
import type { OrderDialog } from '@/features/order/types';
import type { ModListDto } from '@/commands';
import { useOrderDraftStore } from './order-draft-store';
import { useWorkspaceStore } from './workspace-store';

type AppDialog = LibraryDialog | OrderDialog | null;
export type OrderDialogSession = { workspaceEpoch: number; draft: ModListDto | null };

type OrderDialogState = {
  dialog: AppDialog;
  sessionAtOpen: OrderDialogSession | null;
  open: (dialog: Exclude<AppDialog, null>) => void;
  close: () => void;
  updateValue: (value: string) => void;
};

/** Shared dialog data; each feature renders and submits its own variants. */
export const useOrderDialogStore = create<OrderDialogState>((set) => ({
  dialog: null,
  sessionAtOpen: null,
  open: (dialog) =>
    set({
      dialog,
      sessionAtOpen: {
        workspaceEpoch: useWorkspaceStore.getState().epoch,
        draft: useOrderDraftStore.getState().draft,
      },
    }),
  close: () => set({ dialog: null, sessionAtOpen: null }),
  updateValue: (value) =>
    set((state) => {
      const { dialog } = state;
      return dialog && 'value' in dialog ? { dialog: { ...dialog, value } } : state;
    }),
}));
