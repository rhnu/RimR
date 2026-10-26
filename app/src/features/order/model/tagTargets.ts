import type { ModIdentityDto, ModListEntryDto, ModMetadataDto } from '@/commands';
import { identityForMod, identityMatches } from '@/features/order/identity';
import type { ActiveRenderRow } from './selectors';
import { catalogItemKey } from './catalogItemKey';

export function selectedInactiveModIdentities(
  mods: ModMetadataDto[],
  selectedCatalogKeys: Set<string>,
): ModIdentityDto[] {
  return mods.filter((mod) => selectedCatalogKeys.has(catalogItemKey(mod))).map(identityForMod);
}

export function selectedActiveModIdentities(
  rows: ActiveRenderRow[],
  selectedEntryIds: Set<string>,
): ModIdentityDto[] {
  const identities: ModIdentityDto[] = [];
  for (const row of rows) {
    if (row.kind === 'entry' && row.entry.kind === 'mod' && selectedEntryIds.has(row.entry.id)) {
      identities.push(row.entry.identity);
    }
  }
  return identities;
}

export function tagTargetsForEntry(
  entry: ModListEntryDto,
  selectedIdentities: ModIdentityDto[],
): ModIdentityDto[] {
  if (entry.kind !== 'mod') return [];
  return tagTargetsForIdentity(entry.identity, selectedIdentities);
}

export function tagTargetsForIdentity(
  identity: ModIdentityDto,
  selectedIdentities: ModIdentityDto[],
): ModIdentityDto[] {
  return selectedIdentities.some((selected) => identityMatches(selected, identity))
    ? selectedIdentities
    : [identity];
}
