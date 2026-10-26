import { useCallback, type MouseEvent, type RefObject } from 'react';
import type { ModListEntryDto, ModListGroupChildDto, ModMetadataDto } from '@/commands';
import { identityForMod, resolveSourceKey } from '@/domain/mods/identity';
import type { Selection } from '@/features/order/types';
import { catalogItemKey } from '@/domain/mods/catalog';
import { updateSelectionForClick, type SelectionClickModifiers } from '@/features/order/model';

export type SelectionRefs = {
  /** Live catalog, used to resolve stored identities to their current path. */
  modByPackageId: RefObject<Map<string, ModMetadataDto>>;
  selectedInactiveCatalogKeys: RefObject<Set<string>>;
  orderedInactiveCatalogKeys: RefObject<string[]>;
  inactiveSourceKeys: RefObject<ReadonlyArray<string | null | undefined>>;
  inactiveSelectionAnchor: RefObject<string | null>;
  selectedEntryIds: RefObject<Set<string>>;
  visibleActiveEntryIds: RefObject<string[]>;
  activeSelectionAnchor: RefObject<string | null>;
  activeSourceKeys: RefObject<ReadonlyArray<string | null | undefined>>;
};

export function useSelectionHandlers({
  refs,
  setSelection,
  setSelectedEntryIds,
  setActiveSelectionAnchor,
  setSelectedInactiveCatalogKeys,
  setInactiveSelectionAnchor,
  warmSelectedPreview,
}: {
  refs: SelectionRefs;
  setSelection: (selection: Selection) => void;
  setSelectedEntryIds: (selected: Set<string>) => void;
  setActiveSelectionAnchor: (anchor: string | null) => void;
  setSelectedInactiveCatalogKeys: (selected: Set<string>) => void;
  setInactiveSelectionAnchor: (anchor: string | null) => void;
  warmSelectedPreview: (
    sourceKey: string | null | undefined,
    orderedSourceKeys: ReadonlyArray<string | null | undefined>,
  ) => void;
}) {
  return {
    selectInactiveMod: useInactiveSelectionHandler({
      refs,
      setSelection,
      setSelectedEntryIds,
      setActiveSelectionAnchor,
      setSelectedInactiveCatalogKeys,
      setInactiveSelectionAnchor,
      warmSelectedPreview,
    }),
    selectActiveEntry: useActiveSelectionHandler({
      refs,
      setSelection,
      setSelectedEntryIds,
      setActiveSelectionAnchor,
      setSelectedInactiveCatalogKeys,
      setInactiveSelectionAnchor,
      warmSelectedPreview,
    }),
    ensureInactiveSelected: useEnsureInactiveSelected(
      refs,
      setSelection,
      setSelectedInactiveCatalogKeys,
      setInactiveSelectionAnchor,
      warmSelectedPreview,
    ),
    ensureActiveSelected: useEnsureActiveSelected(
      refs,
      setSelection,
      setSelectedEntryIds,
      setActiveSelectionAnchor,
      warmSelectedPreview,
    ),
    selectGroupChild: useSelectGroupChild(refs, setSelection, warmSelectedPreview),
  };
}

function useInactiveSelectionHandler({
  refs,
  setSelection,
  setSelectedEntryIds,
  setActiveSelectionAnchor,
  setSelectedInactiveCatalogKeys,
  setInactiveSelectionAnchor,
  warmSelectedPreview,
}: Parameters<typeof useSelectionHandlers>[0]) {
  return useCallback(
    (mod: ModMetadataDto, event: MouseEvent<HTMLButtonElement>): void => {
      setSelection({ kind: 'mod', identity: identityForMod(mod), sourceKey: mod.sourceKey });
      warmSelectedPreview(mod.sourceKey, refs.inactiveSourceKeys.current);
      const itemKey = catalogItemKey(mod);
      const update = updateSelectionForClick(
        refs.selectedInactiveCatalogKeys.current,
        refs.orderedInactiveCatalogKeys.current,
        itemKey,
        modifiersFromMouseEvent(event),
        refs.inactiveSelectionAnchor.current,
      );
      setSelectedInactiveCatalogKeys(update.selected);
      setInactiveSelectionAnchor(update.anchorId);
      setSelectedEntryIds(new Set());
      setActiveSelectionAnchor(null);
    },
    [
      refs,
      setActiveSelectionAnchor,
      setInactiveSelectionAnchor,
      setSelectedEntryIds,
      setSelectedInactiveCatalogKeys,
      setSelection,
      warmSelectedPreview,
    ],
  );
}

function useActiveSelectionHandler({
  refs,
  setSelection,
  setSelectedEntryIds,
  setActiveSelectionAnchor,
  setSelectedInactiveCatalogKeys,
  setInactiveSelectionAnchor,
  warmSelectedPreview,
}: Parameters<typeof useSelectionHandlers>[0]) {
  return useCallback(
    (
      entry: ModListEntryDto,
      selectedEntry: Selection,
      event?: MouseEvent<HTMLButtonElement>,
    ): void => {
      if (!event) {
        selectEntryWithoutMouse(
          selectedEntry,
          setSelection,
          warmSelectedPreview,
          refs.activeSourceKeys.current,
          refs.modByPackageId.current,
        );
        return;
      }
      setSelectedInactiveCatalogKeys(new Set());
      setInactiveSelectionAnchor(null);
      selectEntryWithMouse(entry, event, selectedEntry, refs, {
        setSelection,
        setSelectedEntryIds,
        setActiveSelectionAnchor,
        warmSelectedPreview,
      });
    },
    [
      refs,
      setActiveSelectionAnchor,
      setInactiveSelectionAnchor,
      setSelectedEntryIds,
      setSelectedInactiveCatalogKeys,
      setSelection,
      warmSelectedPreview,
    ],
  );
}

