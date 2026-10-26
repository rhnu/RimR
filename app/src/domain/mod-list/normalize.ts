import type { ModIdentityDto, ModListDto, ModListEntryDto } from '@/commands';
import { normalizePackageId } from '@/domain/mods/identity';

/** Projects the game order from the list's only ordering source. */
export function flattenModListEntries(entries: ModListEntryDto[]): string[] {
  return entries.flatMap((entry) => {
    if (entry.kind === 'mod') return entry.active !== false ? [entry.identity.packageId] : [];
    if (entry.kind === 'group')
      return entry.entries
        .filter((child) => child.active !== false)
        .map((child) => child.identity.packageId);
    return [];
  });
}

/** Keeps editor invariants without assigning or repairing entity identities. */
export function normalizeModList(modList: ModListDto): ModListDto {
  const seen = new Set<string>();
  const keep = (identity: ModIdentityDto): boolean => {
    const key = normalizePackageId(identity.packageId);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  const identity = (value: ModIdentityDto): ModIdentityDto => ({
    ...value,
    packageId: normalizePackageId(value.packageId),
  });
  const entries = modList.entries.flatMap((entry): ModListEntryDto[] => {
    if (entry.kind === 'separator') return [entry];
    if (entry.kind === 'mod')
      return keep(entry.identity)
        ? [{ ...entry, identity: identity(entry.identity), active: entry.active ?? true }]
        : [];
    return [
      {
        ...entry,
        entries: entry.entries
          .filter((child) => keep(child.identity))
          .map((child) => ({
            ...child,
            identity: identity(child.identity),
            active: child.active ?? true,
          })),
      },
    ];
  });
  return { ...modList, entries };
}

export function collectIdentityByPackage(entries: ModListEntryDto[]): Map<string, ModIdentityDto> {
  const identities = new Map<string, ModIdentityDto>();
  for (const entry of entries) {
    const candidates =
      entry.kind === 'mod'
        ? [entry.identity]
        : entry.kind === 'group'
          ? entry.entries.map((child) => child.identity)
          : [];
    for (const identity of candidates) {
      const key = normalizePackageId(identity.packageId);
      if (!identities.has(key)) identities.set(key, identity);
    }
  }
  return identities;
}

export function activeModsKey(activeMods: string[]): string {
  return JSON.stringify(activeMods.map(normalizePackageId));
}
