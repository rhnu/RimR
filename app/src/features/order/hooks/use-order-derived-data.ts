import type { OrderDerived } from '../context/workspace-types';
import { activeModsKey, flattenModListEntries } from '@/domain/mod-list/normalize';
import { primaryModsByPackageId } from '@/domain/mods/catalog';
import { useMemo } from 'react';
import type {
  DisplayAliasDto,
  LibraryDto,
  ModListDto,
  ModMetadataDto,
  CatalogSnapshotDto,
  ValidateOrderDto,
  ModTagBindingDto,
  TagDefDto,
} from '@/commands';
import {
  sortAvailableMods,
  type AvailableModSortKey,
  type SortDirection,
} from '@/domain/mods/available-mods';
import { diagnosticsByPackage, summarizeValidationReport } from '@/domain/diagnostics/validation';
import {
  buildActiveRenderRows,
  buildInactiveRenderRows,
  filterInactiveMods,
  type InactiveRenderRow,
} from '@/features/order/model';
import { catalogItemKey } from '@/domain/mods/catalog';
import { compileSmartModSearch } from '@/domain/mod-list/smart-search';
import { unintroducedMods } from '@/domain/mod-list/reducer';
import { resolveSourceKey } from '@/domain/mods/identity';

const EMPTY_ALIASES: DisplayAliasDto[] = [];
const EMPTY_TAG_DEFS: TagDefDto[] = [];
const EMPTY_MOD_TAGS: ModTagBindingDto[] = [];

type UseOrderDerivedDataParams = {
  scan: CatalogSnapshotDto | undefined;
  library: LibraryDto | undefined;
  draft: ModListDto | null;
  activeMods: string[];
  validationResult: ValidateOrderDto | null;
  inactiveSearch: string;
  activeSearch: string;
  availableSortKey: AvailableModSortKey;
  availableSortDirection: SortDirection;
};

export function useOrderDerivedData({
  scan,
  library,
  draft,
  activeMods,
  validationResult,
  inactiveSearch,
  activeSearch,
  availableSortKey,
  availableSortDirection,
}: UseOrderDerivedDataParams): OrderDerived {
  const mods = useMemo(() => scan?.catalog.mods ?? [], [scan]);
  const modByPackageId = useMemo(() => primaryModsByPackageId(mods), [mods]);
  const modByCatalogKey = useMemo(
    () => new Map(mods.map((mod) => [catalogItemKey(mod), mod])),
    [mods],
  );
  const aliases = library?.settings.aliases ?? EMPTY_ALIASES;
  const tagDefs = library?.settings.tagDefs ?? EMPTY_TAG_DEFS;
  const modTags = library?.settings.modTags ?? EMPTY_MOD_TAGS;
  const inactive = useInactiveMods({
    mods,
    draft,
    aliases,
    modTags,
    tagDefs,
    modByPackageId,
    inactiveSearch,
    availableSortKey,
    availableSortDirection,
  });
  const activeRows = useMemo(
    () =>
      buildActiveRenderRows(draft?.entries ?? [], {
        query: activeSearch,
        aliases,
        modByPackageId,
        modTags,
        tagDefs,
      }),
    [activeSearch, aliases, draft?.entries, modByPackageId, modTags, tagDefs],
  );
  const status = useOrderStatus(draft, activeMods, validationResult);
  const visibleActiveEntryIds = useMemo(() => visibleModEntryIds(activeRows), [activeRows]);
  const activeSourceKeys = useMemo(
    () => sourceKeysForRows(activeRows, modByPackageId),
    [activeRows, modByPackageId],
  );

  return useMemo(
    () => ({
      mods,
      modByPackageId,
      modByCatalogKey,
      sortedInactiveMods: inactive.sortedInactiveMods,
      inactiveRows: inactive.inactiveRows,
      activeRows,
      ...status,
      inactiveCatalogKeys: inactive.inactiveCatalogKeys,
      inactiveSourceKeys: inactive.inactiveSourceKeys,
      visibleActiveEntryIds,
      activeSourceKeys,
    }),
    [
      mods,
      modByPackageId,
      modByCatalogKey,
      inactive,
      status,
      activeRows,
      visibleActiveEntryIds,
      activeSourceKeys,
    ],
  );
}

