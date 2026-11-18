import { useCallback, useSyncExternalStore } from 'react';
import { sameDropIndicator, type DropIndicatorState } from '@/features/order/model';

export type DropIndicatorEdge = DropIndicatorState['edge'];

export type DropIndicatorStore = {
  getSnapshot: () => DropIndicatorState | null;
  set: (next: DropIndicatorState | null) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createDropIndicatorStore(): DropIndicatorStore {
  let current: DropIndicatorState | null = null;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => current,
    set: (next) => {
      if (sameDropIndicator(current, next)) return;
      current = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useDropIndicatorEdge(
  store: DropIndicatorStore,
  rowId: string,
): DropIndicatorEdge | undefined {
  const getRowSnapshot = useCallback(() => {
    const indicator = store.getSnapshot();
    return indicator?.targetId === rowId ? indicator.edge : undefined;
  }, [rowId, store]);
  return useSyncExternalStore(store.subscribe, getRowSnapshot, getRowSnapshot);
}
