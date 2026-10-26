import type { ModListDto, ModListEntryDto, ModMetadataDto } from '@/commands';
import { clampIndex, moveByTarget, moveManyByTarget } from './dnd';
import { groupChild, groupChildFromEntry, modEntry, modEntryFromChild } from './entries';
import { isPackageAddressableMod } from './catalogItemKey';
import { normalizeModList } from './normalize';
import type { DropEdge, GroupEntry, ModEntry } from './types';

export function addMods(modList: ModListDto, mods: ModMetadataDto[], index: number): ModListDto {
  const structured = new Set(allStructuredPackages(modList.entries));
  const active = new Set(modList.activeMods);
  const additions = mods.filter((mod) => {
    if (!isPackageAddressableMod(mod)) return false;
    if (structured.has(mod.packageId) || active.has(mod.packageId)) return false;
    active.add(mod.packageId);
    return true;
  });
  if (additions.length === 0) {
    return modList;
  }
  const entries = [...modList.entries];
  entries.splice(clampIndex(index, entries.length), 0, ...additions.map(modEntry));
  return normalizeModList({ ...modList, entries });
}

export function addModsToGroup(
  modList: ModListDto,
  groupId: string,
  mods: ModMetadataDto[],
  index: number,
): ModListDto {
  const structured = new Set(allStructuredPackages(modList.entries));
  const active = new Set(modList.activeMods);
  const additions = mods.filter((mod) => {
    if (!isPackageAddressableMod(mod)) return false;
    if (structured.has(mod.packageId) || active.has(mod.packageId)) return false;
    active.add(mod.packageId);
    return true;
  });
  if (additions.length === 0) {
    return modList;
  }
  return updateGroup(modList, groupId, (group) => {
    const entries = [...group.entries];
    entries.splice(clampIndex(index, entries.length), 0, ...additions.map(groupChild));
    return { ...group, entries };
  });
}

export function removeEntries(modList: ModListDto, entryIds: string[]): ModListDto {
  const selected = new Set(entryIds);
  return normalizeModList({
    ...modList,
    entries: modList.entries.filter((entry) => !selected.has(entry.id)),
  });
}

export function removeGroupChild(
  modList: ModListDto,
  groupId: string,
  childId: string,
): ModListDto {
  return updateGroup(modList, groupId, (group) => ({
    ...group,
    entries: group.entries.filter((child) => child.id !== childId),
  }));
}

export function createGroupFromMods(
  modList: ModListDto,
  mods: ModMetadataDto[],
  groupId: string,
  name: string,
  index: number,
  active: boolean,
): ModListDto {
  const introduced = new Set(allStructuredPackages(modList.entries));
  const children = mods
    .filter((mod) => isPackageAddressableMod(mod) && !introduced.has(mod.packageId))
    .map((mod) => ({ ...groupChild(mod), active }));
  if (children.length === 0) {
    return modList;
  }
  const group: ModListEntryDto = {
    kind: 'group',
    id: groupId,
    name,
    collapsed: false,
    entries: children,
  };
  const entries = [...modList.entries];
  entries.splice(clampIndex(index, entries.length), 0, group);
  return normalizeModList({ ...modList, entries });
}

export function createGroup(
  modList: ModListDto,
  entryIds: string[],
  groupId: string,
  name: string,
): ModListDto {
  const selected = new Set(entryIds);
  const selectedEntries = modList.entries.filter(isSelectedMod(selected));
  if (selectedEntries.length === 0) {
    return modList;
  }
  const insertIndex = modList.entries.findIndex((entry) => selected.has(entry.id));
  const remaining = modList.entries.filter((entry) => !selected.has(entry.id));
  const group: ModListEntryDto = {
    kind: 'group',
    id: groupId,
    name,
    collapsed: false,
    entries: selectedEntries.map(groupChildFromEntry),
  };
  remaining.splice(clampIndex(insertIndex, remaining.length), 0, group);
  return normalizeModList({ ...modList, entries: remaining });
}

export function ungroup(modList: ModListDto, groupId: string): ModListDto {
  const entries: ModListEntryDto[] = [];
  for (const entry of modList.entries) {
    if (entry.kind === 'group' && entry.id === groupId) {
      entries.push(...entry.entries.map(modEntryFromChild));
    } else {
      entries.push(entry);
    }
  }
  return normalizeModList({ ...modList, entries });
}

