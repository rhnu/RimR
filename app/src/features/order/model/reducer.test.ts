import { describe, expect, it } from 'vitest';
import { catalogMods, baseModList, mod } from './testFixtures';
import { flattenModListEntries } from './normalize';
import {
  classifyMissingEntries,
  modListReducer,
  removeMissingEntries,
  unintroducedMods,
} from './reducer';

describe('order model reducer basics', () => {
  it('filters catalog mods that are not already in the list', () => {
    expect(unintroducedMods(catalogMods, baseModList()).map((mod) => mod.packageId)).toEqual([
      'c.extra',
    ]);
  });

  it('treats structured mods as unavailable until normalized', () => {
    const current = baseModList([
      {
        kind: 'mod',
        id: 'entry-a',
        active: false,
        identity: { packageId: 'a.core' },
      },
      {
        kind: 'group',
        id: 'group-required',
        name: 'Required',
        collapsed: false,
        entries: [{ id: 'child-b', active: false, identity: { packageId: 'b.dep' } }],
      },
    ]);

    expect(unintroducedMods(catalogMods, current).map((mod) => mod.packageId)).toEqual(['c.extra']);
  });

  it('adds catalog mods at the requested index and skips active duplicates', () => {
    const next = modListReducer(baseModList(), {
      type: 'addMods',
      mods: [catalogMods[2], catalogMods[0]],
      index: 1,
    });

    expect(next.entries[1]).toMatchObject({
      kind: 'mod',
      identity: { packageId: 'c.extra' },
    });
    expect(next.activeMods).toEqual(['a.core', 'c.extra', 'b.dep']);
  });

  it('skips invalid catalog mods when adding to active structures', () => {
    const invalid = mod('missing.packageid', 'Broken', {
      sourceKey: 'local:/mods/broken',
      valid: false,
    });

    const next = modListReducer(baseModList(), {
      type: 'addMods',
      mods: [invalid, catalogMods[2]],
      index: 1,
    });

    expect(next.activeMods).toEqual(['a.core', 'c.extra', 'b.dep']);
    expect(flattenModListEntries(next.entries)).not.toContain('missing.packageid');
  });

  it('removes top-level entries and preserves empty groups after child removal', () => {
    const withoutTopLevel = modListReducer(baseModList(), {
      type: 'removeEntry',
      entryId: 'entry-a',
    });
    expect(flattenModListEntries(withoutTopLevel.entries)).toEqual(['b.dep']);

    const withoutChild = modListReducer(withoutTopLevel, {
      type: 'removeGroupChild',
      groupId: 'group-required',
      childId: 'child-b',
    });
    expect(withoutChild.entries).toEqual([
      { kind: 'separator', id: 'sep-1', title: 'Visual only', note: null, color: '#888888' },
      { kind: 'group', id: 'group-required', name: 'Required', collapsed: false, entries: [] },
    ]);
    expect(withoutChild.activeMods).toEqual([]);
  });
});

describe('order model reducer structure actions', () => {
  it('groups selected top-level mods and can ungroup them back into the list', () => {
    const withExtra = modListReducer(baseModList(), {
      type: 'addMod',
      mod: catalogMods[2],
      index: 1,
    });
    const grouped = modListReducer(withExtra, {
      type: 'createGroup',
      entryIds: ['entry-a', 'mod-c-extra'],
      groupId: 'group-core',
      name: 'Core pair',
    });

    expect(grouped.entries[0]).toMatchObject({
      kind: 'group',
      id: 'group-core',
      entries: [{ identity: { packageId: 'a.core' } }, { identity: { packageId: 'c.extra' } }],
    });
    expect(grouped.activeMods).toEqual(['a.core', 'c.extra', 'b.dep']);

    const ungrouped = modListReducer(grouped, { type: 'ungroup', groupId: 'group-core' });
    expect(ungrouped.entries.slice(0, 2)).toMatchObject([
      { kind: 'mod', identity: { packageId: 'a.core' } },
      { kind: 'mod', identity: { packageId: 'c.extra' } },
    ]);
  });

  it('creates a group directly from inactive catalog mods', () => {
    const next = modListReducer(baseModList(), {
      type: 'createGroupFromMods',
      mods: [catalogMods[2]],
      groupId: 'group-extra',
      name: 'Extra group',
      index: 1,
    });

    expect(next.entries[1]).toMatchObject({
      kind: 'group',
      id: 'group-extra',
      entries: [{ identity: { packageId: 'c.extra', sourceKind: 'local' } }],
    });
    expect(next.activeMods).toEqual(['a.core', 'c.extra', 'b.dep']);
  });

  it('moves group children and stable blocks of top-level entries', () => {
    const grouped = modListReducer(baseModList(), {
      type: 'addModToGroup',
      groupId: 'group-required',
      mod: catalogMods[2],
      index: 0,
    });
    const childMoved = modListReducer(grouped, {
      type: 'moveGroupChild',
      groupId: 'group-required',
      childId: 'child-b',
      targetChildId: 'child-c-extra',
      edge: 'before',
    });
    expect(flattenModListEntries(childMoved.entries)).toEqual(['a.core', 'b.dep', 'c.extra']);

    const blockMoved = modListReducer(childMoved, {
      type: 'moveEntries',
      entryIds: ['entry-a', 'group-required'],
      targetEntryId: 'sep-1',
      edge: 'after',
    });
    expect(blockMoved.entries.map((entry) => entry.id)).toEqual([
      'sep-1',
      'entry-a',
      'group-required',
    ]);
  });

  it('moves top-level mods into a group at the target child index', () => {
    const withExtra = modListReducer(baseModList(), {
      type: 'addMod',
      mod: catalogMods[2],
      index: 1,
    });
    const moved = modListReducer(withExtra, {
      type: 'moveEntriesToGroup',
      entryIds: ['entry-a', 'mod-c-extra'],
      groupId: 'group-required',
      index: 0,
    });

    expect(moved.entries).toHaveLength(2);
    expect(moved.entries[1]).toMatchObject({
      kind: 'group',
      id: 'group-required',
      entries: [
        { identity: { packageId: 'a.core' } },
        { identity: { packageId: 'c.extra' } },
        { identity: { packageId: 'b.dep' } },
      ],
    });
    expect(moved.activeMods).toEqual(['a.core', 'c.extra', 'b.dep']);
  });
});

