import type {
  DisplayAliasDto,
  ModMetadataDto,
  ModListEntryDto,
  ModListGroupChildDto,
} from '@/commands';
import {
  childSortableId,
  entrySortableId,
  inactiveCatalogSortableId,
} from '@/features/order/dndIds';
import { catalogItemKey, packageCatalogItemKey } from './catalogItemKey';
import type { AvailableModSortKey, SortDirection } from '@/lib/availableMods';
import type { InactiveRenderContext, InactiveRenderRow } from './inactiveSelectorsTypes';
import { sortGroupBlocks, sortOrdinaryRows } from './inactiveSorting';
import type { CompiledSmartSearch } from './smartSearch';

export type { InactiveRenderContext, InactiveRenderRow };

export type InactiveRenderOptions = {
  search: CompiledSmartSearch;
  aliases: DisplayAliasDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  sortKey?: AvailableModSortKey;
  sortDirection?: SortDirection;
};

export function filterInactiveMods(
  mods: ModMetadataDto[],
  search: CompiledSmartSearch,
): ModMetadataDto[] {
  if (search.isEmpty) {
    return mods;
  }
  return mods.filter((mod) => search.matchesMod(mod));
}

export function buildInactiveRenderRows(
  entries: ModListEntryDto[],
  catalogMods: ModMetadataDto[],
  options: InactiveRenderOptions,
): InactiveRenderRow[] {
  const ctx = inactiveRenderContext(options);
  const structured = new Set(structuredCatalogKeys(entries));
  const groupBlocks: InactiveRenderRow[][] = [];
  const ordinaryRows: InactiveRenderRow[] = [];
  for (const entry of entries) {
    const rows = inactiveEntryRenderRows(entry, ctx);
    if (rows[0]?.kind === 'entry' && rows[0].entry.kind === 'group') {
      groupBlocks.push(rows);
    } else {
      ordinaryRows.push(...rows);
    }
  }
  for (const mod of catalogMods) {
    const itemKey = catalogItemKey(mod);
    if (structured.has(itemKey)) continue;
    if (!ctx.search.matchesMod(mod)) continue;
    ordinaryRows.push({
      kind: 'catalog',
      id: inactiveCatalogSortableId(itemKey),
      mod,
      depth: 0,
      missing: false,
    });
  }
  return [...sortGroupBlocks(groupBlocks, ctx).flat(), ...sortOrdinaryRows(ordinaryRows, ctx)];
}

function inactiveRenderContext(options: InactiveRenderOptions): InactiveRenderContext {
  return {
    searchOptions: {
      aliases: options.aliases,
      modByPackageId: options.modByPackageId,
    },
    search: options.search,
    catalogPackageIds: new Set(),
    sortKey: options.sortKey ?? 'name',
    sortDirection: options.sortDirection ?? 'asc',
  };
}

function inactiveEntryRenderRows(
  entry: ModListEntryDto,
  ctx: InactiveRenderContext,
): InactiveRenderRow[] {
  if (entry.kind === 'separator') return [];
  if (entry.kind === 'mod') {
    return inactiveModEntryRenderRows(entry, ctx);
  }
  return inactiveGroupRenderRows(entry, ctx);
}

function inactiveModEntryRenderRows(
  entry: Extract<ModListEntryDto, { kind: 'mod' }>,
  ctx: InactiveRenderContext,
): InactiveRenderRow[] {
  if (entry.active !== false) return [];
  const missing = !ctx.searchOptions.modByPackageId.has(entry.identity.packageId);
  if (!ctx.search.matchesIdentity(entry.identity)) return [];
  return [
    {
      kind: 'entry',
      id: entrySortableId(entry.id, 'inactive'),
      entry,
      entryId: entry.id,
      depth: 0,
      missing,
    },
  ];
}

function inactiveGroupRenderRows(
  entry: Extract<ModListEntryDto, { kind: 'group' }>,
  ctx: InactiveRenderContext,
): InactiveRenderRow[] {
  const children = inactiveGroupChildren(entry, ctx);
  if (children.length === 0) return [];
  return [
    {
      kind: 'entry',
      id: entrySortableId(entry.id, 'inactive'),
      entry,
      entryId: entry.id,
      depth: 0,
      missing: children.every(
        (child) => !ctx.searchOptions.modByPackageId.has(child.identity.packageId),
      ),
    },
    ...children.map((child) => ({
      kind: 'child' as const,
      id: childSortableId(entry.id, child.id, 'inactive'),
      groupId: entry.id,
      child,
      parent: entry,
      depth: 1 as const,
      missing: !ctx.searchOptions.modByPackageId.has(child.identity.packageId),
    })),
  ];
}

function inactiveGroupChildren(
  entry: Extract<ModListEntryDto, { kind: 'group' }>,
  ctx: InactiveRenderContext,
): ModListGroupChildDto[] {
  return entry.entries.filter((child) => {
    if (child.active !== false) return false;
    return ctx.search.matchesIdentity(child.identity, { groupName: entry.name });
  });
}

function structuredCatalogKeys(entries: ModListEntryDto[]): string[] {
  return entries.flatMap((entry) => {
    if (entry.kind === 'mod') {
      return [packageCatalogItemKey(entry.identity.packageId)];
    }
    if (entry.kind === 'group') {
      return entry.entries.map((child) => packageCatalogItemKey(child.identity.packageId));
    }
    return [];
  });
}
