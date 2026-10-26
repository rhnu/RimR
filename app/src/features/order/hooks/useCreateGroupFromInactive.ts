import { useCallback, type MutableRefObject } from 'react';
import type { ModListDto, ModMetadataDto } from '@/commands';
import {
  canCreateInactiveGroup,
  catalogItemKey,
  createGroupId,
  isPackageAddressableMod,
  type ModListAction,
} from '@/features/order/model';

/**
 * Creates a group from the mods currently selected in the available panel and
 * appends it to the end of the list.
 */
export function useCreateGroupFromInactive({
  draftRef,
  selectedInactivePackageIds,
  sortedInactiveMods,
  applyDraft,
  resetSelections,
}: {
  draftRef: MutableRefObject<ModListDto | null>;
  selectedInactivePackageIds: Set<string>;
  sortedInactiveMods: ModMetadataDto[];
  applyDraft: (action: ModListAction) => void;
  resetSelections: () => void;
}) {
  return useCallback(
    (nameValue: string): void => {
      const name = nameValue.trim();
      const draft = draftRef.current;
      if (!draft || !canCreateInactiveGroup(selectedInactivePackageIds) || !name) return;
      const selectedMods = sortedInactiveMods.filter(
        (mod) =>
          isPackageAddressableMod(mod) && selectedInactivePackageIds.has(catalogItemKey(mod)),
      );
      applyDraft({
        type: 'createGroupFromMods',
        mods: selectedMods,
        groupId: createGroupId(),
        name,
        index: draft.entries.length,
        active: true,
      });
      resetSelections();
    },
    [applyDraft, draftRef, resetSelections, selectedInactivePackageIds, sortedInactiveMods],
  );
}
