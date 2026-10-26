import type { DisplayAliasDto, ModIdentityDto, ModMetadataDto } from '@/commands';
import { officialDisplayName } from '@/lib/officialContent';

export function displayName(mod: ModMetadataDto, aliases: DisplayAliasDto[]): string {
  return (
    findAlias(aliases, identityForMod(mod))?.displayAlias ??
    officialDisplayName(mod.packageId) ??
    mod.name ??
    mod.packageId
  );
}

export function labelForIdentity(
  identity: ModIdentityDto,
  aliases: DisplayAliasDto[],
  modByPackageId: Map<string, ModMetadataDto>,
): string {
  return (
    findAlias(aliases, identity)?.displayAlias ??
    officialDisplayName(identity.packageId) ??
    modByPackageId.get(identity.packageId)?.name ??
    identity.packageId
  );
}

export function baseDisplayName(mod: ModMetadataDto): string {
  return officialDisplayName(mod.packageId) ?? mod.name ?? mod.packageId;
}

export function baseLabelForIdentity(
  identity: ModIdentityDto,
  modByPackageId: Map<string, ModMetadataDto>,
): string {
  return (
    officialDisplayName(identity.packageId) ??
    modByPackageId.get(identity.packageId)?.name ??
    identity.packageId
  );
}

export function identityForMod(mod: ModMetadataDto): ModIdentityDto {
  return {
    packageId: mod.packageId,
    sourceKind: mod.sourceKind,
    sourceKey: mod.sourceKey,
    steamAppId: mod.steamAppId,
  };
}

/**
 * Resolves the *currently installed* source key for an identity.
 *
 * A mod list entry stores the source key it had when it was added. That path
 * goes stale as soon as the mod moves between the Workshop and local folders,
 * so anything touching the filesystem must resolve against the live catalog
 * instead of trusting the stored hint.
 */
export function resolveSourceKey(
  identity: ModIdentityDto,
  modByPackageId: Map<string, ModMetadataDto> | null | undefined,
): string | null | undefined {
  return modByPackageId?.get(identity.packageId)?.sourceKey ?? null;
}

export function findAlias(
  aliases: DisplayAliasDto[],
  identity: ModIdentityDto,
): DisplayAliasDto | undefined {
  return aliases.find((alias) => identityMatches(alias.identity, identity));
}

export function upsertAlias(
  aliases: DisplayAliasDto[],
  identity: ModIdentityDto,
  displayAlias: string,
): DisplayAliasDto[] {
  const next = aliases.filter((alias) => !identityMatches(alias.identity, identity));
  if (displayAlias) {
    next.push({ identity, displayAlias });
  }
  return next;
}

/**
 * Two identities refer to the same mod when their package ids match.
 *
 * The source fields are provenance hints captured when the entry was created.
 * `sourceKey` in particular is a host path that changes when a mod moves
 * between the Workshop and local folders, when the game is reinstalled, or
 * when a folder is renamed — keying on it detached aliases and tags from
 * their mod.
 */
export function identityMatches(a: ModIdentityDto, b: ModIdentityDto): boolean {
  return normalizePackageId(a.packageId) === normalizePackageId(b.packageId);
}

function normalizePackageId(packageId: string): string {
  return packageId.trim().toLowerCase();
}
