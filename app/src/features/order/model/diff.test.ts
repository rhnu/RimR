import { describe, expect, it } from 'vitest';
import type { ModMetadataDto } from '@/commands';
import {
  buildApplyProjection,
  buildOrderDiff,
  buildUnifiedDiff,
  buildUnifiedDiffHunks,
} from './diff';
import { baseModList, catalogMods, mod } from './testFixtures';
import { normalizeModList } from './normalize';

describe('order model diff', () => {
  it('reports added, removed, and moved packages using common subsequence stability', () => {
    const diff = buildOrderDiff(['a.core', 'b.dep', 'c.extra'], ['c.extra', 'a.core', 'd.new'], []);

    expect(diff.items).toEqual([
      { kind: 'added', packageId: 'd.new', toIndex: 2 },
      { kind: 'removed', packageId: 'b.dep', fromIndex: 1 },
      { kind: 'moved', packageId: 'c.extra', fromIndex: 2, toIndex: 0 },
    ]);
  });

  it('passes through structural events and reports noChange for identical orders', () => {
    const diff = buildOrderDiff(
      ['a.core'],
      ['a.core'],
      [
        { kind: 'groupSplit', groupName: 'Gameplay', packageIds: ['a.core', 'b.dep'] },
        { kind: 'missingSkipped', packageId: 'missing.mod', label: 'Missing Mod' },
      ],
    );

    expect(diff.items).toEqual([
      { kind: 'groupSplit', groupName: 'Gameplay', packageIds: ['a.core', 'b.dep'] },
      { kind: 'missingSkipped', packageId: 'missing.mod', label: 'Missing Mod' },
    ]);
  });

  it('builds an apply projection that skips active packages missing from the catalog', () => {
    const modList = normalizeModList({
      ...baseModList(),
      entries: [
        { kind: 'mod', id: 'entry-a', active: true, identity: { packageId: 'a.core' } },
        { kind: 'mod', id: 'entry-missing', active: true, identity: { packageId: 'missing.mod' } },
        {
          kind: 'group',
          id: 'group-1',
          name: 'Mixed',
          collapsed: false,
          entries: [
            { id: 'child-b', active: false, identity: { packageId: 'b.dep' } },
            { id: 'child-c', active: true, identity: { packageId: 'c.extra' } },
          ],
        },
      ],
    });
    const catalog = new Map<string, ModMetadataDto>(
      [...catalogMods, mod('d.other', 'Other')].map((item) => [item.packageId, item]),
    );

    const projection = buildApplyProjection(modList, catalog);

    expect(projection.activeMods).toEqual(['a.core', 'c.extra']);
    expect(projection.events).toEqual([
      { kind: 'missingSkipped', packageId: 'missing.mod', label: 'missing.mod' },
    ]);
  });
});

describe('buildUnifiedDiff', () => {
  it('emits only context rows when before and after are identical', () => {
    const rows = buildUnifiedDiff(['a.core', 'b.dep', 'c.extra'], ['a.core', 'b.dep', 'c.extra']);

    expect(rows).toEqual([
      { type: 'context', packageId: 'a.core', afterIndex: 0 },
      { type: 'context', packageId: 'b.dep', afterIndex: 1 },
      { type: 'context', packageId: 'c.extra', afterIndex: 2 },
    ]);
  });

  it('emits added and removed rows with deterministic LCS anchoring', () => {
    const rows = buildUnifiedDiff(['a.core', 'b.dep'], ['a.core', 'c.extra']);

    expect(rows).toEqual([
      { type: 'context', packageId: 'a.core', afterIndex: 0 },
      { type: 'removed', packageId: 'b.dep', beforeIndex: 1 },
      { type: 'added', packageId: 'c.extra', afterIndex: 1 },
    ]);
  });

  it('emits a single moved row at the new position and never emits removed for moved packages', () => {
    const rows = buildUnifiedDiff(['a.core', 'b.dep', 'c.extra'], ['c.extra', 'a.core', 'd.new']);

    const moved = rows.filter((row) => row.type === 'moved');
    const removed = rows.filter((row) => row.type === 'removed');
    const added = rows.filter((row) => row.type === 'added');

    expect(removed).toEqual([{ type: 'removed', packageId: 'b.dep', beforeIndex: 1 }]);
    expect(added).toEqual([{ type: 'added', packageId: 'd.new', afterIndex: 2 }]);
    expect(moved).toHaveLength(1);
    expect(moved[0]).toMatchObject({ type: 'moved', packageId: 'c.extra' });
    expect((moved[0] as Extract<(typeof moved)[number], { type: 'moved' }>).fromIndex).toBe(2);
    expect((moved[0] as Extract<(typeof moved)[number], { type: 'moved' }>).toIndex).toBe(0);
    expect(rows.some((row) => row.type === 'removed' && row.packageId === 'c.extra')).toBe(false);
  });

  it('emits an empty row list when both orders are empty', () => {
    expect(buildUnifiedDiff([], [])).toEqual([]);
  });
});

describe('buildUnifiedDiffHunks', () => {
  it('returns a single rows segment when there are no changes', () => {
    const rows = buildUnifiedDiff(['a.core', 'b.dep', 'c.extra'], ['a.core', 'b.dep', 'c.extra']);
    expect(buildUnifiedDiffHunks(rows)).toEqual([{ type: 'rows', rows }]);
  });

  it('returns an empty segment list for empty input', () => {
    expect(buildUnifiedDiffHunks([])).toEqual([]);
  });

  it('folds unchanged context between two distant changes into a skip segment', () => {
    const before = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const after = ['X', 'b', 'c', 'd', 'e', 'f', 'g', 'Y'];
    const rows = buildUnifiedDiff(before, after);

    const segments = buildUnifiedDiffHunks(rows, 1);

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ type: 'rows' });
    expect(segments[1]).toMatchObject({ type: 'skip' });
    expect(segments[2]).toMatchObject({ type: 'rows' });
    const firstRows = segments[0] as Extract<(typeof segments)[number], { type: 'rows' }>;
    const lastRows = segments[2] as Extract<(typeof segments)[number], { type: 'rows' }>;
    const skip = segments[1] as Extract<(typeof segments)[number], { type: 'skip' }>;
    expect(firstRows.rows[0]).toMatchObject({ type: 'removed', packageId: 'a' });
    expect(lastRows.rows[lastRows.rows.length - 1]).toMatchObject({
      type: 'added',
      packageId: 'Y',
    });
    expect(skip.hiddenCount).toBe(4);
  });

  it('merges adjacent change windows so no skip appears between nearby changes', () => {
    const before = ['a', 'b', 'c', 'd'];
    const after = ['X', 'b', 'c', 'Y'];
    const rows = buildUnifiedDiff(before, after);

    const segments = buildUnifiedDiffHunks(rows, 1);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual({ type: 'rows', rows });
  });

  it('emits a trailing skip when changes sit near the start', () => {
    const before = ['a', 'b', 'c', 'd', 'e'];
    const after = ['X', 'b', 'c', 'd', 'e'];
    const rows = buildUnifiedDiff(before, after);

    const segments = buildUnifiedDiffHunks(rows, 1);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ type: 'rows' });
    expect(segments[1]).toMatchObject({ type: 'skip' });
    const skip = segments[1] as Extract<(typeof segments)[number], { type: 'skip' }>;
    expect(skip.hiddenCount).toBe(3);
  });
});
