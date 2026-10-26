import type { ModListDto, ModListEntryDto, ModMetadataDto } from '@/commands';

export function mod(
  packageId: string,
  name: string,
  overrides: Partial<ModMetadataDto> = {},
): ModMetadataDto {
  return {
    sourceKey: `local:${packageId}`,
    sourceKind: 'local',
    packageId,
    path: `C:/RimWorld/Mods/${packageId}`,
    modifiedAtMs: 1,
    name,
    authors: [],
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
    ...overrides,
  };
}

export const catalogMods: ModMetadataDto[] = [
  mod('a.core', 'Core'),
  mod('b.dep', 'Dependency'),
  mod('c.extra', 'Extra'),
];

export function baseModList(entries: ModListEntryDto[] = baseEntries()): ModListDto {
  return {
    formatVersion: 1,
    id: 'default',
    name: 'Default',
    note: null,
    entries,
    activeMods: ['a.core', 'b.dep'],
  };
}

export function baseEntries(): ModListEntryDto[] {
  return [
    {
      kind: 'mod',
      id: 'entry-a',
      active: true,
      identity: { packageId: 'a.core', sourceKind: 'local', sourceKey: 'local:a.core' },
    },
    { kind: 'separator', id: 'sep-1', title: 'Visual only', note: null, color: '#888888' },
    {
      kind: 'group',
      id: 'group-required',
      name: 'Required',
      collapsed: false,
      entries: [{ id: 'child-b', active: true, identity: { packageId: 'b.dep' } }],
    },
  ];
}
