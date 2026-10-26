import { createEntryId } from './ids';
import { normalizePackageId } from '@/domain/mods/identity';
import type { ModListDto, ModMetadataDto } from '@/commands';
import { normalizeModList } from '@/domain/mod-list/normalize';
import {
  moveEntriesAndSetActive,
  moveEntriesToIndexAndSetActive,
  moveEntriesToGroupAndSetActive,
  setEntriesActive,
  setGroupChildrenActiveAndMoveGroup,
  setGroupChildrenActive,
} from '@/domain/mod-list/reducer-active-operations';
import {
  addMods,
  addModsToGroup,
  createGroup,
  createGroupFromMods,
  insertSeparator,
  moveEntries,
  moveEntriesToGroup,
  moveEntry,
  moveGroupChild,
  removeEntries,
  removeGroupChild,
  renameGroup,
  renameSeparator,
  ungroup,
} from '@/domain/mod-list/reducer-operations';
import type { EntryIdGenerator, ModListAction } from '@/domain/mod-list/types';

export { classifyMissingEntries, removeMissingEntries } from '@/domain/mod-list/missing-entries';

type ActiveStateAction = Extract<
  ModListAction,
  {
    type:
      | 'setEntryActive'
      | 'setEntriesActive'
      | 'setGroupChildrenActive'
      | 'moveEntriesAndSetActive'
      | 'moveEntriesToIndexAndSetActive'
      | 'moveEntriesToGroupAndSetActive'
      | 'setGroupChildrenActiveAndMoveGroup';
  }
>;

export function unintroducedMods(mods: ModMetadataDto[], modList: ModListDto): ModMetadataDto[] {
  const introduced = new Set(
    packagesUnavailableForInactiveCatalog(modList.entries).map(normalizePackageId),
  );
  return mods.filter((mod) => !introduced.has(normalizePackageId(mod.packageId)));
}

function packagesUnavailableForInactiveCatalog(entries: ModListDto['entries']): string[] {
  return entries.flatMap((entry) => {
    if (entry.kind === 'mod') return [entry.identity.packageId];
    if (entry.kind === 'group') return entry.entries.map((child) => child.identity.packageId);
    return [];
  });
}

export function modListReducer(
  modList: ModListDto,
  action: ModListAction,
  generate: EntryIdGenerator = createEntryId,
): ModListDto {
  if (isActiveStateAction(action)) {
    return reduceActiveStateAction(modList, action);
  }

  switch (action.type) {
    case 'replace':
      return normalizeModList(action.modList);
    case 'addMod':
      return addMods(modList, [action.mod], action.index, generate);
    case 'addMods':
      return addMods(modList, action.mods, action.index, generate);
    case 'addModToGroup':
      return addModsToGroup(modList, action.groupId, [action.mod], action.index, generate);
    case 'addModsToGroup':
      return addModsToGroup(modList, action.groupId, action.mods, action.index, generate);
    case 'removeEntry':
      return removeEntries(modList, [action.entryId]);
    case 'removeEntries':
      return removeEntries(modList, action.entryIds);
    case 'removeGroupChild':
      return removeGroupChild(modList, action.groupId, action.childId);
    case 'moveEntry':
      return moveEntry(modList, action.entryId, action.targetEntryId, action.edge);
    case 'moveEntries':
      return moveEntries(modList, action.entryIds, action.targetEntryId, action.edge);
    case 'moveEntriesToGroup':
      return moveEntriesToGroup(modList, action.entryIds, action.groupId, action.index);
    case 'moveGroupChild':
      return moveGroupChild(
        modList,
        action.groupId,
        action.childId,
        action.targetChildId,
        action.edge,
      );
    case 'createGroup':
      return createGroup(modList, action.entryIds, action.groupId, action.name);
    case 'createGroupFromMods':
      return createGroupFromMods(
        modList,
        action.mods,
        action.groupId,
        action.name,
        action.index,
        action.active ?? true,
        generate,
      );
    case 'renameGroup':
      return renameGroup(modList, action.groupId, action.name);
    case 'ungroup':
      return ungroup(modList, action.groupId);
    case 'insertSeparator':
      return insertSeparator(modList, action.separator, action.index);
    case 'renameSeparator':
      return renameSeparator(modList, action.entryId, action.title);
  }
}

function isActiveStateAction(action: ModListAction): action is ActiveStateAction {
  return (
    action.type === 'setEntryActive' ||
    action.type === 'setEntriesActive' ||
    action.type === 'setGroupChildrenActive' ||
    action.type === 'moveEntriesAndSetActive' ||
    action.type === 'moveEntriesToIndexAndSetActive' ||
    action.type === 'moveEntriesToGroupAndSetActive' ||
    action.type === 'setGroupChildrenActiveAndMoveGroup'
  );
}

function reduceActiveStateAction(modList: ModListDto, action: ActiveStateAction): ModListDto {
  switch (action.type) {
    case 'setEntryActive':
      return setEntriesActive(modList, [action.entryId], action.active);
    case 'setEntriesActive':
      return setEntriesActive(modList, action.entryIds, action.active);
    case 'setGroupChildrenActive':
      return setGroupChildrenActive(modList, action.groupId, action.childIds, action.active);
    case 'moveEntriesAndSetActive':
      return moveEntriesAndSetActive(
        modList,
        action.entryIds,
        action.targetEntryId,
        action.edge,
        action.active,
      );
    case 'moveEntriesToIndexAndSetActive':
      return moveEntriesToIndexAndSetActive(modList, action.entryIds, action.index, action.active);
    case 'moveEntriesToGroupAndSetActive':
      return moveEntriesToGroupAndSetActive(
        modList,
        action.entryIds,
        action.groupId,
        action.index,
        action.active,
      );
    case 'setGroupChildrenActiveAndMoveGroup':
      return setGroupChildrenActiveAndMoveGroup(
        modList,
        action.groupId,
        action.childIds,
        action.active,
        {
          index: action.index,
          targetEntryId: action.targetEntryId,
          edge: action.edge,
        },
      );
  }
}
