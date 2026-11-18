import type { ModMetadataDto, ModListDto } from '@/commands';
import { catalogItemKey } from '@/domain/mods/catalog';

export type DndSide = 'active' | 'inactive';
export const ACTIVE_DROP_ID = 'active-drop';
export const INACTIVE_DROP_ID = 'inactive-drop';

type SortableRow =
  | { kind: 'entry'; side: DndSide; entryId: string }
  | { kind: 'child'; side: DndSide; groupId: string; childId: string }
  | { kind: 'catalog'; side: 'inactive'; catalogKey: string };

export type DragTarget = SortableRow | { kind: 'panel'; side: DndSide };

export function entrySortableId(entryId: string, side: DndSide = 'active'): string {
  return `${side}:entry:${entryId}`;
}

export function inactiveSortableIdForMod(mod: ModMetadataDto): string {
  return inactiveCatalogSortableId(catalogItemKey(mod));
}

export function inactiveCatalogSortableId(itemKey: string): string {
  return `inactive:catalog:${itemKey}`;
}

export function childSortableId(
  groupId: string,
  childId: string,
  side: DndSide = 'active',
): string {
  return `${side}:child:${groupId}:${childId}`;
}

export function parseDragTarget(id: string): DragTarget | null {
  if (id === ACTIVE_DROP_ID) return { kind: 'panel', side: 'active' };
  if (id === INACTIVE_DROP_ID) return { kind: 'panel', side: 'inactive' };
  const parts = id.split(':');
  const [side, kind, key] = parts;
  if (!isSide(side) || key === undefined) return null;
  if (kind === 'child' && parts.length >= 4) {
    return { kind, side, groupId: key, childId: parts.slice(3).join(':') };
  }
  if (kind === 'entry') return { kind, side, entryId: parts.slice(2).join(':') };
  if (kind === 'catalog' && side === 'inactive') {
    return { kind, side, catalogKey: parts.slice(2).join(':') };
  }
  return null;
}

export function entryIndex(modList: ModListDto, entryId: string): number {
  return modList.entries.findIndex((entry) => entry.id === entryId);
}

function isSide(value: string | undefined): value is DndSide {
  return value === 'active' || value === 'inactive';
}