type UseInactiveModsParams = {
  mods: ModMetadataDto[];
  draft: ModListDto | null;
  aliases: DisplayAliasDto[];
  modTags: ModTagBindingDto[];
  tagDefs: TagDefDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  inactiveSearch: string;
  availableSortKey: AvailableModSortKey;
  availableSortDirection: SortDirection;
};

function useInactiveMods({
  mods,
  draft,
  aliases,
  modTags,
  tagDefs,
  modByPackageId,
  inactiveSearch,
  availableSortKey,
  availableSortDirection,
}: UseInactiveModsParams): {
  sortedInactiveMods: ModMetadataDto[];
  inactiveRows: InactiveRenderRow[];
  inactiveCatalogKeys: string[];
  inactiveSourceKeys: (string | null | undefined)[];
} {
  const inactiveMods = useMemo(() => (draft ? unintroducedMods(mods, draft) : mods), [mods, draft]);
  const search = useMemo(
    () =>
      compileSmartModSearch(inactiveSearch, {
        aliases,
        modByPackageId,
        modTags,
        tagDefs,
      }),
    [aliases, inactiveSearch, modByPackageId, modTags, tagDefs],
  );
  const filteredInactiveMods = useMemo(
    () => filterInactiveMods(inactiveMods, search),
    [inactiveMods, search],
  );
  const sortedInactiveMods = useMemo(
    () => sortAvailableMods(filteredInactiveMods, availableSortKey, availableSortDirection),
    [availableSortDirection, availableSortKey, filteredInactiveMods],
  );
  const inactiveRows = useMemo(
    () =>
      buildInactiveRenderRows(draft?.entries ?? [], sortedInactiveMods, {
        search,
        aliases,
        modByPackageId,
        sortKey: availableSortKey,
        sortDirection: availableSortDirection,
      }),
    [
      aliases,
      draft?.entries,
      modByPackageId,
      sortedInactiveMods,
      search,
      availableSortKey,
      availableSortDirection,
    ],
  );
  const inactiveCatalogKeys = useMemo(
    () => sortedInactiveMods.map((candidate) => catalogItemKey(candidate)),
    [sortedInactiveMods],
  );
  const inactiveSourceKeys = useMemo(
    () => sortedInactiveMods.map((candidate) => candidate.sourceKey),
    [sortedInactiveMods],
  );
  return useMemo(
    () => ({
      sortedInactiveMods,
      inactiveRows,
      inactiveCatalogKeys,
      inactiveSourceKeys,
    }),
    [sortedInactiveMods, inactiveRows, inactiveCatalogKeys, inactiveSourceKeys],
  );
}

function validationDiagnostics(validationResult: ValidateOrderDto | null) {
  return validationResult
    ? [
        ...validationResult.report.errors,
        ...validationResult.report.warnings,
        ...validationResult.report.infos,
      ]
    : [];
}

function visibleModEntryIds(rows: ReturnType<typeof buildActiveRenderRows>): string[] {
  return rows.flatMap((row) =>
    row.kind === 'entry' && row.entry.kind === 'mod' ? [row.entryId] : [],
  );
}

/**
 * Source keys for the visible active rows, resolved against the live catalog.
 *
 * The identity stored on an entry keeps the source key it had when the mod was
 * added, which is wrong as soon as the mod moves between the Workshop and local
 * folders. Prefetching must follow where the mod is now.
 */
function sourceKeysForRows(
  rows: ReturnType<typeof buildActiveRenderRows>,
  modByPackageId: Map<string, ModMetadataDto>,
) {
  return rows.flatMap((row) => {
    if (row.kind === 'entry' && row.entry.kind === 'mod') {
      return [resolveSourceKey(row.entry.identity, modByPackageId)];
    }
    if (row.kind === 'child') return [resolveSourceKey(row.child.identity, modByPackageId)];
    return [];
  });
}

function useOrderStatus(
  draft: ModListDto | null,
  activeMods: string[],
  validationResult: ValidateOrderDto | null,
) {
  return useMemo(
    () => ({
      diagnosticsMap: diagnosticsByPackage(validationResult),
      validationSummary: summarizeValidationReport(validationResult),
      allDiagnostics: validationDiagnostics(validationResult),
      draftActiveModsKey: activeModsKey(draft ? flattenModListEntries(draft.entries) : []),
      gameActiveModsKey: activeModsKey(activeMods),
    }),
    [draft, activeMods, validationResult],
  );
}
