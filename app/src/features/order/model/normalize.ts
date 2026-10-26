import type { ModIdentityDto, ModListDto, ModListEntryDto } from '@/commands';
import type { GroupChild, GroupEntry, ModEntry, SeparatorEntry } from './types';

export function flattenModListEntries(entries: ModListEntryDto[]): string[] {
  const packages: string[] = [];
  for (const entry of entries) {
    if (entry.kind === 'mod' && entry.active !== false) {
      packages.push(entry.identity.packageId);
    } else if (entry.kind === 'group') {
      packages.push(
        ...entry.entries
          .filter((child) => child.active !== false)
          .map((child) => child.identity.packageId),
      );
    }
  }
  return packages;
}

export function normalizeModList(modList: ModListDto): ModListDto {
  const seenPackages = new Set<string>();
  const seenEntryIds = new Set<string>();
  const seenChildIds = new Set<string>();
  const entries: ModListEntryDto[] = [];

  for (const entry of modList.entries) {
    const normalized = normalizeEntry(entry, seenPackages, seenEntryIds, seenChildIds);
    if (normalized) {
      entries.push(normalized);
    }
  }

  return {
    ...modList,
    entries,
    activeMods: flattenModListEntries(entries),
  };
}

export function collectIdentityByPackage(entries: ModListEntryDto[]): Map<string, ModIdentityDto> {
  const identities = new Map<string, ModIdentityDto>();
  for (const entry of entries) {
    if (entry.kind === 'mod') {
      storeIdentity(identities, entry.identity);
    } else if (entry.kind === 'group') {
      for (const child of entry.entries) {
        storeIdentity(identities, child.identity);
      }
    }
  }
  return identities;
}

function normalizeEntry(
  entry: ModListEntryDto,
  packages: Set<string>,
  entryIds: Set<string>,
  childIds: Set<string>,
): ModListEntryDto | null {
  if (entry.kind === 'mod') {
    return normalizeModEntry(entry, packages, entryIds);
  }
  if (entry.kind === 'group') {
    return normalizeGroupEntry(entry, packages, entryIds, childIds);
  }
  return normalizeSeparatorEntry(entry, entryIds);
}

function normalizeModEntry(
  entry: ModEntry,
  packages: Set<string>,
  entryIds: Set<string>,
): ModEntry | null {
  if (packages.has(entry.identity.packageId)) {
    return null;
  }
  packages.add(entry.identity.packageId);
  return { ...entry, active: entry.active ?? true, id: uniqueId(entry.id, entryIds) };
}

function normalizeGroupEntry(
  entry: GroupEntry,
  packages: Set<string>,
  entryIds: Set<string>,
  childIds: Set<string>,
): GroupEntry | null {
  const children: GroupChild[] = [];
  for (const child of entry.entries) {
    if (packages.has(child.identity.packageId)) {
      continue;
    }
    packages.add(child.identity.packageId);
    children.push({ ...child, active: child.active ?? true, id: uniqueId(child.id, childIds) });
  }
  return { ...entry, id: uniqueId(entry.id, entryIds), entries: children };
}

function normalizeSeparatorEntry(entry: SeparatorEntry, entryIds: Set<string>): SeparatorEntry {
  return { ...entry, id: uniqueId(entry.id, entryIds) };
}

function uniqueId(id: string, seen: Set<string>): string {
  if (!seen.has(id)) {
    seen.add(id);
    return id;
  }

  let suffix = 2;
  let next = `${id}-${suffix}`;
  while (seen.has(next)) {
    suffix += 1;
    next = `${id}-${suffix}`;
  }
  seen.add(next);
  return next;
}

function storeIdentity(map: Map<string, ModIdentityDto>, identity: ModIdentityDto): void {
  if (!map.has(identity.packageId)) {
    map.set(identity.packageId, identity);
  }
}
