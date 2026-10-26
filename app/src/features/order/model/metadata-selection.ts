import { normalizePackageId } from '@/domain/mods/identity';
import { sourceCatalogItemKey } from '@/domain/mods/catalog';
import type { ModIdentityDto, ModListDto, ModMetadataDto } from '@/commands';
import type { Selection } from '@/features/order/types';

export function deriveSelection(
  selection: Selection,
  draft: ModListDto,
  modByPackageId: Map<string, ModMetadataDto>,
  modByCatalogKey: Map<string, ModMetadataDto>,
): {
  selectedModIdentity: ModIdentityDto | null;
  selectedMod: ModMetadataDto | null | undefined;
  selectedEntry: ModListDto['entries'][number] | null | undefined;
} {
  const selectedModIdentity = selection?.kind === 'mod' ? selection.identity : null;
  const selectedMod = selectedModIdentity
    ? selection?.kind === 'mod' && selection.sourceKey
      ? modByCatalogKey.get(sourceCatalogItemKey(selection.sourceKey))
      : modByPackageId.get(normalizePackageId(selectedModIdentity.packageId))
    : null;
  const selectedEntry =
    selection?.kind === 'group' || selection?.kind === 'separator'
      ? draft.entries.find((entry) => entry.id === selection.entryId)
      : null;
  return { selectedModIdentity, selectedMod, selectedEntry };
}
