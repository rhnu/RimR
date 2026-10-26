import type { ModMetadataDto } from '@/commands';

const MISSING_PACKAGE_ID = 'missing.packageid';

export function catalogItemKey(mod: ModMetadataDto): string {
  return isPackageAddressableMod(mod)
    ? packageCatalogItemKey(mod.packageId)
    : sourceCatalogItemKey(mod.sourceKey);
}

export function isPackageAddressableMod(mod: ModMetadataDto): boolean {
  return mod.valid && mod.packageId !== MISSING_PACKAGE_ID;
}

export function packageCatalogItemKey(packageId: string): string {
  return `package:${packageId}`;
}

export function sourceCatalogItemKey(sourceKey: string): string {
  return `source:${sourceKey}`;
}
