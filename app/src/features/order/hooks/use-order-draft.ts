import type { OrderDraftState } from '../context/workspace-types';
import { useCallback, useEffect, useMemo } from 'react';
import type { ModListDto } from '@/commands';
import { useOrderDraftStore } from '@/stores/order-draft-store';

// Initialize before rendering workspace branches; its presence must not depend on an existing draft.
export function useInitializeOrderDraft(currentModList: ModListDto | undefined): void {
  const initialize = useOrderDraftStore((s) => s.initialize);
  useEffect(() => {
    if (currentModList) initialize(currentModList);
  }, [currentModList, initialize]);
}

export function useOrderDraft(): OrderDraftState {
  const draft = useOrderDraftStore((s) => s.draft);
  const baseline = useOrderDraftStore((s) => s.baseline);
  const hasConflict = useOrderDraftStore((s) => s.hasConflict);
  const acceptSaved = useOrderDraftStore((s) => s.acceptSaved);
  const modListDirty = useOrderDraftStore((s) => s.isDirty);
  const applyAction = useOrderDraftStore((s) => s.applyAction);
  const replaceSavedDraftAction = useOrderDraftStore((s) => s.replaceSavedDraft);
  const discard = useOrderDraftStore((s) => s.discard);

  const applyDraft = useCallback(applyAction, [applyAction]);
  const replaceSavedDraft = useCallback(replaceSavedDraftAction, [replaceSavedDraftAction]);
  const resetToBaseline = useCallback(discard, [discard]);

  return useMemo(
    () => ({
      draft,
      baseline,
      modListDirty,
      hasConflict,
      acceptSaved,
      applyDraft,
      replaceSavedDraft,
      resetToBaseline,
    }),
    [
      draft,
      baseline,
      modListDirty,
      hasConflict,
      acceptSaved,
      applyDraft,
      replaceSavedDraft,
      resetToBaseline,
    ],
  );
}
