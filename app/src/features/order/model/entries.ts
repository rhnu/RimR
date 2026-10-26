import type { ModIdentityDto, ModListEntryDto, ModMetadataDto } from '@/commands';
import { stableToken } from './ids';
import type { GroupChild, ModEntry } from './types';

export function identityFromMod(mod: ModMetadataDto): ModIdentityDto {
  return {
    packageId: mod.packageId,
    sourceKind: mod.sourceKind,
    sourceKey: mod.sourceKey,
    steamAppId: mod.steamAppId,
  };
}

export function modEntry(mod: ModMetadataDto): ModListEntryDto {
  return {
    kind: 'mod',
    id: modEntryId(mod.packageId),
    active: true,
    identity: identityFromMod(mod),
  };
}

export function modEntryFromPackage(
  packageId: string,
  identityByPackage: Map<string, ModIdentityDto>,
  catalogByPackage: Map<string, ModMetadataDto>,
): ModListEntryDto {
  const mod = catalogByPackage.get(packageId);
  if (mod) {
    return modEntry(mod);
  }
  return {
    kind: 'mod',
    id: modEntryId(packageId),
    active: true,
    identity: identityByPackage.get(packageId) ?? { packageId },
  };
}

export function separatorEntry(
  id: string,
  title: string,
  note: string | null = null,
  color: string | null = null,
): ModListEntryDto {
  return { kind: 'separator', id, title, note, color };
}

export function groupChild(mod: ModMetadataDto): GroupChild {
  return {
    id: childEntryId(mod.packageId),
    active: true,
    identity: identityFromMod(mod),
  };
}

export function groupChildFromEntry(entry: ModEntry): GroupChild {
  return {
    id: entry.id.replace(/^mod-/, 'child-'),
    active: entry.active,
    identity: entry.identity,
  };
}

export function modEntryFromChild(child: GroupChild): ModEntry {
  return {
    kind: 'mod',
    id: child.id.replace(/^child-/, 'mod-'),
    active: child.active,
    identity: child.identity,
  };
}

function modEntryId(packageId: string): string {
  return `mod-${stableToken(packageId)}`;
}

function childEntryId(packageId: string): string {
  return `child-${stableToken(packageId)}`;
}