describe('order model reducer active state and separators', () => {
  it('keeps top-level entries and group children when set inactive', () => {
    const withExtra = modListReducer(baseModList(), {
      type: 'addModToGroup',
      groupId: 'group-required',
      mod: catalogMods[2],
      index: 1,
    });

    const disabled = modListReducer(withExtra, {
      type: 'setGroupChildrenActive',
      groupId: 'group-required',
      childIds: ['child-b'],
      active: false,
    });
    expect(disabled.activeMods).toEqual(['a.core', 'c.extra']);
    expect(disabled.entries[2]).toMatchObject({
      kind: 'group',
      entries: [
        { id: 'child-b', active: false },
        { id: 'child-c-extra', active: true },
      ],
    });

    const reenabled = modListReducer(disabled, {
      type: 'setEntryActive',
      entryId: 'entry-a',
      active: false,
    });
    expect(reenabled.activeMods).toEqual(['c.extra']);
    expect(reenabled.entries[0]).toMatchObject({
      kind: 'mod',
      id: 'entry-a',
      active: false,
    });
  });

  it('keeps a group when removing it from active by deactivating children', () => {
    const next = modListReducer(baseModList(), {
      type: 'setEntryActive',
      entryId: 'group-required',
      active: false,
    });

    expect(next.entries).toHaveLength(3);
    expect(next.entries[2]).toMatchObject({
      kind: 'group',
      id: 'group-required',
      entries: [{ id: 'child-b', active: false }],
    });
    expect(next.activeMods).toEqual(['a.core']);
  });

  it('activates an inactive group at the requested active target instead of its old position', () => {
    const inactive = modListReducer(baseModList(), {
      type: 'setEntryActive',
      entryId: 'group-required',
      active: false,
    });
    const moved = modListReducer(inactive, {
      type: 'moveEntriesAndSetActive',
      entryIds: ['group-required'],
      targetEntryId: 'entry-a',
      edge: 'before',
      active: true,
    });

    expect(moved.entries.map((entry) => entry.id)).toEqual(['group-required', 'entry-a', 'sep-1']);
    expect(moved.entries[0]).toMatchObject({
      kind: 'group',
      entries: [{ id: 'child-b', active: true }],
    });
    expect(moved.activeMods).toEqual(['b.dep', 'a.core']);
  });

  it('inserts and renames separators without changing activeMods', () => {
    const separated = modListReducer(baseModList(), {
      type: 'insertSeparator',
      separator: { kind: 'separator', id: 'sep-late', title: 'Late', note: 'visual', color: null },
      index: 1,
    });
    const renamed = modListReducer(separated, {
      type: 'renameSeparator',
      entryId: 'sep-late',
      title: 'Late load',
    });

    expect(renamed.entries[1]).toMatchObject({ kind: 'separator', title: 'Late load' });
    expect(renamed.activeMods).toEqual(['a.core', 'b.dep']);
  });
});

describe('order model missing mod cleanup', () => {
  it('classifies missing structured entries by active state', () => {
    const current = baseModList([
      {
        kind: 'mod',
        id: 'entry-active-missing',
        active: true,
        identity: { packageId: 'missing.active' },
      },
      {
        kind: 'mod',
        id: 'entry-inactive-missing',
        active: false,
        identity: { packageId: 'missing.inactive' },
      },
      { kind: 'separator', id: 'sep-1', title: 'Visual only', note: null, color: '#888888' },
      {
        kind: 'group',
        id: 'group-mixed',
        name: 'Mixed',
        collapsed: false,
        entries: [
          { id: 'child-installed', active: true, identity: { packageId: 'a.core' } },
          { id: 'child-active-missing', active: true, identity: { packageId: 'missing.child' } },
          {
            id: 'child-inactive-missing',
            active: false,
            identity: { packageId: 'missing.inactive.child' },
          },
        ],
      },
    ]);

    const classified = classifyMissingEntries(current, catalogMods);

    expect(classified.active).toEqual(['missing.active', 'missing.child']);
    expect(classified.inactive).toEqual(['missing.inactive', 'missing.inactive.child']);

    const cleaned = removeMissingEntries(current, classified.active);

    expect(cleaned.entries).toMatchObject([
      { kind: 'mod', id: 'entry-inactive-missing', active: false },
      { kind: 'separator', id: 'sep-1' },
      {
        kind: 'group',
        id: 'group-mixed',
        entries: [
          { id: 'child-installed', active: true, identity: { packageId: 'a.core' } },
          {
            id: 'child-inactive-missing',
            active: false,
            identity: { packageId: 'missing.inactive.child' },
          },
        ],
      },
    ]);
    expect(cleaned.activeMods).toEqual(['a.core']);
  });
});
