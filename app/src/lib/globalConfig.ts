import type { DisplayAliasDto, LibrarySettingsDto, ModIdentityDto } from '@/commands';

export function mergeGlobalAliases(
  local: LibrarySettingsDto,
  imported: LibrarySettingsDto,
): LibrarySettingsDto {
  const importedKeys = new Set(imported.aliases.map((alias) => identityKey(alias.identity)));
  return {
    ...local,
    aliases: [
      ...local.aliases.filter((alias) => !importedKeys.has(identityKey(alias.identity))),
      ...imported.aliases,
    ],
  };
}

/**
 * Stable comparison key for a mod identity: the package id alone.
 *
 * Source provenance (`sourceKind` / `sourceKey`) is deliberately excluded — it
 * changes when a mod moves between the Workshop and local folders, which would
 * otherwise orphan the alias.
 */
export function identityKey(identity: ModIdentityDto): string {
  return identity.packageId.trim().toLowerCase();
}

export function upsertDisplayAlias(
  aliases: DisplayAliasDto[],
  alias: DisplayAliasDto,
): DisplayAliasDto[] {
  return [
    ...aliases.filter(
      (candidate) => identityKey(candidate.identity) !== identityKey(alias.identity),
    ),
    alias,
  ];
}
