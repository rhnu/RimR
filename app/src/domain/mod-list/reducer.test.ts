import { describe, expect, it } from 'vitest';
import { baseModList, catalogMods, mod } from './test-fixtures';
import { flattenModListEntries } from './normalize';
import {
  modListReducer,
  classifyMissingEntries,
  removeMissingEntries,
  unintroducedMods,
} from './reducer';

const generatedId = 'f23e1419-0a57-4c52-8d41-d0e089091c9b';
const generate = () => generatedId;

describe('mod-list editing', () => {
  it('adds a valid mod at the requested position and rejects duplicate packages', () => {
    const next = modListReducer(
      baseModList(),
      { type: 'addMods', mods: [catalogMods[2], catalogMods[0]], index: 1 },
      generate,
    );
    expect(flattenModListEntries(next.entries)).toEqual(['a.core', 'c.extra', 'b.dep']);
    expect(next.entries[1]).toMatchObject({ id: generatedId, identity: { packageId: 'c.extra' } });
  });
  it('does not allow malformed catalog entries into a list', () => {
    const broken = mod('missing.packageid', 'Broken', { valid: false });
    const next = modListReducer(baseModList(), { type: 'addMod', mod: broken, index: 0 }, generate);
    expect(next).toEqual(baseModList());
  });
  it('groups and ungroups entries without changing their identities', () => {
    const next = modListReducer(
      baseModList(),
      { type: 'addMod', mod: catalogMods[2], index: 1 },
      generate,
    );
    const grouped = modListReducer(next, {
      type: 'createGroup',
      entryIds: ['entry-a', generatedId],
      groupId: 'group',
      name: 'Pair',
    });
    expect(grouped.entries[0]).toMatchObject({
      kind: 'group',
      entries: [{ id: 'entry-a' }, { id: generatedId }],
    });
    const ungrouped = modListReducer(grouped, { type: 'ungroup', groupId: 'group' });
    expect(ungrouped.entries.slice(0, 2).map((entry) => entry.id)).toEqual([
      'entry-a',
      generatedId,
    ]);
    expect(flattenModListEntries(ungrouped.entries)).toEqual(['a.core', 'c.extra', 'b.dep']);
  });
  it('preserves empty groups when removing their last child', () => {
    const next = modListReducer(baseModList(), {
      type: 'removeGroupChild',
      groupId: 'group-required',
      childId: 'child-b',
    });
    expect(next.entries[2]).toMatchObject({ kind: 'group', entries: [] });
    expect(flattenModListEntries(next.entries)).toEqual(['a.core']);
  });
  it('reactivates a group child and moves a previously inactive group', () => {
    const disabled = modListReducer(baseModList(), {
      type: 'setEntryActive',
      entryId: 'group-required',
      active: false,
    });
    const next = modListReducer(disabled, {
      type: 'setGroupChildrenActiveAndMoveGroup',
      groupId: 'group-required',
      childIds: ['child-b'],
      active: true,
      index: 0,
    });
    expect(next.entries[0].id).toBe('group-required');
    expect(flattenModListEntries(next.entries)).toEqual(['b.dep', 'a.core']);
  });
  it('does not list structured inactive mods as new catalog additions', () => {
    const inactive = modListReducer(baseModList(), {
      type: 'setEntriesActive',
      entryIds: ['entry-a', 'group-required'],
      active: false,
    });
    expect(unintroducedMods(catalogMods, inactive).map((item) => item.packageId)).toEqual([
      'c.extra',
    ]);
  });
  it('classifies missing enabled and disabled entries before explicit removal', () => {
    const list = baseModList([
      { kind: 'mod', id: 'a', active: true, identity: { packageId: 'missing.active' } },
      { kind: 'mod', id: 'b', active: false, identity: { packageId: 'missing.inactive' } },
      { kind: 'group', id: 'g', name: 'Retained', collapsed: false, entries: [] },
    ]);
    expect(classifyMissingEntries(list, [])).toEqual({
      active: ['missing.active'],
      inactive: ['missing.inactive'],
    });
    expect(removeMissingEntries(list, ['missing.active']).entries).toEqual(list.entries.slice(1));
  });
});
