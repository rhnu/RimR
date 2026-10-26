import { describe, expect, it } from 'vitest';
import type { ModMetadataDto } from '@/commands';
import { sortAvailableMods } from '@/lib/availableMods';

function mod(
  packageId: string,
  name: string | null,
  authors: string[],
  overrides: Partial<Pick<ModMetadataDto, 'modifiedAtMs'>> = {},
): ModMetadataDto {
  return {
    sourceKey: `local:${packageId}`,
    sourceKind: 'local',
    packageId,
    path: `C:/RimWorld/Mods/${packageId}`,
    modifiedAtMs: overrides.modifiedAtMs ?? 1,
    name,
    authors,
    supportedVersions: [],
    description: null,
    modVersion: null,
    url: null,
    modIconPath: null,
    steamAppId: null,
    hasAssemblies: false,
    rules: {
      loadAfter: [],
      loadBefore: [],
      modDependencies: [],
      incompatibleWith: [],
      forceLoadAfter: [],
      forceLoadBefore: [],
    },
    valid: true,
    dataMalformed: false,
  };
}

const mods = [
  mod('z.core', 'Zeta', ['B Author']),
  mod('a.core', 'Alpha', ['C Author']),
  mod('m.core', null, ['A Author']),
];

describe('sortAvailableMods', () => {
  it('sorts by display name ascending and uses package id as a stable fallback', () => {
    expect(sortAvailableMods(mods, 'name', 'asc').map((m) => m.packageId)).toEqual([
      'a.core',
      'm.core',
      'z.core',
    ]);
  });

  it('sorts by package id descending', () => {
    expect(sortAvailableMods(mods, 'packageId', 'desc').map((m) => m.packageId)).toEqual([
      'z.core',
      'm.core',
      'a.core',
    ]);
  });

  it('sorts by first author then package id', () => {
    expect(sortAvailableMods(mods, 'author', 'asc').map((m) => m.packageId)).toEqual([
      'm.core',
      'z.core',
      'a.core',
    ]);
  });

  it('sorts by modified time and keeps package id as a stable tie-breaker', () => {
    const sorted = sortAvailableMods(
      [
        mod('z.same', 'Zed', [], { modifiedAtMs: 20 }),
        mod('a.same', 'Alpha', [], { modifiedAtMs: 20 }),
        mod('m.old', 'Middle', [], { modifiedAtMs: 10 }),
      ],
      'modifiedAt',
      'desc',
    );

    expect(sorted.map((m) => m.packageId)).toEqual(['a.same', 'z.same', 'm.old']);
  });
});
