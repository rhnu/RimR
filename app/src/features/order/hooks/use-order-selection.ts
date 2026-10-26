import type { OrderSelection } from '../context/workspace-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModMetadataDto } from '@/commands';
import type { Selection } from '@/features/order/types';
import { pruneSelection } from '@/features/order/model';
import { useSelectionHandlers, type SelectionRefs } from './selection-handlers';

export function useOrderSelection({
  modByPackageId,
  orderedInactiveCatalogKeys,
  inactiveSourceKeys,
  visibleActiveEntryIds,
  activeSourceKeys,
  warmSelectedPreview,
}: {
  modByPackageId: Map<string, ModMetadataDto>;
  orderedInactiveCatalogKeys: string[];
  inactiveSourceKeys: ReadonlyArray<string | null | undefined>;
  visibleActiveEntryIds: string[];
  activeSourceKeys: ReadonlyArray<string | null | undefined>;
  warmSelectedPreview: (
    sourceKey: string | null | undefined,
    orderedSourceKeys: ReadonlyArray<string | null | undefined>,
  ) => void;
}): OrderSelection {
  const [selection, setSelection] = useState<Selection>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [activeSelectionAnchor, setActiveSelectionAnchor] = useState<string | null>(null);
  const [inactiveSelectionAnchor, setInactiveSelectionAnchor] = useState<string | null>(null);
  const [selectedInactiveCatalogKeys, setSelectedInactiveCatalogKeys] = useState<Set<string>>(
    new Set(),
  );
  const refs = useSelectionRefs({
    modByPackageId,
    selectedInactiveCatalogKeys,
    orderedInactiveCatalogKeys,
    inactiveSourceKeys,
    inactiveSelectionAnchor,
    selectedEntryIds,
    visibleActiveEntryIds,
    activeSelectionAnchor,
    activeSourceKeys,
  });

  useSelectionPruning({
    orderedInactiveCatalogKeys,
    visibleActiveEntryIds,
    setSelectedInactiveCatalogKeys,
    setInactiveSelectionAnchor,
    setSelectedEntryIds,
    setActiveSelectionAnchor,
  });

  const resetSelections = useCallback((): void => {
    setSelectedEntryIds(new Set());
    setSelectedInactiveCatalogKeys(new Set());
    setActiveSelectionAnchor(null);
    setInactiveSelectionAnchor(null);
    setSelection(null);
  }, []);

  const handlers = useSelectionHandlers({
    refs,
    setSelection,
    setSelectedEntryIds,
    setActiveSelectionAnchor,
    setSelectedInactiveCatalogKeys,
    setInactiveSelectionAnchor,
    warmSelectedPreview,
  });

  return {
    selection,
    selectedEntryIds,
    selectedInactiveCatalogKeys,
    resetSelections,
    ...handlers,
  };
}

function useSelectionRefs(state: {
  modByPackageId: Map<string, ModMetadataDto>;
  selectedInactiveCatalogKeys: Set<string>;
  orderedInactiveCatalogKeys: string[];
  inactiveSourceKeys: ReadonlyArray<string | null | undefined>;
  inactiveSelectionAnchor: string | null;
  selectedEntryIds: Set<string>;
  visibleActiveEntryIds: string[];
  activeSelectionAnchor: string | null;
  activeSourceKeys: ReadonlyArray<string | null | undefined>;
}): SelectionRefs {
  const refs = {
    modByPackageId: useRef(state.modByPackageId),
    selectedInactiveCatalogKeys: useRef(state.selectedInactiveCatalogKeys),
    orderedInactiveCatalogKeys: useRef(state.orderedInactiveCatalogKeys),
    inactiveSourceKeys: useRef(state.inactiveSourceKeys),
    inactiveSelectionAnchor: useRef(state.inactiveSelectionAnchor),
    selectedEntryIds: useRef(state.selectedEntryIds),
    visibleActiveEntryIds: useRef(state.visibleActiveEntryIds),
    activeSelectionAnchor: useRef(state.activeSelectionAnchor),
    activeSourceKeys: useRef(state.activeSourceKeys),
  };
  refs.modByPackageId.current = state.modByPackageId;
  refs.selectedInactiveCatalogKeys.current = state.selectedInactiveCatalogKeys;
  refs.orderedInactiveCatalogKeys.current = state.orderedInactiveCatalogKeys;
  refs.inactiveSourceKeys.current = state.inactiveSourceKeys;
  refs.inactiveSelectionAnchor.current = state.inactiveSelectionAnchor;
  refs.selectedEntryIds.current = state.selectedEntryIds;
  refs.visibleActiveEntryIds.current = state.visibleActiveEntryIds;
  refs.activeSelectionAnchor.current = state.activeSelectionAnchor;
  refs.activeSourceKeys.current = state.activeSourceKeys;
  return refs;
}

function useSelectionPruning({
  orderedInactiveCatalogKeys,
  visibleActiveEntryIds,
  setSelectedInactiveCatalogKeys,
  setInactiveSelectionAnchor,
  setSelectedEntryIds,
  setActiveSelectionAnchor,
}: {
  orderedInactiveCatalogKeys: string[];
  visibleActiveEntryIds: string[];
  setSelectedInactiveCatalogKeys: (update: (current: Set<string>) => Set<string>) => void;
  setInactiveSelectionAnchor: (update: (anchor: string | null) => string | null) => void;
  setSelectedEntryIds: (update: (current: Set<string>) => Set<string>) => void;
  setActiveSelectionAnchor: (update: (anchor: string | null) => string | null) => void;
}) {
  useEffect(() => {
    setSelectedInactiveCatalogKeys((current) => {
      const next = pruneSelection(current, orderedInactiveCatalogKeys);
      return setsEqual(current, next) ? current : next;
    });
    setInactiveSelectionAnchor((anchor) =>
      anchor && orderedInactiveCatalogKeys.includes(anchor) ? anchor : null,
    );
  }, [orderedInactiveCatalogKeys, setInactiveSelectionAnchor, setSelectedInactiveCatalogKeys]);

  useEffect(() => {
    setSelectedEntryIds((current) => {
      const next = pruneSelection(current, visibleActiveEntryIds);
      return setsEqual(current, next) ? current : next;
    });
    setActiveSelectionAnchor((anchor) =>
      anchor && visibleActiveEntryIds.includes(anchor) ? anchor : null,
    );
  }, [setActiveSelectionAnchor, setSelectedEntryIds, visibleActiveEntryIds]);
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}
