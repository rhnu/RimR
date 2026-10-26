// Global single source of truth for the order page's mod list draft.
//
// This store is the sole holder of `draft`, `baseline`, and the dirty flag.
// `useOrderDraft` is a thin React binding over it; consumers outside the
// OrderPage (e.g. AppShell, file menu) read `draft` directly via this store.
//
// See docs/state-management.md (section 2: 状态归属表) for the rationale.

import { create } from 'zustand';
import type { ModListDto } from '@/commands';
import { modListReducer, type ModListAction } from '@/features/order/model';

type OrderDraftState = {
  draft: ModListDto | null;
  baseline: ModListDto | null;
  isDirty: boolean;
  isReady: boolean;
  initialize: (modList: ModListDto) => void;
  applyAction: (action: ModListAction) => void;
  replaceSavedDraft: (modList: ModListDto) => void;
  discard: () => void;
  reset: () => void;
};

export const useOrderDraftStore = create<OrderDraftState>((set, get) => ({
  draft: null,
  baseline: null,
  isDirty: false,
  isReady: false,

  // Resets draft/baseline only when the incoming mod list represents a
  // different identity than the current baseline. Comparing by `id` (the
  // mod list's stable identifier in `ModListDto`) means React Query refetches
  // that return a new reference with the same id will NOT clobber unsaved
  // edits, and navigating away and back to OrderPage preserves the draft.
  initialize: (modList) => {
    const { baseline, isReady } = get();
    if (isReady && baseline && baseline.id === modList.id) return;
    set({ draft: modList, baseline: modList, isDirty: false, isReady: true });
  },

  applyAction: (action) => {
    const { draft } = get();
    if (!draft) return;
    set({ draft: modListReducer(draft, action), isDirty: true });
  },

  replaceSavedDraft: (modList) => {
    set({ draft: modList, baseline: modList, isDirty: false, isReady: true });
  },

  discard: () => {
    const { baseline } = get();
    if (!baseline) return;
    set({ draft: baseline, isDirty: false });
  },

  reset: () => {
    set({ draft: null, baseline: null, isDirty: false, isReady: false });
  },
}));
