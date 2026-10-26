import { describe, expect, it } from 'vitest';
import { baseModList } from './test-fixtures';
import { flattenModListEntries, normalizeModList } from './normalize';

describe('list normalization and game-order projection', () => {
  it('expands enabled items in their structural order and ignores separators', () => {
    const list = baseModList([
      { kind: 'mod', id: 'a', active: false, identity: { packageId: 'a' } },
      { kind: 'separator', id: 'separator', title: 'Tools' },
      {
        kind: 'group',
        id: 'group',
        name: 'Tools',
        collapsed: false,
        entries: [
          { id: 'b', active: true, identity: { packageId: 'b' } },
          { id: 'c', active: false, identity: { packageId: 'c' } },
        ],
      },
      { kind: 'mod', id: 'd', active: true, identity: { packageId: 'd' } },
    ]);
    expect(flattenModListEntries(list.entries)).toEqual(['b', 'd']);
  });
  it('normalizes package identities and keeps only the first occurrence', () => {
    const list = normalizeModList(
      baseModList([
        { kind: 'mod', id: 'first', active: true, identity: { packageId: ' Foo.Mod ' } },
        { kind: 'mod', id: 'duplicate', active: true, identity: { packageId: 'foo.mod' } },
      ]),
    );
    expect(list.entries).toEqual([
      { kind: 'mod', id: 'first', active: true, identity: { packageId: 'foo.mod' } },
    ]);
  });
  it('preserves entity IDs across repeated editing normalization', () => {
    const list = baseModList();
    const once = normalizeModList(list);
    expect(normalizeModList(once)).toEqual(once);
    expect(once.entries.map((entry) => entry.id)).toEqual(list.entries.map((entry) => entry.id));
  });
  it('preserves an empty group as persistent user structure', () => {
    const list = baseModList([
      { kind: 'group', id: 'empty', name: 'Empty', collapsed: false, entries: [] },
    ]);
    expect(normalizeModList(list)).toEqual(list);
    expect(flattenModListEntries(list.entries)).toEqual([]);
  });
});
