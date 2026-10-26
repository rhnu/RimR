import type { ModListDto, ModListEntryDto, ModMetadataDto } from '@/commands';
import { buildOrderDiff } from './diff';
import { modEntryFromPackage } from './entries';
import { collectIdentityByPackage, flattenModListEntries, normalizeModList } from './normalize';
import type { GameSyncResult, GroupEntry, OrderStructureEvent, SeparatorEntry } from './types';

type SeparatorPlan = {
  separator: SeparatorEntry;
  anchorPackageId: string | null;
  edge: 'before' | 'after';
};

export function syncModListFromGame(
  modList: ModListDto,
  gameActiveMods: string[],
  catalogMods: ModMetadataDto[],
): GameSyncResult {
  const catalogByPackage = new Map(catalogMods.map((mod) => [mod.packageId, mod]));
  const identityByPackage = collectIdentityByPackage(modList.entries);
  const oldActiveMods = flattenModListEntries(modList.entries);
  const gameSet = new Set(gameActiveMods);
  const gameIndex = new Map(gameActiveMods.map((packageId, index) => [packageId, index]));
  const groups = planGroupPreservation(modList.entries, gameSet, gameIndex);
  const blocks = buildGameOrderBlocks(gameActiveMods, groups, identityByPackage, catalogByPackage);
  const entries = insertSeparatorsAroundBlocks(
    blocks,
    planSeparatorPlacement(modList.entries, gameIndex),
  );
  const next = normalizeModList({ ...modList, entries });
  const separatorMoves = movedSeparatorTitles(modList.entries, entries).map(
    (title): OrderStructureEvent => ({
      kind: 'separatorMoved',
      title,
    }),
  );
  const groupSplits = groups.splitGroups.map(
    (group): OrderStructureEvent => ({
      kind: 'groupSplit',
      groupName: group.name,
      packageIds: group.packageIds,
    }),
  );

  return {
    modList: next,
    diff: buildOrderDiff(oldActiveMods, next.activeMods, [...groupSplits, ...separatorMoves]),
  };
}

function planGroupPreservation(
  entries: ModListEntryDto[],
  gameSet: Set<string>,
  gameIndex: Map<string, number>,
) {
  const preserved = new Map<string, GroupEntry>();
  const packageToGroup = new Map<string, string>();
  const splitGroups: Array<{ name: string; packageIds: string[] }> = [];

  for (const entry of entries) {
    if (entry.kind !== 'group') continue;
    const remaining = sortedRemainingChildren(entry, gameSet, gameIndex);
    if (remaining.length === 0) {
      continue;
    }
    if (
      !indicesAreContiguous(remaining.map((child) => gameIndex.get(child.identity.packageId) ?? -1))
    ) {
      splitGroups.push({
        name: entry.name,
        packageIds: remaining.map((child) => child.identity.packageId),
      });
      continue;
    }
    const group = { ...entry, entries: remaining };
    preserved.set(entry.id, group);
    for (const child of remaining) {
      packageToGroup.set(child.identity.packageId, entry.id);
    }
  }

  return { preserved, packageToGroup, splitGroups };
}

function buildGameOrderBlocks(
  gameActiveMods: string[],
  groups: ReturnType<typeof planGroupPreservation>,
  identityByPackage: Parameters<typeof modEntryFromPackage>[1],
  catalogByPackage: Parameters<typeof modEntryFromPackage>[2],
): Array<{ entry: ModListEntryDto; packageIds: string[] }> {
  const blocks: Array<{ entry: ModListEntryDto; packageIds: string[] }> = [];
  const emittedGroups = new Set<string>();
  for (const packageId of gameActiveMods) {
    const groupId = groups.packageToGroup.get(packageId);
    if (groupId && !emittedGroups.has(groupId)) {
      const group = groups.preserved.get(groupId);
      if (group) {
        blocks.push({
          entry: group,
          packageIds: group.entries.map((child) => child.identity.packageId),
        });
        emittedGroups.add(groupId);
      }
      continue;
    }
    if (!groupId) {
      blocks.push({
        entry: modEntryFromPackage(packageId, identityByPackage, catalogByPackage),
        packageIds: [packageId],
      });
    }
  }
  return blocks;
}

