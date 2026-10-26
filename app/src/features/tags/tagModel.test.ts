import { describe, expect, it } from 'vitest';
import type { ModIdentityDto, ModTagBindingDto, TagDefDto } from '@/commands';
import {
  colorsForIdentity,
  createTagDef,
  defById,
  findBinding,
  removeTagDef,
  renameTagDef,
  reorderModTags,
  setTagDefColor,
  tagIdsForIdentities,
  tagIdsForIdentity,
  toggleModTagForIdentities,
  toggleModTag,
  upsertModTags,
  upsertTagDef,
} from './tagModel';

const ident = (packageId: string): ModIdentityDto => ({
  packageId,
  sourceKind: 'local',
  sourceKey: `local:${packageId}`,
  steamAppId: null,
});

const def = (id: string, name: string, color?: string): TagDefDto => ({
  id,
  name,
  ...(color !== undefined ? { color } : {}),
});

const binding = (identity: ModIdentityDto, tagIds: string[]): ModTagBindingDto => ({
  identity,
  tagIds,
});

describe('findBinding', () => {
  it('finds a binding matching the identity', () => {
    const a = ident('a.mod');
    const bindings = [binding(a, ['t1'])];
    expect(findBinding(bindings, a)?.tagIds).toEqual(['t1']);
  });

  it('returns undefined when no binding matches', () => {
    expect(findBinding([binding(ident('a.mod'), ['t1'])], ident('b.mod'))).toBeUndefined();
  });
});

describe('tagIdsForIdentity', () => {
  it('returns tag ids for a bound identity', () => {
    const a = ident('a.mod');
    expect(tagIdsForIdentity([binding(a, ['t1', 't2'])], a)).toEqual(['t1', 't2']);
  });

  it('returns an empty array when there is no binding', () => {
    expect(tagIdsForIdentity([], ident('a.mod'))).toEqual([]);
  });
});

describe('tagIdsForIdentities', () => {
  it('returns only tags shared by all identities in first identity order', () => {
    const a = ident('a.mod');
    const b = ident('b.mod');
    const bindings = [binding(a, ['t2', 't1', 't3']), binding(b, ['t3', 't2'])];
    expect(tagIdsForIdentities(bindings, [a, b])).toEqual(['t2', 't3']);
  });

  it('deduplicates identities before computing shared tags', () => {
    const a = ident('a.mod');
    expect(tagIdsForIdentities([binding(a, ['t1'])], [a, a])).toEqual(['t1']);
  });

  it('returns an empty array when there are no identities', () => {
    expect(tagIdsForIdentities([binding(ident('a.mod'), ['t1'])], [])).toEqual([]);
  });
});

describe('colorsForIdentity', () => {
  it('returns colors of bound tags in tag order, skipping colorless tags', () => {
    const a = ident('a.mod');
    const defs: TagDefDto[] = [
      def('t1', 'Red', '#ef4444'),
      def('t2', 'Plain'),
      def('t3', 'Green', '#22c55e'),
    ];
    const bindings = [binding(a, ['t3', 't2', 't1'])];
    expect(colorsForIdentity(bindings, defs, a)).toEqual(['#22c55e', '#ef4444']);
  });

  it('returns an empty array when there is no binding', () => {
    expect(colorsForIdentity([], [def('t1', 'Red', '#ef4444')], ident('a.mod'))).toEqual([]);
  });
});

describe('upsertModTags', () => {
  it('adds a new binding when tagIds is non-empty', () => {
    const a = ident('a.mod');
    const result = upsertModTags([], a, ['t1', 't2']);
    expect(result).toEqual([binding(a, ['t1', 't2'])]);
  });

  it('replaces an existing binding for the same identity', () => {
    const a = ident('a.mod');
    const result = upsertModTags([binding(a, ['t1'])], a, ['t2', 't3']);
    expect(result).toEqual([binding(a, ['t2', 't3'])]);
  });

  it('removes the binding when tagIds is empty', () => {
    const a = ident('a.mod');
    const result = upsertModTags([binding(a, ['t1'])], a, []);
    expect(result).toEqual([]);
  });

  it('preserves other identities bindings', () => {
    const a = ident('a.mod');
    const b = ident('b.mod');
    const result = upsertModTags([binding(a, ['t1']), binding(b, ['t2'])], a, ['t3']);
    expect(result).toEqual([binding(b, ['t2']), binding(a, ['t3'])]);
  });
});

describe('toggleModTag', () => {
  it('adds a tag when not bound, creating a new binding', () => {
    const a = ident('a.mod');
    expect(toggleModTag([], a, 't1')).toEqual([binding(a, ['t1'])]);
  });

  it('adds a tag to an existing binding', () => {
    const a = ident('a.mod');
    expect(toggleModTag([binding(a, ['t1'])], a, 't2')).toEqual([binding(a, ['t1', 't2'])]);
  });

  it('removes a tag from a binding but keeps the binding when other tags remain', () => {
    const a = ident('a.mod');
    expect(toggleModTag([binding(a, ['t1', 't2'])], a, 't1')).toEqual([binding(a, ['t2'])]);
  });

  it('deletes the binding when the removed tag was the only one', () => {
    const a = ident('a.mod');
    expect(toggleModTag([binding(a, ['t1'])], a, 't1')).toEqual([]);
  });
});

