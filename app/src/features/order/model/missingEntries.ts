import type { ModListDto, ModListEntryDto, ModMetadataDto } from '@/commands';
import { normalizeModList } from './normalize';

export type MissingEntryClassification = {
  active: string[];
  inactive: string[];
};

export function classifyMissingEntries(
  modList: ModListDto,
  catalogMods: ModMetadataDto[],
): MissingEntryClassification {
  const installed = new Set(catalogMods.map((mod) => mod.packageId));
  const active: string[] = [];
  const inactive: string[] = [];
  for (const entry of modList.entries) {
    if (entry.kind === 'mod') {
      collectMissingPackage(
        entry.identity.packageId,
        installed,
        entry.active === false ? inactive : active,
      );
      continue;
    }
    if (entry.kind === 'group') {
      for (const child of entry.entries) {
        collectMissingPackage(
          child.identity.packageId,
          installed,
          child.active === false ? inactive : active,
        );
      }
    }
  }

  return { active, inactive };
}

export function removeMissingEntries(modList: ModListDto, packageIds: string[]): ModListDto {
  if (packageIds.length === 0) return modList;
  const missing = new Set(packageIds);
  const entries: ModListEntryDto[] = [];
  for (const entry of modList.entries) {
    if (entry.kind === 'mod') {
      if (!missing.has(entry.identity.packageId)) {
        entries.push(entry);
      }
      continue;
    }
    if (entry.kind === 'group') {
      entries.push({
        ...entry,
        entries: entry.entries.filter((child) => !missing.has(child.identity.packageId)),
      });
      continue;
    }
    entries.push(entry);
  }
  return normalizeModList({ ...modList, entries });
}

function collectMissingPackage(packageId: string, installed: Set<string>, active: string[]): void {
  if (installed.has(packageId)) return;
  if (!active.includes(packageId)) {
    active.push(packageId);
  }
}
