import type { ModMetadataDto, ModListDto, ModListEntryDto } from '@/commands';
import { catalogItemKey } from '@/domain/mods/catalog';

export type DndSide = 'active' | 'inactive';

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

export function parseChildId(
  id: string,
): { side: DndSide; groupId: string; childId: string } | null {
  const parts = id.split(':');
  if (parts.length < 4 || !isSide(parts[0]) || parts[1] !== 'child') {
    return null;
  }
  return { side: parts[0], groupId: parts[2], childId: parts.slice(3).join(':') };
}

export function parseEntryId(id: string): { side: DndSide; entryId: string } | null {
  const parts = id.split(':');
  if (parts.length < 3 || !isSide(parts[0]) || parts[1] !== 'entry') {
    return null;
  }
  return { side: parts[0], entryId: parts.slice(2).join(':') };
}

export function parseCatalogId(id: string): { catalogKey: string } | null {
  const parts = id.split(':');
  if (parts.length < 3 || parts[0] !== 'inactive' || parts[1] !== 'catalog') {
    return null;
  }
  return { catalogKey: parts.slice(2).join(':') };
}

export function entryIndex(modList: ModListDto, entryId: string): number {
  return modList.entries.findIndex((entry) => entry.id === entryId);
}

export function childIndex(modList: ModListDto, groupId: string, childId: string): number {
  const group = modList.entries.find(
    (entry): entry is Extract<ModListEntryDto, { kind: 'group' }> =>
      entry.kind === 'group' && entry.id === groupId,
  );
  return group?.entries.findIndex((child) => child.id === childId) ?? -1;
}

export function dragEdgeByIndex(from: number, to: number): 'before' | 'after' {
  return from >= 0 && to >= 0 && from < to ? 'after' : 'before';
}

function isSide(value: string): value is DndSide {
  return value === 'active' || value === 'inactive';
}
