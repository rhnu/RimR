import type { ModIdentityDto, ModListEntryDto, ModMetadataDto } from '@/commands';
import { identityForMod, normalizePackageId } from '@/domain/mods/identity';
import { createEntryId } from './ids';
import type { EntryIdGenerator, GroupChild, ModEntry } from './types';

export function modEntry(
  mod: ModMetadataDto,
  generate: EntryIdGenerator = createEntryId,
): ModEntry {
  return { kind: 'mod', id: generate(), active: true, identity: identityForMod(mod) };
}

export function modEntryFromPackage(
  packageId: string,
  identityByPackage: Map<string, ModIdentityDto>,
  catalogByPackage: Map<string, ModMetadataDto>,
  generate: EntryIdGenerator = createEntryId,
): ModEntry {
  const key = normalizePackageId(packageId);
  const mod = catalogByPackage.get(key);
  return mod
    ? modEntry(mod, generate)
    : {
        kind: 'mod',
        id: generate(),
        active: true,
        identity: identityByPackage.get(key) ?? { packageId: key },
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

export function groupChild(
  mod: ModMetadataDto,
  generate: EntryIdGenerator = createEntryId,
): GroupChild {
  return { id: generate(), active: true, identity: identityForMod(mod) };
}

export function groupChildFromEntry(entry: ModEntry): GroupChild {
  return { id: entry.id, active: entry.active, identity: entry.identity };
}

export function modEntryFromChild(child: GroupChild): ModEntry {
  return { kind: 'mod', id: child.id, active: child.active, identity: child.identity };
}
