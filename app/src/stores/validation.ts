// Cross-route validation cache for the order page.
//
// Why a Zustand store instead of React Query?
//   - The "result" is not server-owned data: it's derived from the in-memory
//     draft (`useOrderDraftStore`) and the most recent catalog scan. There is
//     no server-side resource to map a query key onto.
//   - It must persist across route changes so that returning to OrderPage,
//     opening the validation badge, or showing a summary elsewhere does not
//     trigger a re-run.
//   - It does not benefit from React Query's retry/refetch/stale semantics —
//     re-validation is debounced inside `useOrderValidation` and only depends
//     on `activeModsKey(draft.activeMods)` changing.
//
// Why not a feature-Context (OrderWorkspaceContext)?
//   - Consumers outside the order page (e.g. future summary widgets on the
//     AppShell) should be able to read the latest result without forcing a
//     re-validation. Tying it to the page-level Context would tear down the
//     cache the moment the user navigates away, which we explicitly want to
//     avoid for this slice.
//
// See docs/state-management.md (section 2: 状态归属表) for the full rationale.

import { create } from 'zustand';
import type { ValidateOrderDto } from '@/commands';

type ValidationState = {
  result: ValidateOrderDto | null;
  validatedAt: number | null;
  setResult: (result: ValidateOrderDto) => void;
  invalidate: () => void;
  clear: () => void;
};

export const useValidationStore = create<ValidationState>((set) => ({
  result: null,
  validatedAt: null,
  setResult: (result) => set({ result, validatedAt: Date.now() }),
  // `invalidate` is the explicit hook for external mutations (save / apply /
  // path change) that should mark the cached result stale without clobbering
  // it before the next debounced re-run lands. Today it mirrors `clear`, but
  // keeping it as a separate action lets us change the semantics later (for
  // example: keep the previous result but mark it stale via `validatedAt`)
  // without churning the call sites.
  invalidate: () => set({ result: null, validatedAt: null }),
  clear: () => set({ result: null, validatedAt: null }),
}));

export const VALIDATION_DEBOUNCE_MS = 250;
