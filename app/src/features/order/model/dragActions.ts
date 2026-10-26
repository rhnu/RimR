import type { ModListDto, ModListEntryDto, ModMetadataDto } from '@/commands';
import {
  childIndex,
  dragEdgeByIndex,
  entryIndex,
  parseCatalogId,
  parseChildId,
  parseEntryId,
} from '@/features/order/dndIds';
import {
  resolveInactiveChildDropAction,
  resolveInactiveEntryDropOnEntry,
} from './dragInactiveActions';
import { isPackageAddressableMod } from './catalogItemKey';
import type { DropEdge, ModListAction } from './types';

export type DropIndicatorState = {
  targetId: string;
  edge: DropEdge;
};

export function sameDropIndicator(
  left: DropIndicatorState | null,
  right: DropIndicatorState | null,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.targetId === right.targetId && left.edge === right.edge;
}

export type ResolveDragActionInput = {
  activeId: string;
  overId: string;
  modList: ModListDto;
  modByPackageId: Map<string, ModMetadataDto>;
  modByCatalogKey: Map<string, ModMetadataDto>;
  selectedInactivePackageIds: Set<string>;
  inactivePackageIds: string[];
  selectedEntryIds: Set<string>;
  visibleActiveEntryIds: string[];
  dropIndicator: DropIndicatorState | null;
};

export function resolveDragAction(input: ResolveDragActionInput): ModListAction | null {
  if (input.activeId === input.overId) {
    return null;
  }
  if (parseCatalogId(input.activeId)) return resolveCatalogDrag(input);
  const activeEntry = parseEntryId(input.activeId);
  if (activeEntry) return resolveEntryDrag(input);
  const activeChild = parseChildId(input.activeId);
  if (activeChild) return resolveChildDrag(input);
  return null;
}

export function entryById(modList: ModListDto, entryId: string): ModListEntryDto | undefined {
  return modList.entries.find((entry) => entry.id === entryId);
}

export function orderedSelectedDragIds(
  grabbedId: string,
  selected: Set<string>,
  orderedIds: string[],
): string[] {
  if (!selected.has(grabbedId)) {
    return [grabbedId];
  }
  const ordered = orderedIds.filter((id) => selected.has(id));
  return ordered.length > 0 ? ordered : [grabbedId];
}

function resolveCatalogDrag(input: ResolveDragActionInput): ModListAction | null {
  const catalogId = parseCatalogId(input.activeId);
  if (!catalogId) return null;
  const itemKey = catalogId.catalogKey;
  const itemKeys = orderedSelectedDragIds(
    itemKey,
    input.selectedInactivePackageIds,
    input.inactivePackageIds,
  );
  const mods = itemKeys
    .map((id) => input.modByCatalogKey.get(id))
    .filter((mod): mod is ModMetadataDto => mod != null && isPackageAddressableMod(mod));
  if (mods.length === 0) return null;
  return catalogDropAction(input, mods);
}

function catalogDropAction(
  input: ResolveDragActionInput,
  mods: ModMetadataDto[],
): ModListAction | null {
  if (input.overId === 'active-drop') {
    return { type: 'addMods', mods, index: input.modList.entries.length };
  }
  const entry = parseEntryId(input.overId);
  if (entry?.side === 'active') {
    return catalogDropOnEntry(input, mods, entry.entryId);
  }
  const child = parseChildId(input.overId);
  if (child?.side === 'active') {
    return {
      type: 'addModsToGroup',
      groupId: child.groupId,
      mods,
      index: childIndexWithEdge(input.modList, child.groupId, child.childId, input.dropIndicator),
    };
  }
  if (entry?.side === 'inactive') {
    return { type: 'addMods', mods, index: input.modList.entries.length };
  }
  return null;
}

function catalogDropOnEntry(
  input: ResolveDragActionInput,
  mods: ModMetadataDto[],
  targetId: string,
): ModListAction | null {
  const targetEntry = entryById(input.modList, targetId);
  if (targetEntry?.kind === 'group' && input.dropIndicator?.edge === 'inside') {
    return { type: 'addModsToGroup', groupId: targetId, mods, index: targetEntry.entries.length };
  }
  return {
    type: 'addMods',
    mods,
    index: entryIndexWithEdge(input.modList, targetId, input.dropIndicator, input.overId),
  };
}

function resolveEntryDrag(input: ResolveDragActionInput): ModListAction | null {
  const active = parseEntryId(input.activeId);
  if (!active) return null;
  const entryId = active.entryId;
  const entryIds =
    active.side === 'active'
      ? orderedSelectedDragIds(entryId, input.selectedEntryIds, input.visibleActiveEntryIds)
      : [entryId];
  if (active.side === 'active' && input.overId === 'inactive-drop') {
    return { type: 'setEntriesActive', entryIds, active: false };
  }
  if (active.side === 'inactive' && input.overId === 'active-drop') {
    return {
      type: 'moveEntriesToIndexAndSetActive',
      entryIds,
      index: input.modList.entries.length,
      active: true,
    };
  }
  const overEntry = parseEntryId(input.overId);
  if (overEntry) {
    return entryDropOnEntry(input, active, entryIds, overEntry);
  }
  const overChild = parseChildId(input.overId);
  if (overChild) {
    return entryDropOnChild(input, active, entryIds, overChild);
  }
  return null;
}

