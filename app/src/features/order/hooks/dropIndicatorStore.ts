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
  options: { allowInside?: boolean } = {},
): DropIndicatorEdge | undefined {
  const allowInside = options.allowInside ?? true;
  const getRowSnapshot = useCallback(
    () => edgeForRow(store.getSnapshot(), rowId, allowInside),
    [allowInside, rowId, store],
  );
  return useSyncExternalStore(store.subscribe, getRowSnapshot, getRowSnapshot);
}

function edgeForRow(
  indicator: DropIndicatorState | null,
  rowId: string,
  allowInside: boolean,
): DropIndicatorEdge | undefined {
  if (indicator?.targetId !== rowId) return undefined;
  if (!allowInside && indicator.edge === 'inside') return undefined;
  return indicator.edge;
}