describe('toggleModTagForIdentities', () => {
  it('adds the tag to every selected identity when the selection is mixed', () => {
    const a = ident('a.mod');
    const b = ident('b.mod');
    const result = toggleModTagForIdentities([binding(a, ['t1'])], [a, b], 't1');
    expect(result).toEqual([binding(a, ['t1']), binding(b, ['t1'])]);
  });

  it('removes the tag from every selected identity when all selected identities have it', () => {
    const a = ident('a.mod');
    const b = ident('b.mod');
    const result = toggleModTagForIdentities(
      [binding(a, ['t1', 't2']), binding(b, ['t1'])],
      [a, b],
      't1',
    );
    expect(result).toEqual([binding(a, ['t2'])]);
  });

  it('adds the tag without duplicating it on identities that already have it', () => {
    const a = ident('a.mod');
    const b = ident('b.mod');
    const result = toggleModTagForIdentities(
      [binding(a, ['t1']), binding(b, ['t2'])],
      [a, b],
      't1',
    );
    expect(result).toEqual([binding(a, ['t1']), binding(b, ['t2', 't1'])]);
  });

  it('leaves bindings unchanged when there are no identities', () => {
    const bindings = [binding(ident('a.mod'), ['t1'])];
    expect(toggleModTagForIdentities(bindings, [], 't1')).toBe(bindings);
  });
});

describe('reorderModTags', () => {
  it('replaces the tag order for an identity', () => {
    const a = ident('a.mod');
    const result = reorderModTags([binding(a, ['t1', 't2'])], a, ['t2', 't1']);
    expect(result).toEqual([binding(a, ['t2', 't1'])]);
  });

  it('removes the binding when given an empty order', () => {
    const a = ident('a.mod');
    expect(reorderModTags([binding(a, ['t1'])], a, [])).toEqual([]);
  });
});

describe('upsertTagDef', () => {
  it('adds a new def when the id is absent', () => {
    const result = upsertTagDef([def('t1', 'Red')], def('t2', 'Blue', '#3b82f6'));
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(def('t2', 'Blue', '#3b82f6'));
  });

  it('replaces an existing def with the same id', () => {
    const result = upsertTagDef([def('t1', 'Red', '#ef4444')], def('t1', 'Crimson', '#dc2626'));
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(def('t1', 'Crimson', '#dc2626'));
  });
});

describe('renameTagDef', () => {
  it('renames the matching def and leaves others untouched', () => {
    const result = renameTagDef([def('t1', 'Red'), def('t2', 'Blue')], 't1', 'Crimson');
    expect(result).toEqual([def('t1', 'Crimson'), def('t2', 'Blue')]);
  });

  it('is a no-op when the id is absent', () => {
    const defs = [def('t1', 'Red')];
    expect(renameTagDef(defs, 'missing', 'X')).toEqual(defs);
  });
});

describe('setTagDefColor', () => {
  it('sets a color on the matching def', () => {
    const result = setTagDefColor([def('t1', 'Red')], 't1', '#ef4444');
    expect(result[0].color).toBe('#ef4444');
  });

  it('replaces an existing color', () => {
    const result = setTagDefColor([def('t1', 'Red', '#ef4444')], 't1', '#dc2626');
    expect(result[0].color).toBe('#dc2626');
  });

  it('clears the color when passed null', () => {
    const result = setTagDefColor([def('t1', 'Red', '#ef4444')], 't1', null);
    expect(result[0].color).toBeUndefined();
  });
});

describe('removeTagDef', () => {
  it('removes the def from the defs array', () => {
    const { defs } = removeTagDef([def('t1', 'Red'), def('t2', 'Blue')], 't1');
    expect(defs).toEqual([def('t2', 'Blue')]);
  });

  it('returns a cleanup function that strips the id from all bindings', () => {
    const a = ident('a.mod');
    const b = ident('b.mod');
    const { bindings } = removeTagDef([], 't1');
    const result = bindings([
      binding(a, ['t1', 't2']),
      binding(b, ['t1']),
      binding(ident('c.mod'), ['t3']),
    ]);
    expect(result).toEqual([binding(a, ['t2']), binding(ident('c.mod'), ['t3'])]);
  });

  it('deletes bindings that become empty after cleanup', () => {
    const a = ident('a.mod');
    const { bindings } = removeTagDef([], 't1');
    expect(bindings([binding(a, ['t1'])])).toEqual([]);
  });

  it('removes the def and cleans bindings together', () => {
    const a = ident('a.mod');
    const { defs, bindings } = removeTagDef([def('t1', 'Red'), def('t2', 'Blue')], 't1');
    expect(defs).toEqual([def('t2', 'Blue')]);
    expect(bindings([binding(a, ['t1', 't2'])])).toEqual([binding(a, ['t2'])]);
  });
});

describe('createTagDef', () => {
  it('creates a def with a uuid id, name, and color', () => {
    const created = createTagDef('Red', '#ef4444');
    expect(created.name).toBe('Red');
    expect(created.color).toBe('#ef4444');
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('treats a null color as undefined', () => {
    expect(createTagDef('Plain', null).color).toBeUndefined();
  });
});

describe('defById', () => {
  it('finds a def by id', () => {
    expect(defById([def('t1', 'Red')], 't1')?.name).toBe('Red');
  });

  it('returns undefined when the id is absent', () => {
    expect(defById([def('t1', 'Red')], 'missing')).toBeUndefined();
  });
});