function entryDropOnEntry(
  input: ResolveDragActionInput,
  active: { side: 'active' | 'inactive'; entryId: string },
  entryIds: string[],
  over: { side: 'active' | 'inactive'; entryId: string },
): ModListAction | null {
  if (over.side !== 'active') return null;
  if (active.side === 'inactive') {
    return resolveInactiveEntryDropOnEntry(input, entryIds, over.entryId);
  }
  const targetEntry = entryById(input.modList, over.entryId);
  const movingEntries = entriesByIds(input.modList, entryIds);
  if (canDropInsideGroup(targetEntry, input.dropIndicator, movingEntries)) {
    return {
      type: 'moveEntriesToGroup',
      entryIds,
      groupId: over.entryId,
      index: targetEntry.entries.length,
    };
  }
  return {
    type: 'moveEntries',
    entryIds,
    targetEntryId: over.entryId,
    edge: entryEdge(input.modList, active.entryId, over.entryId, input.dropIndicator, input.overId),
  };
}

function entryDropOnChild(
  input: ResolveDragActionInput,
  active: { side: 'active' | 'inactive'; entryId: string },
  entryIds: string[],
  over: { side: 'active' | 'inactive'; groupId: string; childId: string },
): ModListAction | null {
  const movingEntries = entriesByIds(input.modList, entryIds);
  if (over.side !== 'active' || !allMods(movingEntries)) return null;
  if (active.side === 'inactive') {
    return {
      type: 'moveEntriesToGroupAndSetActive',
      entryIds,
      groupId: over.groupId,
      index: childIndexWithEdge(input.modList, over.groupId, over.childId, input.dropIndicator),
      active: true,
    };
  }
  return {
    type: 'moveEntriesToGroup',
    entryIds,
    groupId: over.groupId,
    index: childIndexWithEdge(input.modList, over.groupId, over.childId, input.dropIndicator),
  };
}

function resolveChildDrag(input: ResolveDragActionInput): ModListAction | null {
  const active = parseChildId(input.activeId);
  if (!active) return null;
  if (active.side === 'active' && input.overId === 'inactive-drop') {
    return {
      type: 'setGroupChildrenActive',
      groupId: active.groupId,
      childIds: [active.childId],
      active: false,
    };
  }
  if (active.side === 'inactive') {
    return resolveInactiveChildDropAction(input, active);
  }
  const over = parseChildId(input.overId);
  if (!over || active.groupId !== over.groupId || active.side !== over.side) {
    return null;
  }
  return {
    type: 'moveGroupChild',
    groupId: active.groupId,
    childId: active.childId,
    targetChildId: over.childId,
    edge: childEdge(input.modList, active, over, input.dropIndicator, input.overId),
  };
}

function entriesByIds(modList: ModListDto, entryIds: string[]): ModListEntryDto[] {
  const selected = new Set(entryIds);
  return modList.entries.filter((entry) => selected.has(entry.id));
}

function canDropInsideGroup(
  entry: ModListEntryDto | undefined,
  indicator: DropIndicatorState | null,
  movingEntries: ModListEntryDto[],
): entry is Extract<ModListEntryDto, { kind: 'group' }> {
  return entry?.kind === 'group' && indicator?.edge === 'inside' && allMods(movingEntries);
}

function allMods(entries: ModListEntryDto[]): boolean {
  return entries.every((entry) => entry.kind === 'mod');
}

function entryIndexWithEdge(
  modList: ModListDto,
  entryId: string,
  indicator: DropIndicatorState | null,
  overId: string,
): number {
  const index = entryIndex(modList, entryId);
  return indicator?.targetId === overId && indicator.edge === 'after' ? index + 1 : index;
}

function childIndexWithEdge(
  modList: ModListDto,
  groupId: string,
  childId: string,
  indicator: DropIndicatorState | null,
): number {
  const index = childIndex(modList, groupId, childId);
  return indicator?.edge === 'after' ? index + 1 : index;
}

function entryEdge(
  modList: ModListDto,
  entryId: string,
  targetEntryId: string,
  indicator: DropIndicatorState | null,
  overId: string,
): 'before' | 'after' {
  if (indicator?.targetId === overId && indicator.edge !== 'inside') {
    return indicator.edge;
  }
  return dragEdgeByIndex(entryIndex(modList, entryId), entryIndex(modList, targetEntryId));
}

function childEdge(
  modList: ModListDto,
  active: { groupId: string; childId: string },
  over: { groupId: string; childId: string },
  indicator: DropIndicatorState | null,
  overId: string,
): 'before' | 'after' {
  if (indicator?.targetId === overId && indicator.edge !== 'inside') {
    return indicator.edge;
  }
  return dragEdgeByIndex(
    childIndex(modList, active.groupId, active.childId),
    childIndex(modList, over.groupId, over.childId),
  );
}
