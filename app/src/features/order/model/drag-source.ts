import type { ModListDto, ModListEntryDto, ModListGroupChildDto, ModMetadataDto } from '@/commands';
import { isPackageAddressableMod } from '@/domain/mods/catalog';
import { entryIndex, parseDragTarget, type DndSide } from '@/features/order/dnd-ids';

export type DragSelection = {
  modByCatalogKey: Map<string, ModMetadataDto>;
  selectedInactiveCatalogKeys: Set<string>;
  orderedInactiveCatalogKeys: string[];
  selectedEntryIds: Set<string>;
  visibleActiveEntryIds: string[];
};

export type DragSource = { id: string } & (
  | {
      kind: 'catalog';
      catalogKey: string;
      mods: ModMetadataDto[];
      grabbed: ModMetadataDto | undefined;
    }
  | { kind: 'entry'; side: DndSide; index: number; entries: ModListEntryDto[] }
  | { kind: 'child'; side: DndSide; groupId: string; index: number; child: ModListGroupChildDto }
);

/** Resolves a grabbed row and its visible selection for both the overlay and the drop. */
export function resolveDragSource(
  activeId: string,
  modList: ModListDto,
  selection: DragSelection,
): DragSource | null {
  const grabbed = parseDragTarget(activeId);
  if (!grabbed) return null;
  if (grabbed.kind === 'catalog') {
    const keys = orderedSelectedDragIds(
      grabbed.catalogKey,
      selection.selectedInactiveCatalogKeys,
      selection.orderedInactiveCatalogKeys,
    );
    return {
      id: activeId,
      kind: 'catalog',
      catalogKey: grabbed.catalogKey,
      grabbed: selection.modByCatalogKey.get(grabbed.catalogKey),
      mods: keys.flatMap((key) => {
        const mod = selection.modByCatalogKey.get(key);
        return mod && isPackageAddressableMod(mod) ? [mod] : [];
      }),
    };
  }
  if (grabbed.kind === 'panel') return null;
  if (grabbed.kind === 'child') {
    const row = groupChildAt(modList, grabbed.groupId, grabbed.childId);
    return row
      ? { id: activeId, kind: 'child', side: grabbed.side, groupId: grabbed.groupId, ...row }
      : null;
  }
  const index = entryIndex(modList, grabbed.entryId);
  const entry = modList.entries[index];
  if (!entry) return null;
  const ids =
    grabbed.side === 'active'
      ? orderedSelectedDragIds(
          grabbed.entryId,
          selection.selectedEntryIds,
          selection.visibleActiveEntryIds,
        )
      : [grabbed.entryId];
  if (ids.length === 1 && ids[0] === entry.id) {
    return { id: activeId, kind: 'entry', side: grabbed.side, index, entries: [entry] };
  }
  const entriesById = new Map(modList.entries.map((candidate) => [candidate.id, candidate]));
  const entries = ids.flatMap((id) => {
    const selected = entriesById.get(id);
    return selected ? [selected] : [];
  });
  return { id: activeId, kind: 'entry', side: grabbed.side, index, entries };
}

export function groupChildAt(modList: ModListDto, groupId: string, childId: string) {
  const group = modList.entries[entryIndex(modList, groupId)];
  if (group?.kind !== 'group') return null;
  const index = group.entries.findIndex((child) => child.id === childId);
  const child = group.entries[index];
  return child ? { index, child } : null;
}

function orderedSelectedDragIds(
  grabbedId: string,
  selected: Set<string>,
  orderedIds: string[],
): string[] {
  if (!selected.has(grabbedId)) return [grabbedId];
  const ordered = orderedIds.filter((id) => selected.has(id));
  return ordered.length > 0 ? ordered : [grabbedId];
}
