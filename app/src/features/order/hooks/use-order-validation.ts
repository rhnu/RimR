import { useEffect, useMemo, useRef } from 'react';
import type { ModListDto, CatalogSnapshotDto, ValidateOrderDto } from '@/commands';
import { useValidateActiveOrder } from '@/queries/catalog';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useValidationStore, VALIDATION_DEBOUNCE_MS } from '@/stores/validation';
import { flattenModListEntries } from '@/domain/mod-list/normalize';

export type OrderValidation = {
  validationResult: ValidateOrderDto | null;
  phase: 'idle' | 'validating' | 'ready' | 'error';
};

export function useOrderValidation(
  draft: ModListDto | null,
  scan: CatalogSnapshotDto | undefined,
  catalogRevision: number,
): OrderValidation {
  const validate = useValidateActiveOrder();
  const validateRef = useRef(validate);
  validateRef.current = validate;
  const epoch = useWorkspaceStore((state) => state.epoch);
  const result = useValidationStore((state) => state.result);
  const storedInputKey = useValidationStore((state) => state.inputKey);
  const storedPhase = useValidationStore((state) => state.phase);
  const activeMods = draft ? flattenModListEntries(draft.entries) : [];
  const inputKey =
    draft && scan ? JSON.stringify([epoch, catalogRevision, draft.id, activeMods]) : null;
  const latestOrder = useRef(activeMods);
  latestOrder.current = activeMods;

  useEffect(() => {
    const store = useValidationStore.getState();
    if (inputKey === null) {
      store.clear();
      return;
    }
    if (store.inputKey === inputKey && store.phase === 'ready') return;
    const token = store.begin(inputKey);
    const order = latestOrder.current;
    const timeout = window.setTimeout(() => {
      validateRef.current.mutate(
        { activeMods: order },
        {
          onSuccess: (value) => useValidationStore.getState().complete(token, value),
          onError: () => useValidationStore.getState().fail(token),
        },
      );
    }, VALIDATION_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timeout);
      const current = useValidationStore.getState();
      if (current.requestId === token && current.phase === 'validating') current.invalidate();
    };
  }, [inputKey]);
  return useMemo(
    () => ({
      validationResult: storedInputKey === inputKey ? result : null,
      phase: storedInputKey === inputKey ? storedPhase : 'idle',
    }),
    [storedInputKey, inputKey, result, storedPhase],
  );
}
