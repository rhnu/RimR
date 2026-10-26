import type { ModListDto, ModListEntryDto } from '@/commands';
import { clampIndex, moveManyByTarget } from './dnd';
import { groupChildFromEntry } from './entries';
import { normalizeModList } from './normalize';
import type { DropEdge, GroupEntry } from './types';

export function setEntriesActive(
  modList: ModListDto,
  entryIds: string[],
  active: boolean,
): ModListDto {
  const selected = new Set(entryIds);
  return normalizeModList({
    ...modList,
    entries: modList.entries.map((entry) =>
      selected.has(entry.id) ? setEntryActive(entry, active) : entry,
    ),
  });
}

export function moveEntriesAndSetActive(
  modList: ModListDto,
  entryIds: string[],
  targetEntryId: string,
  edge: Exclude<DropEdge, 'inside'>,
  active: boolean,
): ModListDto {
  if (!active) return setEntriesActive(modList, entryIds, false);
  const activated = entriesWithActiveState(modList.entries, new Set(entryIds), true);
  return normalizeModList({
    ...modList,
    entries: moveManyByTarget(activated, entryIds, targetEntryId, edge),
  });
}

export function moveEntriesToIndexAndSetActive(
  modList: ModListDto,
  entryIds: string[],
  index: number,
  active: boolean,
): ModListDto {
  const selected = new Set(entryIds);
  const entries = entriesWithActiveState(modList.entries, selected, active);
  return normalizeModList({
    ...modList,
    entries: moveManyToIndex(entries, entryIds, index),
  });
}

export function moveEntriesToGroupAndSetActive(
  modList: ModListDto,
  entryIds: string[],
  groupId: string,
  index: number,
  active: boolean,
): ModListDto {
  if (!active) return setEntriesActive(modList, entryIds, false);
  const selected = new Set(entryIds);
  if (selected.has(groupId)) return modList;
  const moving = modList.entries
    .filter(
      (entry): entry is Extract<ModListEntryDto, { kind: 'mod' }> =>
        selected.has(entry.id) && entry.kind === 'mod',
    )
    .map((entry) => ({ ...groupChildFromEntry(entry), active: true }));
  if (moving.length === 0) return modList;
  const withoutMoving = modList.entries.filter((entry) => !selected.has(entry.id));
  return normalizeModList({
    ...modList,
    entries: withoutMoving.map((entry) => {
      if (entry.kind !== 'group' || entry.id !== groupId) return entry;
      const entries = [...entry.entries];
      entries.splice(Math.min(Math.max(index, 0), entries.length), 0, ...moving);
      return { ...entry, entries };
    }),
  });
}

export function setGroupChildrenActive(
  modList: ModListDto,
  groupId: string,
  childIds: string[],
  active: boolean,
): ModListDto {
  const selected = new Set(childIds);
  return updateGroup(modList, groupId, (group) => ({
    ...group,
    entries: group.entries.map((child) => (selected.has(child.id) ? { ...child, active } : child)),
  }));
}

export function setGroupChildrenActiveAndMoveGroup(
  modList: ModListDto,
  groupId: string,
  childIds: string[],
  active: boolean,
  target: { index?: number; targetEntryId?: string; edge?: Exclude<DropEdge, 'inside'> },
): ModListDto {
  const group = modList.entries.find(
    (entry): entry is GroupEntry => entry.kind === 'group' && entry.id === groupId,
  );
  const wasInactive = group ? group.entries.every((child) => !child.active) : false;
  const updated = setGroupChildrenActive(modList, groupId, childIds, active);
  if (!active || !wasInactive) return updated;
  if (target.targetEntryId && target.edge) {
    return normalizeModList({
      ...updated,
      entries: moveManyByTarget(updated.entries, [groupId], target.targetEntryId, target.edge),
    });
  }
  if (target.index == null) return updated;
  return normalizeModList({
    ...updated,
    entries: moveManyToIndex(updated.entries, [groupId], target.index),
  });
}

function entriesWithActiveState(
  entries: ModListEntryDto[],
  selected: Set<string>,
  active: boolean,
): ModListEntryDto[] {
  return entries.map((entry) => (selected.has(entry.id) ? setEntryActive(entry, active) : entry));
}

function setEntryActive(entry: ModListEntryDto, active: boolean): ModListEntryDto {
  if (entry.kind === 'mod') return { ...entry, active };
  if (entry.kind === 'group') {
    return {
      ...entry,
      entries: entry.entries.map((child) => ({ ...child, active })),
    };
  }
  return entry;
}

function moveManyToIndex<T extends { id: string }>(
  items: T[],
  itemIds: string[],
  index: number,
): T[] {
  const selected = new Set(itemIds);
  const moving = items.filter((entry) => selected.has(entry.id));
  if (moving.length === 0) return items;
  const withoutMoving = items.filter((entry) => !selected.has(entry.id));
  const insertIndex = clampIndex(index, withoutMoving.length);
  return [...withoutMoving.slice(0, insertIndex), ...moving, ...withoutMoving.slice(insertIndex)];
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
