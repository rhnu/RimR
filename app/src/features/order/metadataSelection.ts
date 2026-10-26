import type { ModIdentityDto, ModListDto, ModMetadataDto } from '@/commands';
import type { Selection } from './types';

export function deriveSelection(
  selection: Selection,
  draft: ModListDto,
  modByPackageId: Map<string, ModMetadataDto>,
): {
  selectedModIdentity: ModIdentityDto | null;
  selectedMod: ModMetadataDto | null | undefined;
  selectedEntry: ModListDto['entries'][number] | null | undefined;
} {
  const selectedModIdentity = selection?.kind === 'mod' ? selection.identity : null;
  const selectedMod = selectedModIdentity
    ? modByPackageId.get(selectedModIdentity.packageId)
    : null;
  const selectedEntry =
    selection?.kind === 'group' || selection?.kind === 'separator'
      ? draft.entries.find((entry) => entry.id === selection.entryId)
      : null;
  return { selectedModIdentity, selectedMod, selectedEntry };
}
