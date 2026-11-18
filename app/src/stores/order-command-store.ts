import { create } from 'zustand';

export type OrderCommandTarget = { workspaceEpoch: number; modListId: string };
export type OrderCommand = { kind: 'syncFromSave'; target: OrderCommandTarget; modIds: string[] };
type OrderCommandState = {
  pending: OrderCommand | null;
  request: (command: OrderCommand) => void;
  consume: (command: OrderCommand) => boolean;
  clear: () => void;
};

/** One cross-route intent, consumed when the order workspace is ready. */
export const useOrderCommandStore = create<OrderCommandState>((set, get) => ({
  pending: null,
  request: (command) => set({ pending: command }),
  consume: (command) => {
    if (get().pending !== command) return false;
    set({ pending: null });
    return true;
  },
  clear: () => set({ pending: null }),
}));

export function matchesOrderCommandTarget(
  target: OrderCommandTarget,
  workspaceEpoch: number,
  modListId: string | undefined,
): boolean {
  return target.workspaceEpoch === workspaceEpoch && target.modListId === modListId;
}
