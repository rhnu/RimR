import { describe, expect, it } from 'vitest';
import { baseModList, catalogMods, mod } from './testFixtures';
import { computeDropIntent } from './dnd';
import { resolveDragAction, sameDropIndicator, type ResolveDragActionInput } from './dragActions';
import { modListReducer } from './reducer';
import { catalogItemKey } from './catalogItemKey';

describe('sameDropIndicator', () => {
  it('compares drop indicators by target and edge', () => {
    expect(sameDropIndicator(null, null)).toBe(true);
    expect(
      sameDropIndicator(
        { targetId: 'active:entry:entry-a', edge: 'before' },
        { targetId: 'active:entry:entry-a', edge: 'before' },
      ),
    ).toBe(true);
    expect(
      sameDropIndicator(
        { targetId: 'active:entry:entry-a', edge: 'before' },
        { targetId: 'active:entry:entry-b', edge: 'before' },
      ),
    ).toBe(false);
    expect(
      sameDropIndicator(
        { targetId: 'active:entry:entry-a', edge: 'before' },
        { targetId: 'active:entry:entry-a', edge: 'after' },
      ),
    ).toBe(false);
    expect(sameDropIndicator({ targetId: 'active:entry:entry-a', edge: 'before' }, null)).toBe(
      false,
    );
  });
});

describe('order model drag actions basics', () => {
  it('computes before, inside-group, and after drop intents from pointer position', () => {
    const rect = { top: 100, height: 90 };

    expect(computeDropIntent('active', 'row-1', rect, 110, false)).toEqual({
      containerId: 'active',
      targetId: 'row-1',
      edge: 'before',
    });
    expect(computeDropIntent('active', 'group-1', rect, 145, true)).toEqual({
      containerId: 'active',
      targetId: 'group-1',
      edge: 'inside',
    });
    expect(computeDropIntent('active', 'row-1', rect, 185, false)).toEqual({
      containerId: 'active',
      targetId: 'row-1',
      edge: 'after',
    });
  });

  it('adds inactive mods to the active list drop zone', () => {
    expect(
      resolveDragAction(
        input({ activeId: 'inactive:catalog:package:c.extra', overId: 'active-drop' }),
      ),
    ).toMatchObject({
      type: 'addMods',
      mods: [{ packageId: 'c.extra' }],
      index: 3,
    });
  });

  it('ignores invalid inactive catalog drops onto active targets', () => {
    const invalid = mod('missing.packageid', 'Broken', {
      sourceKey: 'local:/mods/broken',
      valid: false,
    });
    const action = resolveDragAction(
      input({
        activeId: 'inactive:catalog:source:local:/mods/broken',
        modByCatalogKey: new Map([['source:local:/mods/broken', invalid]]),
        inactivePackageIds: ['source:local:/mods/broken'],
      }),
    );

    expect(action).toBeNull();
  });

  it('moves selected top-level mod entries into a group when dropped inside the group row', () => {
    const action = resolveDragAction(
      input({
        activeId: 'active:entry:entry-a',
        overId: 'active:entry:group-required',
        selectedEntryIds: new Set(['entry-a']),
        visibleActiveEntryIds: ['entry-a'],
        dropIndicator: { targetId: 'active:entry:group-required', edge: 'inside' },
      }),
    );

    expect(action).toEqual({
      type: 'moveEntriesToGroup',
      entryIds: ['entry-a'],
      groupId: 'group-required',
      index: 1,
    });
  });

  it('reorders children within their current group', () => {
    const modList = modListReducer(baseModList(), {
      type: 'addModToGroup',
      groupId: 'group-required',
      mod: catalogMods[2],
      index: 1,
    });
    const action = resolveDragAction(
      input({
        modList,
        activeId: 'active:child:group-required:child-b',
        overId: 'active:child:group-required:child-c-extra',
        dropIndicator: { targetId: 'active:child:group-required:child-c-extra', edge: 'after' },
      }),
    );

    expect(action).toEqual({
      type: 'moveGroupChild',
      groupId: 'group-required',
      childId: 'child-b',
      targetChildId: 'child-c-extra',
      edge: 'after',
    });
  });

  it('deactivates active entries when dropped onto the inactive panel', () => {
    const action = resolveDragAction(
      input({
        activeId: 'active:entry:entry-a',
        overId: 'inactive-drop',
        selectedEntryIds: new Set(['entry-a', 'group-required']),
        visibleActiveEntryIds: ['entry-a', 'group-required'],
      }),
    );

    expect(action).toEqual({
      type: 'setEntriesActive',
      entryIds: ['entry-a', 'group-required'],
      active: false,
    });
  });
});

describe('order model inactive entry drag actions', () => {
  it('activates inactive structured entries dropped on active rows at the drop target', () => {
    const action = resolveDragAction(
      input({
        activeId: 'inactive:entry:entry-a',
        overId: 'active:entry:group-required',
        dropIndicator: { targetId: 'active:entry:group-required', edge: 'after' },
      }),
    );

    expect(action).toEqual({
      type: 'moveEntriesAndSetActive',
      entryIds: ['entry-a'],
      targetEntryId: 'group-required',
      edge: 'after',
      active: true,
    });
  });

  it('activates inactive mod entries dropped inside active groups', () => {
    const action = resolveDragAction(
      input({
        activeId: 'inactive:entry:entry-a',
        overId: 'active:entry:group-required',
        dropIndicator: { targetId: 'active:entry:group-required', edge: 'inside' },
      }),
    );

    expect(action).toEqual({
      type: 'moveEntriesToGroupAndSetActive',
      entryIds: ['entry-a'],
      groupId: 'group-required',
      index: 1,
      active: true,
    });
  });

  it('activates inactive structured group children dropped on active', () => {
    const action = resolveDragAction(
      input({
        activeId: 'inactive:child:group-required:child-b',
        overId: 'active-drop',
      }),
    );

    expect(action).toEqual({
      type: 'setGroupChildrenActiveAndMoveGroup',
      groupId: 'group-required',
      childIds: ['child-b'],
      active: true,
      index: 3,
    });
  });
});

function input(overrides: Partial<ResolveDragActionInput>): ResolveDragActionInput {
  return {
    activeId: 'inactive:catalog:package:c.extra',
    overId: 'active-drop',
    modList: baseModList(),
    modByPackageId: new Map(catalogMods.map((item) => [item.packageId, item])),
    modByCatalogKey: new Map(catalogMods.map((item) => [catalogItemKey(item), item])),
    selectedInactivePackageIds: new Set(),
    inactivePackageIds: ['package:c.extra'],
    selectedEntryIds: new Set(),
    visibleActiveEntryIds: ['entry-a', 'group-required'],
    dropIndicator: null,
    ...overrides,
  };
}
