import type { ModMetadataDto } from '@/commands';

export type AvailableModSortKey = 'name' | 'packageId' | 'author' | 'source' | 'modifiedAt';
export type SortDirection = 'asc' | 'desc';

export function sortAvailableMods(
  mods: ModMetadataDto[],
  sortKey: AvailableModSortKey,
  direction: SortDirection,
): ModMetadataDto[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...mods].sort((a, b) => {
    const primary =
      sortKey === 'modifiedAt'
        ? compareNumber(a.modifiedAtMs, b.modifiedAtMs)
        : compareText(sortValue(a, sortKey), sortValue(b, sortKey));
    if (primary !== 0) {
      return primary * multiplier;
    }
    return compareText(a.packageId, b.packageId) || compareText(a.sourceKey, b.sourceKey);
  });
}

function sortValue(mod: ModMetadataDto, sortKey: AvailableModSortKey): string {
  switch (sortKey) {
    case 'name':
      return mod.name ?? mod.packageId;
    case 'packageId':
      return mod.packageId;
    case 'author':
      return mod.authors[0] ?? '';
    case 'source':
      return mod.sourceKind;
    case 'modifiedAt':
      return String(mod.modifiedAtMs);
  }
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}

function compareNumber(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}
