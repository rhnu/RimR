// Global single source of truth for the order page's dialog state.
//
// The OrderDialogView is rendered exactly once at the AppShell level; both
// AppShell-only flows (mod list create/rename/delete) and OrderPage flows
// (alias, group, separator, diff confirmations, etc.) write to this store.
//
// `orderEditHandler` is the bridge that lets the single top-level dialog
// dispatch non-mod-list submissions back into the OrderWorkspaceProvider's
// edit-action layer. It is registered (and torn down) by the provider via
// `useEffect`; AppShell reads it lazily inside the submit callback through
// `getState()` so registering does not trigger renders or stale-closure bugs.
//
// See docs/state-management.md (section 2: 状态归属表) for the rationale.

import { create } from 'zustand';
import { dialogHasValue, type OrderDialog } from '@/features/order/types';

type OrderEditHandler = (value: string) => void;

type OrderDialogState = {
  dialog: OrderDialog;
  orderEditHandler: OrderEditHandler | null;
  open: (dialog: Exclude<OrderDialog, null>) => void;
  close: () => void;
  updateValue: (value: string) => void;
  setOrderEditHandler: (handler: OrderEditHandler | null) => void;
};

export const useOrderDialogStore = create<OrderDialogState>((set, get) => ({
  dialog: null,
  orderEditHandler: null,

  open: (dialog) => {
    set({ dialog });
  },

  close: () => {
    set({ dialog: null });
  },

  updateValue: (value) => {
    const { dialog } = get();
    if (!dialog || !dialogHasValue(dialog)) return;
    set({ dialog: { ...dialog, value } });
  },

  setOrderEditHandler: (handler) => {
    set({ orderEditHandler: handler });
  },
}));
