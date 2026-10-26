import type { ModIdentityDto, ModMetadataDto } from '@/commands';

export function isSteamWorkshopLinkAvailable(
  identity: ModIdentityDto,
  modByPackageId: Map<string, ModMetadataDto>,
): boolean {
  return steamWorkshopSourceKey(identity, modByPackageId) != null;
}

export function steamWorkshopSourceKey(
  identity: ModIdentityDto,
  modByPackageId: Map<string, ModMetadataDto>,
): string | null {
  const sourceKind = identity.sourceKind ?? modByPackageId.get(identity.packageId)?.sourceKind;
  const sourceKey = identity.sourceKey ?? modByPackageId.get(identity.packageId)?.sourceKey;
  if (sourceKind !== 'workshop' || !sourceKey) return null;
  return sourceKey;
}
