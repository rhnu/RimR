import { describe, expect, it } from 'vitest';
import { baseModList, catalogMods, mod } from '@/domain/mod-list/test-fixtures';
import { computeDropIntent } from './dnd';
import {
  resolveDragAction as resolveDrop,
  resolveDropIndicator,
  sameDropIndicator,
  type DropIndicatorState,
} from './drag-actions';
import { resolveDragSource, type DragSelection } from './drag-source';
import { dragOverlayForSource } from './drag-overlay';
import { modListReducer } from '@/domain/mod-list/reducer';
import { catalogItemKey } from '@/domain/mods/catalog';

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
        input({ activeId: 'inactive:catalog:source:local:c.extra', overId: 'active-drop' }),
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
        orderedInactiveCatalogKeys: ['source:local:/mods/broken'],
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
    const childId = modList.entries
      .flatMap((entry) => (entry.kind === 'group' ? entry.entries : []))
      .find((child) => child.identity.packageId === 'c.extra')!.id;
    const action = resolveDragAction(
      input({
        modList,
        activeId: 'active:child:group-required:child-b',
        overId: `active:child:group-required:${childId}`,
        dropIndicator: { targetId: `active:child:group-required:${childId}`, edge: 'after' },
      }),
    );

    expect(action).toEqual({
      type: 'moveGroupChild',
      groupId: 'group-required',
      childId: 'child-b',
      targetChildId: childId,
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

describe('drag overlay and drop placement', () => {
  it('uses the same visible multiselection for the preview and the drop', () => {
    const unselected = mod('d.hidden', 'Hidden');
    const visibleFirst = mod('e.first', 'Visible first');
    const catalog = [...catalogMods, unselected, visibleFirst];
    const keys = [visibleFirst, unselected, catalogMods[2]].map(catalogItemKey);
    const [firstKey, hiddenKey, grabbedKey] = keys;
    const drag = input({
      activeId: `inactive:catalog:${grabbedKey}`,
      modByCatalogKey: new Map(catalog.map((item) => [catalogItemKey(item), item])),
      selectedInactiveCatalogKeys: new Set([firstKey, hiddenKey, grabbedKey]),
      orderedInactiveCatalogKeys: [firstKey, grabbedKey],
    });
    const source = resolveDragSource(drag.activeId, drag.modList, drag);
    expect(
      dragOverlayForSource(source, {
        aliases: [],
        modByPackageId: new Map(catalog.map((item) => [item.packageId, item])),
        tagDefs: [],
        modTags: [],
      }),
    ).toMatchObject({ label: 'Visible first', count: 2 });
    expect(resolveDragAction(drag)).toMatchObject({
      type: 'addMods',
      mods: [visibleFirst, catalogMods[2]],
    });
  });

  it('previews adjacent placement when the dragged entries cannot enter a group', () => {
    const drag = input({
      activeId: 'active:entry:sep-1',
      overId: 'active:entry:group-required',
    });
    const source = resolveDragSource(drag.activeId, drag.modList, drag);
    const indicator = resolveDropIndicator(
      drag.modList,
      source,
      drag.overId,
      { top: 100, height: 30 },
      115,
    );
    expect(indicator?.edge).toBe('after');
    expect(resolveDragAction({ ...drag, dropIndicator: indicator })).toEqual({
      type: 'moveEntries',
      entryIds: ['sep-1'],
      targetEntryId: 'group-required',
      edge: 'after',
    });
  });

  it('uses draft positions for keyboard reordering when no indicator is available', () => {
    expect(
      resolveDragAction(
        input({
          activeId: 'active:entry:entry-a',
          overId: 'active:entry:group-required',
          visibleActiveEntryIds: ['entry-a'],
          dropIndicator: { targetId: 'active:entry:sep-1', edge: 'before' },
        }),
      ),
    ).toEqual({
      type: 'moveEntries',
      entryIds: ['entry-a'],
      targetEntryId: 'group-required',
      edge: 'after',
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

type ResolveDragActionInput = DragSelection & {
  activeId: string;
  overId: string;
  modList: ReturnType<typeof baseModList>;
  dropIndicator: DropIndicatorState | null;
};

function resolveDragAction(input: ResolveDragActionInput) {
  const { activeId, overId, modList, dropIndicator } = input;
  return resolveDrop(modList, resolveDragSource(activeId, modList, input), overId, dropIndicator);
}

function input(overrides: Partial<ResolveDragActionInput>): ResolveDragActionInput {
  return {
    activeId: 'inactive:catalog:source:local:c.extra',
    overId: 'active-drop',
    modList: baseModList(),
    modByCatalogKey: new Map(catalogMods.map((item) => [catalogItemKey(item), item])),
    selectedInactiveCatalogKeys: new Set(),
    orderedInactiveCatalogKeys: ['source:local:c.extra'],
    selectedEntryIds: new Set(),
    visibleActiveEntryIds: ['entry-a', 'group-required'],
    dropIndicator: null,
    ...overrides,
  };
}
