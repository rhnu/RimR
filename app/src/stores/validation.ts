import { create } from 'zustand';
import type { ValidateOrderDto } from '@/commands';

type ValidationState = {
  result: ValidateOrderDto | null;
  inputKey: string | null;
  phase: 'idle' | 'validating' | 'ready' | 'error';
  requestId: number;
  begin: (inputKey: string) => number;
  complete: (token: number, result: ValidateOrderDto) => void;
  fail: (token: number) => void;
  invalidate: () => void;
  clear: () => void;
};

export const useValidationStore = create<ValidationState>((set, get) => {
  const clear = () =>
    set((state) => ({
      result: null,
      inputKey: null,
      phase: 'idle',
      requestId: state.requestId + 1,
    }));
  return {
    result: null,
    inputKey: null,
    phase: 'idle',
    requestId: 0,
    begin: (inputKey) => {
      const requestId = get().requestId + 1;
      set({ inputKey, requestId, phase: 'validating', result: null });
      return requestId;
    },
    complete: (token, result) =>
      set((state) => (token === state.requestId ? { result, phase: 'ready' } : state)),
    fail: (token) =>
      set((state) => (token === state.requestId ? { result: null, phase: 'error' } : state)),
    invalidate: clear,
    clear,
  };
});

export const VALIDATION_DEBOUNCE_MS = 250;
