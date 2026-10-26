import { normalizePackageId } from './identity';
import type { ModMetadataDto } from '@/commands';

const MISSING_PACKAGE_ID = 'missing.packageid';

export function catalogItemKey(mod: ModMetadataDto): string {
  return sourceCatalogItemKey(mod.sourceKey);
}

export function isPackageAddressableMod(mod: ModMetadataDto): boolean {
  return (
    mod.valid &&
    normalizePackageId(mod.packageId) !== MISSING_PACKAGE_ID &&
    normalizePackageId(mod.packageId) !== ''
  );
}

export function sourceCatalogItemKey(sourceKey: string): string {
  return `source:${sourceKey}`;
}

/** The scan is stably ordered; select its first valid installation per package. */
export function primaryModsByPackageId(mods: ModMetadataDto[]): Map<string, ModMetadataDto> {
  const result = new Map<string, ModMetadataDto>();
  for (const mod of mods) {
    const packageId = normalizePackageId(mod.packageId);
    if (isPackageAddressableMod(mod) && !result.has(packageId)) result.set(packageId, mod);
  }
  return result;
}
