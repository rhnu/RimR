import { create } from 'zustand';

/** Identifies the client session so results from retired paths cannot enter new caches. */
export const useWorkspaceStore = create<{ epoch: number; advance: () => void }>((set) => ({
  epoch: 0,
  advance: () => set((state) => ({ epoch: state.epoch + 1 })),
}));
