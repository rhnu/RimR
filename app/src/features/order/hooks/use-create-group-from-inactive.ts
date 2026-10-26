import { useCallback, type MutableRefObject } from 'react';
import type { ModListDto, ModMetadataDto } from '@/commands';
import { canCreateInactiveGroup } from '@/features/order/model';
import { catalogItemKey, isPackageAddressableMod } from '@/domain/mods/catalog';
import { createGroupId } from '@/domain/mod-list/ids';
import { type ModListAction } from '@/domain/mod-list/types';

/**
 * Creates a group from the mods currently selected in the available panel and
 * appends it to the end of the list.
 */
export function useCreateGroupFromInactive({
  draftRef,
  selectedInactiveCatalogKeys,
  sortedInactiveMods,
  applyDraft,
  resetSelections,
}: {
  draftRef: MutableRefObject<ModListDto | null>;
  selectedInactiveCatalogKeys: Set<string>;
  sortedInactiveMods: ModMetadataDto[];
  applyDraft: (action: ModListAction) => void;
  resetSelections: () => void;
}) {
  return useCallback(
    (nameValue: string): void => {
      const name = nameValue.trim();
      const draft = draftRef.current;
      if (!draft || !canCreateInactiveGroup(selectedInactiveCatalogKeys) || !name) return;
      const selectedMods = sortedInactiveMods.filter(
        (mod) =>
          isPackageAddressableMod(mod) && selectedInactiveCatalogKeys.has(catalogItemKey(mod)),
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
    [applyDraft, draftRef, resetSelections, selectedInactiveCatalogKeys, sortedInactiveMods],
  );
}