export function moveEntry(
  modList: ModListDto,
  entryId: string,
  targetEntryId: string,
  edge: Exclude<DropEdge, 'inside'>,
): ModListDto {
  return normalizeModList({
    ...modList,
    entries: moveByTarget(modList.entries, entryId, targetEntryId, edge),
  });
}

export function moveEntries(
  modList: ModListDto,
  entryIds: string[],
  targetEntryId: string,
  edge: Exclude<DropEdge, 'inside'>,
): ModListDto {
  return normalizeModList({
    ...modList,
    entries: moveManyByTarget(modList.entries, entryIds, targetEntryId, edge),
  });
}

export function moveEntriesToGroup(
  modList: ModListDto,
  entryIds: string[],
  groupId: string,
  index: number,
): ModListDto {
  const selected = new Set(entryIds);
  if (selected.has(groupId)) {
    return modList;
  }
  const moving = modList.entries.filter(isSelectedMod(selected));
  if (moving.length === 0 || !targetGroupExists(modList.entries, groupId, selected)) {
    return modList;
  }
  const withoutMoving = modList.entries.filter((entry) => !selected.has(entry.id));
  return normalizeModList({
    ...modList,
    entries: withoutMoving.map((entry) => moveIntoMatchingGroup(entry, groupId, moving, index)),
  });
}

export function moveGroupChild(
  modList: ModListDto,
  groupId: string,
  childId: string,
  targetChildId: string,
  edge: Exclude<DropEdge, 'inside'>,
): ModListDto {
  return updateGroup(modList, groupId, (group) => ({
    ...group,
    entries: moveByTarget(group.entries, childId, targetChildId, edge),
  }));
}

export function renameGroup(modList: ModListDto, groupId: string, name: string): ModListDto {
  return normalizeModList({
    ...modList,
    entries: modList.entries.map((entry) =>
      entry.kind === 'group' && entry.id === groupId ? { ...entry, name } : entry,
    ),
  });
}

export function insertSeparator(
  modList: ModListDto,
  separator: ModListEntryDto,
  index: number,
): ModListDto {
  const entries = [...modList.entries];
  entries.splice(clampIndex(index, entries.length), 0, separator);
  return normalizeModList({ ...modList, entries });
}

export function renameSeparator(modList: ModListDto, entryId: string, title: string): ModListDto {
  return normalizeModList({
    ...modList,
    entries: modList.entries.map((entry) =>
      entry.kind === 'separator' && entry.id === entryId ? { ...entry, title } : entry,
    ),
  });
}

export function allStructuredPackages(entries: ModListEntryDto[]): string[] {
  return entries.flatMap((entry) => {
    if (entry.kind === 'mod') return [entry.identity.packageId];
    if (entry.kind === 'group') return entry.entries.map((child) => child.identity.packageId);
    return [];
  });
}

function updateGroup(
  modList: ModListDto,
  groupId: string,
  update: (group: GroupEntry) => GroupEntry,
): ModListDto {
  return normalizeModList({
    ...modList,
    entries: modList.entries.map((entry) =>
      entry.kind === 'group' && entry.id === groupId ? update(entry) : entry,
    ),
  });
}

function isSelectedMod(selected: Set<string>): (entry: ModListEntryDto) => entry is ModEntry {
  return (entry): entry is ModEntry => selected.has(entry.id) && entry.kind === 'mod';
}

function targetGroupExists(
  entries: ModListEntryDto[],
  groupId: string,
  selected: Set<string>,
): boolean {
  return entries.some(
    (entry) => entry.kind === 'group' && entry.id === groupId && !selected.has(entry.id),
  );
}

function moveIntoMatchingGroup(
  entry: ModListEntryDto,
  groupId: string,
  moving: ModEntry[],
  index: number,
): ModListEntryDto {
  if (entry.kind !== 'group' || entry.id !== groupId) {
    return entry;
  }
  const entries = [...entry.entries];
  entries.splice(clampIndex(index, entries.length), 0, ...moving.map(groupChildFromEntry));
  return { ...entry, entries };
}
