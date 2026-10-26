import type { ModListDto, ModListEntryDto } from '@/commands';
import type { DropEdge, ModListAction } from './types';
import type { DropIndicatorState, ResolveDragActionInput } from './dragActions';

export function resolveInactiveEntryDropOnEntry(
  input: ResolveDragActionInput,
  entryIds: string[],
  targetEntryId: string,
): ModListAction | null {
  const targetEntry = entryById(input.modList, targetEntryId);
  const movingEntries = entriesByIds(input.modList, entryIds);
  if (canDropInsideGroup(targetEntry, input.dropIndicator, movingEntries)) {
    return {
      type: 'moveEntriesToGroupAndSetActive',
      entryIds,
      groupId: targetEntryId,
      index: targetEntry.entries.length,
      active: true,
    };
  }
  return {
    type: 'moveEntriesAndSetActive',
    entryIds,
    targetEntryId,
    edge: activeTargetEdge(input.dropIndicator),
    active: true,
  };
}

export function resolveInactiveChildDropAction(
  input: ResolveDragActionInput,
  child: { groupId: string; childId: string },
): ModListAction | null {
  if (input.overId === 'active-drop') {
    return {
      type: 'setGroupChildrenActiveAndMoveGroup',
      groupId: child.groupId,
      childIds: [child.childId],
      active: true,
      index: input.modList.entries.length,
    };
  }
  const target = activeChildTarget(input);
  if (!target) return null;
  return {
    type: 'setGroupChildrenActiveAndMoveGroup',
    groupId: child.groupId,
    childIds: [child.childId],
    active: true,
    targetEntryId: target.entryId,
    edge: activeTargetEdge(input.dropIndicator),
  };
}

function activeChildTarget(input: ResolveDragActionInput): { entryId: string } | null {
  const entry = parseActiveEntryId(input.overId);
  if (entry) return entry;
  const child = parseActiveChildId(input.overId);
  return child ? { entryId: child.groupId } : null;
}

function parseActiveEntryId(id: string): { entryId: string } | null {
  const parts = id.split(':');
  if (parts.length < 3 || parts[0] !== 'active' || parts[1] !== 'entry') return null;
  return { entryId: parts.slice(2).join(':') };
}

function parseActiveChildId(id: string): { groupId: string; childId: string } | null {
  const parts = id.split(':');
  if (parts.length < 4 || parts[0] !== 'active' || parts[1] !== 'child') return null;
  return { groupId: parts[2], childId: parts.slice(3).join(':') };
}

function entryById(modList: ModListDto, entryId: string): ModListEntryDto | undefined {
  return modList.entries.find((entry) => entry.id === entryId);
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

function activeTargetEdge(indicator: DropIndicatorState | null): Exclude<DropEdge, 'inside'> {
  return indicator?.edge === 'after' ? 'after' : 'before';
}
