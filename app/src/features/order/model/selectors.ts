import type {
  DisplayAliasDto,
  ModMetadataDto,
  ModListEntryDto,
  ModListGroupChildDto,
  ModTagBindingDto,
  TagDefDto,
} from '@/commands';
import { childSortableId, entrySortableId } from '@/features/order/dndIds';
import { compileSmartModSearch, type CompiledSmartSearch } from './smartSearch';

export {
  buildInactiveRenderRows,
  filterInactiveMods,
  type InactiveRenderRow,
} from './inactiveSelectors';

export type SelectionClickModifiers = {
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
};

export type SelectionUpdate = {
  selected: Set<string>;
  anchorId: string;
};

export type ActiveRenderRow =
  | {
      kind: 'entry';
      id: string;
      entry: ModListEntryDto;
      entryId: string;
      depth: 0;
    }
  | {
      kind: 'child';
      id: string;
      groupId: string;
      child: ModListGroupChildDto;
      parent: Extract<ModListEntryDto, { kind: 'group' }>;
      depth: 1;
    };

export type ActiveRenderOptions = {
  query: string;
  aliases: DisplayAliasDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  modTags: ModTagBindingDto[];
  tagDefs: TagDefDto[];
};

export function updateSelectionForClick(
  current: Set<string>,
  orderedIds: string[],
  clickedId: string,
  modifiers: SelectionClickModifiers,
  anchorId: string | null,
): SelectionUpdate {
  if (modifiers.shiftKey && anchorId && orderedIds.includes(anchorId)) {
    const range = selectedRange(orderedIds, clickedId, anchorId);
    if (range) return { selected: range, anchorId };
  }

  if (modifiers.ctrlKey || modifiers.metaKey) {
    return toggledSelection(current, clickedId);
  }

  return { selected: new Set([clickedId]), anchorId: clickedId };
}

export function canCreateActiveGroup(selectedEntryIds: Set<string>): boolean {
  return selectedEntryIds.size >= 2;
}

export function canCreateInactiveGroup(selectedPackageIds: Set<string>): boolean {
  return selectedPackageIds.size > 0;
}

export function activeModsKey(activeMods: string[]): string {
  return activeMods.join('\u0000');
}

export function activeModEntryIds(entries: ModListEntryDto[]): string[] {
  return entries.filter((entry) => entry.kind === 'mod').map((entry) => entry.id);
}

export function buildActiveRenderRows(
  entries: ModListEntryDto[],
  options: ActiveRenderOptions,
): ActiveRenderRow[] {
  const search = compileSmartModSearch(options.query, {
    aliases: options.aliases,
    modByPackageId: options.modByPackageId,
    modTags: options.modTags,
    tagDefs: options.tagDefs,
  });
  const rows: ActiveRenderRow[] = [];
  for (const entry of entries) {
    rows.push(...entryRenderRows(entry, search));
  }
  return rows;
}

export function pruneSelection(selected: Set<string>, visibleIds: string[]): Set<string> {
  const visible = new Set(visibleIds);
  return new Set([...selected].filter((id) => visible.has(id)));
}

export function selectedDragIds(grabbedId: string, selected: Set<string>): string[] {
  return selected.has(grabbedId) ? [...selected] : [grabbedId];
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) {
    return '—';
  }
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const { value, unit } = scaledFileSize(bytes, units);
  return `${Number.isInteger(value) ? String(value) : value.toFixed(1)} ${unit}`;
}

function selectedRange(
  orderedIds: string[],
  clickedId: string,
  anchorId: string,
): Set<string> | null {
  const clickedIndex = orderedIds.indexOf(clickedId);
  const anchorIndex = orderedIds.indexOf(anchorId);
  if (clickedIndex < 0 || anchorIndex < 0) return null;
  const start = Math.min(clickedIndex, anchorIndex);
  const end = Math.max(clickedIndex, anchorIndex);
  return new Set(orderedIds.slice(start, end + 1));
}

function toggledSelection(current: Set<string>, clickedId: string): SelectionUpdate {
  const selected = new Set(current);
  if (selected.has(clickedId)) {
    selected.delete(clickedId);
  } else {
    selected.add(clickedId);
  }
  return { selected, anchorId: clickedId };
}

function entryRenderRows(entry: ModListEntryDto, search: CompiledSmartSearch): ActiveRenderRow[] {
  if (entry.kind === 'group') {
    return groupRenderRows(entry, search);
  }
  if (entry.kind === 'mod' && entry.active === false) {
    return [];
  }
  if (
    entry.kind === 'separator'
      ? search.matchesSeparator(entry.title)
      : search.matchesIdentity(entry.identity)
  ) {
    return [{ kind: 'entry', id: entrySortableId(entry.id), entry, entryId: entry.id, depth: 0 }];
  }
  return [];
}

function groupRenderRows(
  entry: Extract<ModListEntryDto, { kind: 'group' }>,
  search: CompiledSmartSearch,
): ActiveRenderRow[] {
  const activeChildren = entry.entries.filter((child) => child.active !== false);
  const children = activeChildren.filter((child) =>
    search.matchesIdentity(child.identity, { groupName: entry.name }),
  );
  if (children.length === 0) {
    return [];
  }
  return [
    { kind: 'entry', id: entrySortableId(entry.id), entry, entryId: entry.id, depth: 0 },
    ...children.map((child) => ({
      kind: 'child' as const,
      id: childSortableId(entry.id, child.id),
      groupId: entry.id,
      child,
      parent: entry,
      depth: 1 as const,
    })),
  ];
}

function scaledFileSize(bytes: number, units: string[]): { value: number; unit: string } {
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return { value, unit: units[unitIndex] };
}
