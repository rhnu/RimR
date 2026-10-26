import { flattenModListEntries } from './normalize';
import { describe, expect, it } from 'vitest';
import { baseModList, catalogMods } from '@/domain/mod-list/test-fixtures';
import { modListReducer } from '@/domain/mod-list/reducer';
import { syncModListFromGame } from './sync-from-game';

const generate = () => 'f23e1419-0a57-4c52-8d41-d0e089091c9b';

describe('order model game sync', () => {
  it('syncs game order while preserving compatible groups and separators', () => {
    const current = modListReducer(baseModList(), {
      type: 'addMod',
      mod: catalogMods[2],
      index: 3,
    });

    const result = syncModListFromGame(
      current,
      ['c.extra', 'b.dep', 'a.core'],
      catalogMods,
      generate,
    );

    expect(flattenModListEntries(result.modList.entries)).toEqual(['c.extra', 'b.dep', 'a.core']);
    expect(result.diff.items.some((item) => item.kind === 'groupSplit')).toBe(false);
    expect(result.modList.entries).toMatchObject([
      { kind: 'mod', identity: { packageId: 'c.extra' } },
      {
        kind: 'group',
        id: 'group-required',
        entries: [{ identity: { packageId: 'b.dep' } }],
      },
      { kind: 'separator', id: 'sep-1' },
      { kind: 'mod', identity: { packageId: 'a.core' } },
    ]);
  });

  it('splits groups that are no longer contiguous in game order', () => {
    const grouped = modListReducer(baseModList(), {
      type: 'addModToGroup',
      groupId: 'group-required',
      mod: catalogMods[2],
      index: 1,
    });

    const result = syncModListFromGame(
      grouped,
      ['b.dep', 'a.core', 'c.extra'],
      catalogMods,
      generate,
    );

    expect(flattenModListEntries(result.modList.entries)).toEqual(['b.dep', 'a.core', 'c.extra']);
    expect(result.diff.items).toContainEqual({
      kind: 'groupSplit',
      groupName: 'Required',
      packageIds: ['b.dep', 'c.extra'],
    });
    expect(result.modList.entries).toMatchObject([
      { kind: 'mod', identity: { packageId: 'b.dep' } },
      { kind: 'separator', id: 'sep-1' },
      { kind: 'mod', identity: { packageId: 'a.core' } },
      { kind: 'mod', identity: { packageId: 'c.extra' } },
    ]);
  });

  it('reports added and removed packages without allowing separators into activeMods', () => {
    const result = syncModListFromGame(baseModList(), ['b.dep', 'c.extra'], catalogMods, generate);

    expect(result.diff.items).toContainEqual({ kind: 'added', packageId: 'c.extra', toIndex: 1 });
    expect(result.diff.items).toContainEqual({
      kind: 'removed',
      packageId: 'a.core',
      fromIndex: 0,
    });
    expect(flattenModListEntries(result.modList.entries)).toEqual(['b.dep', 'c.extra']);
    expect(result.modList.entries.some((entry) => entry.kind === 'separator')).toBe(true);
  });

  it('drops game-inactive group children when syncing compatible active children', () => {
    const current = modListReducer(baseModList(), {
      type: 'addModsToGroup',
      groupId: 'group-required',
      mods: [catalogMods[2]],
      index: 1,
    });
    const withInactive = modListReducer(current, {
      type: 'setGroupChildrenActive',
      groupId: 'group-required',
      childIds: current.entries.flatMap((entry) =>
        entry.kind === 'group'
          ? entry.entries
              .filter((child) => child.identity.packageId === 'c.extra')
              .map((child) => child.id)
          : [],
      ),
      active: false,
    });

    const result = syncModListFromGame(withInactive, ['b.dep', 'a.core'], catalogMods, generate);

    expect(flattenModListEntries(result.modList.entries)).toEqual(['b.dep', 'a.core']);
    expect(result.modList.entries[0]).toMatchObject({
      kind: 'group',
      id: 'group-required',
      entries: [{ id: 'child-b', active: true, identity: { packageId: 'b.dep' } }],
    });
  });
});
