import { describe, expect, it } from 'vitest';
import {
  baseDisplayName,
  baseLabelForIdentity,
  identityMatches,
  resolveSourceKey,
} from './identity';
import { mod } from './model/testFixtures';

describe('identity base labels', () => {
  it('returns the official display name for official mods', () => {
    expect(baseDisplayName(mod('ludeon.rimworld', 'Core', { sourceKind: 'expansion' }))).toBe(
      'RimWorld',
    );
  });

  it('falls back to mod name when no official name exists', () => {
    expect(baseDisplayName(mod('foo.bar', 'Foo Bar'))).toBe('Foo Bar');
  });

  it('falls back to package id when name is missing', () => {
    expect(baseDisplayName(mod('baz.qux', '', { name: null }))).toBe('baz.qux');
  });

  it('resolves base label from a package id map', () => {
    const foo = mod('foo.bar', 'Foo Bar');
    const modByPackageId = new Map([['foo.bar', foo]]);
    expect(
      baseLabelForIdentity(
        {
          packageId: 'foo.bar',
          sourceKind: 'local',
          sourceKey: 'local:foo.bar',
          steamAppId: null,
        },
        modByPackageId,
      ),
    ).toBe('Foo Bar');
  });

  it('falls back to package id when mod is not in the map', () => {
    expect(
      baseLabelForIdentity(
        {
          packageId: 'missing.mod',
          sourceKind: 'local',
          sourceKey: 'local:missing.mod',
          steamAppId: null,
        },
        new Map(),
      ),
    ).toBe('missing.mod');
  });
});

describe('identityMatches', () => {
  const workshop = {
    packageId: 'foo.bar',
    sourceKind: 'workshop' as const,
    sourceKey: 'C:/steamapps/workshop/content/294100/12345',
    steamAppId: 12345,
  };
  const local = {
    packageId: 'foo.bar',
    sourceKind: 'local' as const,
    sourceKey: 'C:/RimWorld/Mods/FooBar',
    steamAppId: null,
  };

  it('survives a workshop mod being replaced by a local copy', () => {
    expect(identityMatches(workshop, local)).toBe(true);
  });

  it('survives the mod folder moving', () => {
    expect(identityMatches(local, { ...local, sourceKey: 'D:/Games/RimWorld/Mods/FooBar' })).toBe(
      true,
    );
  });

  it('ignores package id case and surrounding whitespace', () => {
    expect(identityMatches(local, { ...local, packageId: '  Foo.Bar  ' })).toBe(true);
  });

  it('still distinguishes different mods', () => {
    expect(identityMatches(local, { ...local, packageId: 'other.mod' })).toBe(false);
  });
});

describe('resolveSourceKey', () => {
  it('prefers the live catalog over the stored hint', () => {
    const installed = mod('foo.bar', 'Foo Bar', { sourceKey: 'D:/Mods/FooBar' });
    expect(
      resolveSourceKey(
        {
          packageId: 'foo.bar',
          sourceKind: 'workshop',
          sourceKey: 'C:/stale/workshop/path',
          steamAppId: 12345,
        },
        new Map([['foo.bar', installed]]),
      ),
    ).toBe('D:/Mods/FooBar');
  });

  it('returns null for a mod that is no longer installed', () => {
    expect(
      resolveSourceKey(
        { packageId: 'gone.mod', sourceKind: 'local', sourceKey: 'C:/old', steamAppId: null },
        new Map(),
      ),
    ).toBeNull();
  });
});
