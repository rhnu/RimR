import { create } from 'zustand';

export type OrderCommand = { kind: 'syncFromSave'; modIds: string[] };
type OrderCommandState = {
  pending: OrderCommand | null;
  request: (command: OrderCommand) => void;
  consume: () => OrderCommand | null;
  clear: () => void;
};

/** One cross-route intent, consumed when the order workspace is ready. */
export const useOrderCommandStore = create<OrderCommandState>((set, get) => ({
  pending: null,
  request: (command) => set({ pending: command }),
  consume: () => {
    const pending = get().pending;
    set({ pending: null });
    return pending;
  },
  clear: () => set({ pending: null }),
}));
