import { describe, expect, it } from 'vitest';
import type { DisplayAliasDto, ModMetadataDto, ModTagBindingDto, TagDefDto } from '@/commands';
import { baseEntries, mod } from './testFixtures';
import { buildActiveRenderRows, buildInactiveRenderRows, filterInactiveMods } from './selectors';
import { compileSmartModSearch } from './smartSearch';

describe('order model smart search selectors', () => {
  it('filters active and inactive mods by quoted tag modifier', () => {
    const tagDefs: TagDefDto[] = [{ id: 'tag-qol', name: 'Quality of Life' }];
    const catalogMods = [
      mod('a.core', 'Core'),
      mod('b.dep', 'Dependency'),
      mod('c.extra', 'Extra'),
    ];
    const modTags: ModTagBindingDto[] = [
      {
        identity: { packageId: 'a.core', sourceKind: 'local', sourceKey: 'local:a.core' },
        tagIds: ['tag-qol'],
      },
      {
        identity: { packageId: 'c.extra', sourceKind: 'local', sourceKey: 'local:c.extra' },
        tagIds: ['tag-qol'],
      },
    ];

    const activeRows = buildActiveRenderRows(baseEntries(), {
      query: '#"quality of life"',
      aliases: [],
      modByPackageId: modMap(catalogMods),
      modTags,
      tagDefs,
    });
    const inactiveMods = filterInactiveMods(
      [catalogMods[2]],
      searchFor('#"quality of life"', catalogMods, [], modTags, tagDefs),
    );

    expect(activeRows.map((row) => row.id)).toEqual(['active:entry:entry-a']);
    expect(inactiveMods.map((item) => item.packageId)).toEqual(['c.extra']);
  });

  it('filters inactive mods by source modifier and negated source modifier', () => {
    const mods = [
      mod('steam.mod', 'Steam Mod', { sourceKind: 'workshop', sourceKey: 'workshop:1' }),
      mod('local.mod', 'Local Mod'),
      mod('dlc.mod', 'DLC Mod', { sourceKind: 'expansion', sourceKey: 'expansion:dlc.mod' }),
    ];

    expect(
      filterInactiveMods(mods, searchFor('&steam', mods)).map((item) => item.packageId),
    ).toEqual(['steam.mod']);
    expect(
      filterInactiveMods(mods, searchFor('&official', mods)).map((item) => item.packageId),
    ).toEqual(['dlc.mod']);
    expect(
      filterInactiveMods(mods, searchFor('!&steam', mods)).map((item) => item.packageId),
    ).toEqual(['local.mod', 'dlc.mod']);
  });

  it('shows group children when filtering active and inactive rows by group modifier', () => {
    const activeRows = buildActiveRenderRows(baseEntries(), {
      query: '@required',
      aliases: [],
      modByPackageId: modMap([mod('a.core', 'Core'), mod('b.dep', 'Dependency')]),
      modTags: [],
      tagDefs: [],
    });
    const inactiveRows = buildInactiveRenderRows(
      [
        {
          kind: 'group',
          id: 'group-mixed',
          name: 'Mixed Group',
          collapsed: false,
          entries: [
            { id: 'child-active', active: true, identity: { packageId: 'a.core' } },
            { id: 'child-inactive', active: false, identity: { packageId: 'b.dep' } },
            { id: 'child-missing', active: false, identity: { packageId: 'missing.mod' } },
          ],
        },
      ],
      [],
      {
        aliases: [],
        modByPackageId: modMap([mod('a.core', 'Core'), mod('b.dep', 'Dependency')]),
        search: searchFor('@mixed', []),
      },
    );

    expect(activeRows.map((row) => row.id)).toEqual([
      'active:entry:group-required',
      'active:child:group-required:child-b',
    ]);
    expect(inactiveRows.map((row) => row.id)).toEqual([
      'inactive:entry:group-mixed',
      'inactive:child:group-mixed:child-inactive',
      'inactive:child:group-mixed:child-missing',
    ]);
  });

  it('applies negated text, tag, and group conditions', () => {
    const tagDefs: TagDefDto[] = [{ id: 'tag-qol', name: 'Quality' }];
    const catalogMods = [mod('a.core', 'Core'), mod('b.dep', 'Dependency')];
    const modTags: ModTagBindingDto[] = [
      {
        identity: { packageId: 'a.core', sourceKind: 'local', sourceKey: 'local:a.core' },
        tagIds: ['tag-qol'],
      },
    ];

    expect(
      filterInactiveMods(catalogMods, searchFor('!dep', catalogMods)).map((item) => item.packageId),
    ).toEqual(['a.core']);
    expect(
      filterInactiveMods(
        catalogMods,
        searchFor('!#quality', catalogMods, [], modTags, tagDefs),
      ).map((item) => item.packageId),
    ).toEqual(['b.dep']);

    const activeRows = buildActiveRenderRows(baseEntries(), {
      query: '!@required',
      aliases: [],
      modByPackageId: modMap(catalogMods),
      modTags,
      tagDefs,
    });

    expect(activeRows.map((row) => row.id)).toEqual(['active:entry:entry-a']);
  });
});

function searchFor(
  query: string,
  mods: ModMetadataDto[],
  aliases: DisplayAliasDto[] = [],
  modTags: ModTagBindingDto[] = [],
  tagDefs: TagDefDto[] = [],
) {
  return compileSmartModSearch(query, {
    aliases,
    modByPackageId: modMap(mods),
    modTags,
    tagDefs,
  });
}

function modMap(mods: ModMetadataDto[]): Map<string, ModMetadataDto> {
  return new Map(mods.map((item) => [item.packageId, item]));
}