function selectEntryWithoutMouse(
  selection: Selection,
  setSelection: (selection: Selection) => void,
  warmSelectedPreview: (
    sourceKey: string | null | undefined,
    keys: ReadonlyArray<string | null | undefined>,
  ) => void,
  activeSourceKeys: ReadonlyArray<string | null | undefined>,
  modByPackageId: Map<string, ModMetadataDto>,
): void {
  setSelection(selection);
  if (selection?.kind === 'mod') {
    warmSelectedPreview(resolveSourceKey(selection.identity, modByPackageId), activeSourceKeys);
  }
}

function selectEntryWithMouse(
  entry: ModListEntryDto,
  event: MouseEvent<HTMLButtonElement>,
  selectedEntry: Selection,
  refs: SelectionRefs,
  setters: {
    setSelection: (selection: Selection) => void;
    setSelectedEntryIds: (selected: Set<string>) => void;
    setActiveSelectionAnchor: (anchor: string | null) => void;
    warmSelectedPreview: (
      sourceKey: string | null | undefined,
      keys: ReadonlyArray<string | null | undefined>,
    ) => void;
  },
): void {
  if (entry.kind !== 'mod') {
    setters.setSelectedEntryIds(new Set());
    setters.setActiveSelectionAnchor(null);
    setters.setSelection(selectedEntry);
    return;
  }
  setters.setSelection({ kind: 'mod', identity: entry.identity });
  setters.warmSelectedPreview(
    resolveSourceKey(entry.identity, refs.modByPackageId.current),
    refs.activeSourceKeys.current,
  );
  const update = updateSelectionForClick(
    refs.selectedEntryIds.current,
    refs.visibleActiveEntryIds.current,
    entry.id,
    modifiersFromMouseEvent(event),
    refs.activeSelectionAnchor.current,
  );
  setters.setSelectedEntryIds(update.selected);
  setters.setActiveSelectionAnchor(update.anchorId);
}

function useEnsureInactiveSelected(
  refs: SelectionRefs,
  setSelection: (selection: Selection) => void,
  setSelectedInactiveCatalogKeys: (selected: Set<string>) => void,
  setInactiveSelectionAnchor: (anchor: string | null) => void,
  warmSelectedPreview: (
    sourceKey: string | null | undefined,
    keys: ReadonlyArray<string | null | undefined>,
  ) => void,
) {
  return useCallback(
    (mod: ModMetadataDto): void => {
      const itemKey = catalogItemKey(mod);
      if (!refs.selectedInactiveCatalogKeys.current.has(itemKey)) {
        setSelectedInactiveCatalogKeys(new Set([itemKey]));
        setInactiveSelectionAnchor(itemKey);
      }
      setSelection({ kind: 'mod', identity: identityForMod(mod), sourceKey: mod.sourceKey });
      warmSelectedPreview(mod.sourceKey, refs.inactiveSourceKeys.current);
    },
    [
      refs,
      setInactiveSelectionAnchor,
      setSelectedInactiveCatalogKeys,
      setSelection,
      warmSelectedPreview,
    ],
  );
}

function useEnsureActiveSelected(
  refs: SelectionRefs,
  setSelection: (selection: Selection) => void,
  setSelectedEntryIds: (selected: Set<string>) => void,
  setActiveSelectionAnchor: (anchor: string | null) => void,
  warmSelectedPreview: (
    sourceKey: string | null | undefined,
    keys: ReadonlyArray<string | null | undefined>,
  ) => void,
) {
  return useCallback(
    (entry: ModListEntryDto): void => {
      if (entry.kind === 'mod' && !refs.selectedEntryIds.current.has(entry.id)) {
        setSelectedEntryIds(new Set([entry.id]));
        setActiveSelectionAnchor(entry.id);
      }
      setSelection(selectionForEntry(entry));
      if (entry.kind === 'mod') {
        warmSelectedPreview(
          resolveSourceKey(entry.identity, refs.modByPackageId.current),
          refs.activeSourceKeys.current,
        );
      }
    },
    [refs, setActiveSelectionAnchor, setSelectedEntryIds, setSelection, warmSelectedPreview],
  );
}

function useSelectGroupChild(
  refs: SelectionRefs,
  setSelection: (selection: Selection) => void,
  warmSelectedPreview: (
    sourceKey: string | null | undefined,
    keys: ReadonlyArray<string | null | undefined>,
  ) => void,
) {
  return useCallback(
    (child: ModListGroupChildDto): void => {
      setSelection({ kind: 'mod', identity: child.identity });
      warmSelectedPreview(
        resolveSourceKey(child.identity, refs.modByPackageId.current),
        refs.activeSourceKeys.current,
      );
    },
    [refs, setSelection, warmSelectedPreview],
  );
}

function selectionForEntry(entry: ModListEntryDto): Selection {
  if (entry.kind === 'mod') return { kind: 'mod', identity: entry.identity };
  if (entry.kind === 'group') return { kind: 'group', entryId: entry.id };
  return { kind: 'separator', entryId: entry.id };
}

function modifiersFromMouseEvent(event: MouseEvent): SelectionClickModifiers {
  return {
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  };
}
