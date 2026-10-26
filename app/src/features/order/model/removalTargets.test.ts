import { describe, expect, it } from 'vitest';
import type { ModListEntryDto } from '@/commands';
import { removalTargets } from './removalTargets';

function modEntry(id: string): ModListEntryDto {
  return {
    kind: 'mod',
    id,
    active: true,
    identity: { packageId: id, sourceKind: 'local', sourceKey: `C:/Mods/${id}`, steamAppId: null },
  };
}

function separator(id: string): ModListEntryDto {
  return { kind: 'separator', id, title: id, note: null, color: null };
}

const entries: ModListEntryDto[] = [modEntry('a'), separator('sep'), modEntry('b'), modEntry('c')];

describe('removalTargets', () => {
  it('removes the whole selection when the clicked entry is part of it', () => {
    expect(removalTargets(entries, 'a', new Set(['a', 'b', 'c']))).toEqual({
      removeIds: [],
      deactivateIds: ['a', 'b', 'c'],
    });
  });

  it('acts on the clicked entry alone when it is outside the selection', () => {
    expect(removalTargets(entries, 'c', new Set(['a', 'b']))).toEqual({
      removeIds: [],
      deactivateIds: ['c'],
    });
  });

  it('deletes separators but only deactivates mods', () => {
    expect(removalTargets(entries, 'sep', new Set(['sep', 'b']))).toEqual({
      removeIds: ['sep'],
      deactivateIds: ['b'],
    });
  });

  it('ignores selected ids that are no longer in the list', () => {
    expect(removalTargets(entries, 'a', new Set(['a', 'gone']))).toEqual({
      removeIds: [],
      deactivateIds: ['a'],
    });
  });

  it('returns nothing for an entry that is not in the list', () => {
    expect(removalTargets(entries, 'gone', new Set())).toEqual({
      removeIds: [],
      deactivateIds: [],
    });
  });
});
