import { describe, expect, it } from 'vitest';
import type { ModListEntryDto } from '@/commands';
import { baseModList } from './testFixtures';
import { flattenModListEntries, normalizeModList } from './normalize';

describe('order model normalization', () => {
  it('flattens top-level mods and group children while ignoring separators', () => {
    expect(flattenModListEntries(baseModList().entries)).toEqual(['a.core', 'b.dep']);
  });

  it('preserves inactive entries and derives activeMods from active items only', () => {
    const normalized = normalizeModList(
      baseModList([
        {
          kind: 'mod',
          id: 'entry-a',
          active: false,
          identity: { packageId: 'a.core' },
        },
        {
          kind: 'mod',
          id: 'entry-c',
          identity: { packageId: 'c.extra' },
        },
        {
          kind: 'group',
          id: 'group-1',
          name: 'Mixed',
          collapsed: false,
          entries: [
            { id: 'child-b', active: true, identity: { packageId: 'b.dep' } },
            { id: 'child-missing', active: false, identity: { packageId: 'missing.mod' } },
          ],
        },
      ] as ModListEntryDto[]),
    );

    expect(normalized.entries).toMatchObject([
      { kind: 'mod', id: 'entry-a', active: false },
      { kind: 'mod', id: 'entry-c', active: true },
      {
        kind: 'group',
        id: 'group-1',
        entries: [
          { id: 'child-b', active: true },
          { id: 'child-missing', active: false },
        ],
      },
    ]);
    expect(normalized.activeMods).toEqual(['c.extra', 'b.dep']);
  });

  it('recomputes activeMods from normalized entries', () => {
    const normalized = normalizeModList({
      ...baseModList(),
      activeMods: ['stale.package'],
    });

    expect(normalized.activeMods).toEqual(['a.core', 'b.dep']);
  });

  it('preserves empty groups because groups are persistent user structure', () => {
    const normalized = normalizeModList(
      baseModList([
        { kind: 'separator', id: 'sep-1', title: 'Tools', note: null, color: null },
        { kind: 'group', id: 'empty-group', name: 'Empty', collapsed: false, entries: [] },
      ]),
    );

    expect(normalized.entries).toEqual([
      { kind: 'separator', id: 'sep-1', title: 'Tools', note: null, color: null },
      { kind: 'group', id: 'empty-group', name: 'Empty', collapsed: false, entries: [] },
    ]);
    expect(normalized.activeMods).toEqual([]);
  });

  it('keeps the first package occurrence and drops later duplicates', () => {
    const normalized = normalizeModList(
      baseModList([
        { kind: 'mod', id: 'entry-a', active: true, identity: { packageId: 'a.core' } },
        { kind: 'mod', id: 'entry-a-copy', active: true, identity: { packageId: 'a.core' } },
        {
          kind: 'group',
          id: 'group-1',
          name: 'Duplicate group',
          collapsed: false,
          entries: [{ id: 'child-a', active: true, identity: { packageId: 'a.core' } }],
        },
      ]),
    );

    expect(normalized.entries).toEqual([
      { kind: 'mod', id: 'entry-a', active: true, identity: { packageId: 'a.core' } },
      {
        kind: 'group',
        id: 'group-1',
        name: 'Duplicate group',
        collapsed: false,
        entries: [],
      },
    ]);
    expect(normalized.activeMods).toEqual(['a.core']);
  });

  it('repairs duplicate entry and child ids without changing load order', () => {
    const normalized = normalizeModList(
      baseModList([
        { kind: 'mod', id: 'entry-a', active: true, identity: { packageId: 'a.core' } },
        { kind: 'separator', id: 'entry-a', title: 'Divider', note: null, color: null },
        {
          kind: 'group',
          id: 'group-1',
          name: 'Grouped',
          collapsed: false,
          entries: [
            { id: 'child-x', active: true, identity: { packageId: 'b.dep' } },
            { id: 'child-x', active: true, identity: { packageId: 'c.extra' } },
          ],
        },
      ]),
    );

    expect(normalized.entries.map((entry) => entry.id)).toEqual([
      'entry-a',
      'entry-a-2',
      'group-1',
    ]);
    expect(normalized.entries[2]).toMatchObject({
      kind: 'group',
      entries: [{ id: 'child-x' }, { id: 'child-x-2' }],
    });
    expect(normalized.activeMods).toEqual(['a.core', 'b.dep', 'c.extra']);
  });
});
