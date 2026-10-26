import { useEffect, useRef } from 'react';
import type { ModListDto, CatalogSnapshotDto } from '@/commands';
import { useValidateActiveOrder } from '@/hooks/commands';
import { useValidationStore, VALIDATION_DEBOUNCE_MS } from '@/stores/validation';
import { activeModsKey } from '@/features/order/model';

export function useOrderValidation(draft: ModListDto | null, scan: CatalogSnapshotDto | undefined) {
  const validate = useValidateActiveOrder();
  const validationResult = useValidationStore((s) => s.result);
  const setValidationResult = useValidationStore((s) => s.setResult);
  const clearValidationResult = useValidationStore((s) => s.clear);
  const invalidateValidation = useValidationStore((s) => s.invalidate);
  const draftRef = useRef(draft);
  const validateRef = useRef(validate);
  const lastDraftIdRef = useRef<string | null>(null);

  draftRef.current = draft;
  validateRef.current = validate;

  useEffect(() => {
    const currentDraft = draftRef.current;
    if (!currentDraft || !scan) {
      clearValidationResult();
      lastDraftIdRef.current = null;
      return;
    }
    if (lastDraftIdRef.current !== null && lastDraftIdRef.current !== currentDraft.id) {
      invalidateValidation();
    }
    lastDraftIdRef.current = currentDraft.id;
    const activeMods = currentDraft.activeMods;
    const validationKey = activeModsKey(activeMods);
    const timeout = window.setTimeout(() => {
      validateRef.current.mutate(
        { activeMods },
        {
          onSuccess: (result) => {
            if (activeModsKey(draftRef.current?.activeMods ?? []) === validationKey) {
              setValidationResult(result);
            }
          },
        },
      );
    }, VALIDATION_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [clearValidationResult, draft, invalidateValidation, scan, setValidationResult]);

  return { validate, validationResult };
}
