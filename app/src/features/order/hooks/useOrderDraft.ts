import { useCallback, useEffect } from 'react';
import type { ModListDto } from '@/commands';
import { useOrderDraftStore } from '@/stores/orderDraftStore';

// Thin React bindings over `useOrderDraftStore`. The store is the single
// source of truth for the order page's draft state.
//
// Initialization (seeding the store from `library.data.currentModList`) is
// owned by `useInitializeOrderDraft` and must run unconditionally on the
// OrderPage, BEFORE any branch that decides whether to mount the workspace
// subtree. This decouples the store's `draft != null` precondition from the
// rendering of `OrderWorkspaceProvider`, avoiding the deadlock where the
// page waits for a draft that only the workspace would initialize.
//
// `useOrderDraft` is a read-only hook used inside the workspace subtree.
// See docs/state-management.md and src/stores/README.md for the rationale.

export function useInitializeOrderDraft(currentModList: ModListDto | undefined): void {
  const initialize = useOrderDraftStore((s) => s.initialize);
  useEffect(() => {
    if (currentModList) initialize(currentModList);
  }, [currentModList, initialize]);
}

export function useOrderDraft() {
  const draft = useOrderDraftStore((s) => s.draft);
  const baseline = useOrderDraftStore((s) => s.baseline);
  const modListDirty = useOrderDraftStore((s) => s.isDirty);
  const applyAction = useOrderDraftStore((s) => s.applyAction);
  const replaceSavedDraftAction = useOrderDraftStore((s) => s.replaceSavedDraft);
  const discard = useOrderDraftStore((s) => s.discard);

  const applyDraft = useCallback(applyAction, [applyAction]);
  const replaceSavedDraft = useCallback(replaceSavedDraftAction, [replaceSavedDraftAction]);
  const resetToBaseline = useCallback(discard, [discard]);

  return {
    draft,
    baseline,
    modListDirty,
    applyDraft,
    replaceSavedDraft,
    resetToBaseline,
  };
}
