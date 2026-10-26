import type { ModListEntryDto } from '@/commands';

/**
 * Entries a "remove" gesture should act on, split by how they are removed.
 *
 * The context menu opens only after the clicked row has been added to the
 * selection, so a removal that touched the clicked row alone would silently
 * ignore the rest — unlike dragging and grouping, which have always been
 * selection-wide. A click on a row outside the selection acts on that row only.
 *
 * Separators have no active/inactive state, so they are deleted outright while
 * mods and groups are only deactivated.
 */
export type RemovalTargets = {
  /** Separators to delete from the list. */
  removeIds: string[];
  /** Mods and groups to deactivate. */
  deactivateIds: string[];
};

export function removalTargets(
  entries: ModListEntryDto[],
  clickedEntryId: string,
  selectedEntryIds: ReadonlySet<string>,
): RemovalTargets {
  const targetIds = selectedEntryIds.has(clickedEntryId)
    ? selectedEntryIds
    : new Set([clickedEntryId]);
  const targets = entries.filter((entry) => targetIds.has(entry.id));
  return {
    removeIds: targets.filter((entry) => entry.kind === 'separator').map((entry) => entry.id),
    deactivateIds: targets.filter((entry) => entry.kind !== 'separator').map((entry) => entry.id),
  };
}