function insertSeparatorsAroundBlocks(
  blocks: Array<{ entry: ModListEntryDto; packageIds: string[] }>,
  separatorPlans: SeparatorPlan[],
): ModListEntryDto[] {
  const inserted = new Set<string>();
  const entries: ModListEntryDto[] = [];
  for (const block of blocks) {
    insertAnchoredSeparators(entries, separatorPlans, inserted, block.packageIds, 'before');
    entries.push(block.entry);
    insertAnchoredSeparators(entries, separatorPlans, inserted, block.packageIds, 'after');
  }
  for (const plan of separatorPlans) {
    if (!inserted.has(plan.separator.id)) {
      entries.push(plan.separator);
      inserted.add(plan.separator.id);
    }
  }
  return entries;
}

function sortedRemainingChildren(
  group: GroupEntry,
  gameSet: Set<string>,
  gameIndex: Map<string, number>,
) {
  return group.entries
    .filter((child) => gameSet.has(child.identity.packageId))
    .map((child) => ({ ...child, active: true }))
    .sort(
      (a, b) =>
        (gameIndex.get(a.identity.packageId) ?? Number.MAX_SAFE_INTEGER) -
        (gameIndex.get(b.identity.packageId) ?? Number.MAX_SAFE_INTEGER),
    );
}

function indicesAreContiguous(indices: number[]): boolean {
  return Math.max(...indices) - Math.min(...indices) + 1 === indices.length;
}

function planSeparatorPlacement(
  entries: ModListEntryDto[],
  gameIndex: Map<string, number>,
): SeparatorPlan[] {
  const plans: SeparatorPlan[] = [];
  let previousPackageId: string | null = null;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.kind === 'separator') {
      plans.push(
        separatorPlan(entry, previousPackageId, firstPackageAfter(entries, index + 1), gameIndex),
      );
      continue;
    }
    previousPackageId = lastPackageInEntry(entry) ?? previousPackageId;
  }
  return plans;
}

function separatorPlan(
  separator: SeparatorEntry,
  previousPackageId: string | null,
  nextPackageId: string | null,
  gameIndex: Map<string, number>,
): SeparatorPlan {
  const previousIndex = previousPackageId == null ? undefined : gameIndex.get(previousPackageId);
  const nextIndex = nextPackageId == null ? undefined : gameIndex.get(nextPackageId);
  if (previousIndex != null && nextIndex != null) {
    return {
      separator,
      anchorPackageId: previousIndex <= nextIndex ? previousPackageId : nextPackageId,
      edge: 'after',
    };
  }
  if (previousIndex != null)
    return { separator, anchorPackageId: previousPackageId, edge: 'after' };
  if (nextIndex != null) return { separator, anchorPackageId: nextPackageId, edge: 'before' };
  return { separator, anchorPackageId: null, edge: 'after' };
}

function insertAnchoredSeparators(
  entries: ModListEntryDto[],
  plans: SeparatorPlan[],
  inserted: Set<string>,
  packageIds: string[],
  edge: 'before' | 'after',
): void {
  for (const plan of plans) {
    if (
      plan.edge === edge &&
      plan.anchorPackageId != null &&
      packageIds.includes(plan.anchorPackageId) &&
      !inserted.has(plan.separator.id)
    ) {
      entries.push(plan.separator);
      inserted.add(plan.separator.id);
    }
  }
}

function firstPackageAfter(entries: ModListEntryDto[], startIndex: number): string | null {
  for (const entry of entries.slice(startIndex)) {
    const first = firstPackageInEntry(entry);
    if (first) return first;
  }
  return null;
}

function firstPackageInEntry(entry: ModListEntryDto): string | null {
  if (entry.kind === 'mod') return entry.identity.packageId;
  if (entry.kind === 'group') return entry.entries[0]?.identity.packageId ?? null;
  return null;
}

function lastPackageInEntry(entry: ModListEntryDto): string | null {
  if (entry.kind === 'mod') return entry.identity.packageId;
  if (entry.kind === 'group') {
    return entry.entries[entry.entries.length - 1]?.identity.packageId ?? null;
  }
  return null;
}

function movedSeparatorTitles(
  previousEntries: ModListEntryDto[],
  nextEntries: ModListEntryDto[],
): string[] {
  return previousEntries
    .filter((entry): entry is SeparatorEntry => entry.kind === 'separator')
    .filter(
      (entry) =>
        previousEntries.findIndex((candidate) => candidate.id === entry.id) !==
        nextEntries.findIndex((candidate) => candidate.id === entry.id),
    )
    .map((entry) => entry.title);
}
