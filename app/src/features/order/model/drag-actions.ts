import type { ModListDto } from '@/commands';
import type { DropEdge, ModListAction } from '@/domain/mod-list/types';
import { entryIndex, parseDragTarget } from '@/features/order/dnd-ids';
import { computeDropIntent } from './dnd';
import { groupChildAt, type DragSource } from './drag-source';

export type DropIndicatorState = {
  targetId: string;
  edge: DropEdge;
};

export function sameDropIndicator(
  left: DropIndicatorState | null,
  right: DropIndicatorState | null,
): boolean {
  if (left === right) return true;
  return left?.targetId === right?.targetId && left?.edge === right?.edge;
}

type DropTarget = NonNullable<ReturnType<typeof resolveDropTarget>>;

function resolveDropTarget(modList: ModListDto, id: string) {
  const row = parseDragTarget(id);
  if (row?.kind === 'entry') {
    const index = entryIndex(modList, row.entryId);
    const entry = modList.entries[index];
    return entry ? { ...row, index, entry } : null;
  }
  if (row?.kind === 'child') {
    const child = groupChildAt(modList, row.groupId, row.childId);
    return child ? { ...row, index: child.index } : null;
  }
  return row;
}

function canInsertMods(source: DragSource): boolean {
  if (source.kind === 'catalog') return source.mods.length > 0;
  return (
    source.kind === 'entry' &&
    source.entries.length > 0 &&
    source.entries.every((entry) => entry.kind === 'mod')
  );
}

function receivingGroup(source: DragSource, target: DropTarget) {
  return target.kind === 'entry' &&
    target.side === 'active' &&
    target.entry.kind === 'group' &&
    canInsertMods(source)
    ? target.entry
    : null;
}

/** Interprets dnd-kit coordinates against the same rows and group rules as the resulting action. */
export function resolveDropIndicator(
  modList: ModListDto,
  source: DragSource | null,
  overId: string,
  rect: { top: number; height: number },
  pointerY: number,
): DropIndicatorState | null {
  const target = resolveDropTarget(modList, overId);
  if (
    !source ||
    source.id === overId ||
    !target ||
    (target.kind !== 'entry' && target.kind !== 'child')
  )
    return null;
  const edge = computeDropIntent(
    target.side,
    overId,
    rect,
    pointerY,
    receivingGroup(source, target) !== null,
  ).edge;
  return { targetId: overId, edge };
}

export function resolveDragAction(
  modList: ModListDto,
  source: DragSource | null,
  overId: string,
  dropIndicator: DropIndicatorState | null,
): ModListAction | null {
  if (!source || source.id === overId) return null;
  const target = resolveDropTarget(modList, overId);
  if (!target) return null;
  const edge = dropIndicator?.targetId === overId ? dropIndicator.edge : undefined;
  const appendIndex = modList.entries.length;
  if (source.kind === 'catalog') return catalogDrop(source, target, edge, appendIndex);
  if (source.kind === 'entry') return entryDrop(source, target, edge, appendIndex);
  return childDrop(source, target, edge, appendIndex);
}

function catalogDrop(
  source: Extract<DragSource, { kind: 'catalog' }>,
  target: DropTarget,
  edge: DropEdge | undefined,
  appendIndex: number,
): ModListAction | null {
  const { mods } = source;
  if (mods.length === 0) return null;
  if (
    (target.kind === 'panel' && target.side === 'active') ||
    (target.kind === 'entry' && target.side === 'inactive')
  )
    return { type: 'addMods', mods, index: appendIndex };
  if (target.side !== 'active') return null;
  if (target.kind === 'child') {
    return {
      type: 'addModsToGroup',
      groupId: target.groupId,
      mods,
      index: insertionIndex(target.index, edge),
    };
  }
  const group = edge === 'inside' ? receivingGroup(source, target) : null;
  if (group)
    return { type: 'addModsToGroup', groupId: group.id, mods, index: group.entries.length };
  if (target.kind === 'entry') {
    return { type: 'addMods', mods, index: insertionIndex(target.index, edge) };
  }
  return null;
}

function entryDrop(
  source: Extract<DragSource, { kind: 'entry' }>,
  target: DropTarget,
  edge: DropEdge | undefined,
  appendIndex: number,
): ModListAction | null {
  const entryIds = source.entries.map((entry) => entry.id);
  const activating = source.side === 'inactive';
  if (target.kind === 'panel') {
    if (activating && target.side === 'active') {
      return { type: 'moveEntriesToIndexAndSetActive', entryIds, index: appendIndex, active: true };
    }
    if (!activating && target.side === 'inactive') {
      return { type: 'setEntriesActive', entryIds, active: false };
    }
    return null;
  }
  if (target.side !== 'active') return null;
  if (target.kind === 'child') {
    return canInsertMods(source)
      ? moveIntoGroup(entryIds, target.groupId, insertionIndex(target.index, edge), activating)
      : null;
  }
  const group = edge === 'inside' ? receivingGroup(source, target) : null;
  if (group) return moveIntoGroup(entryIds, group.id, group.entries.length, activating);
  const targetEntryId = target.entryId;
  if (activating) {
    return {
      type: 'moveEntriesAndSetActive',
      entryIds,
      targetEntryId,
      edge: edge === 'after' ? 'after' : 'before',
      active: true,
    };
  }
  return {
    type: 'moveEntries',
    entryIds,
    targetEntryId,
    edge: reorderEdge(source.index, target.index, edge),
  };
}

function moveIntoGroup(
  entryIds: string[],
  groupId: string,
  index: number,
  activating: boolean,
): ModListAction {
  return activating
    ? { type: 'moveEntriesToGroupAndSetActive', entryIds, groupId, index, active: true }
    : { type: 'moveEntriesToGroup', entryIds, groupId, index };
}

function childDrop(
  source: Extract<DragSource, { kind: 'child' }>,
  target: DropTarget,
  edge: DropEdge | undefined,
  appendIndex: number,
): ModListAction | null {
  const { groupId, child } = source;
  if (source.side === 'inactive') {
    if (target.side !== 'active') return null;
    const activation = {
      type: 'setGroupChildrenActiveAndMoveGroup' as const,
      groupId,
      childIds: [child.id],
      active: true,
    };
    if (target.kind === 'panel') return { ...activation, index: appendIndex };
    return {
      ...activation,
      targetEntryId: target.kind === 'entry' ? target.entryId : target.groupId,
      edge: edge === 'after' ? 'after' : 'before',
    };
  }
  if (target.kind === 'panel' && target.side === 'inactive') {
    return { type: 'setGroupChildrenActive', groupId, childIds: [child.id], active: false };
  }
  if (target.kind !== 'child' || target.side !== 'active' || target.groupId !== groupId)
    return null;
  return {
    type: 'moveGroupChild',
    groupId,
    childId: child.id,
    targetChildId: target.childId,
    edge: reorderEdge(source.index, target.index, edge),
  };
}

function insertionIndex(index: number, edge: DropEdge | undefined): number {
  return edge === 'after' ? index + 1 : index;
}

function reorderEdge(from: number, to: number, edge: DropEdge | undefined): 'before' | 'after' {
  return edge && edge !== 'inside' ? edge : from < to ? 'after' : 'before';
}
