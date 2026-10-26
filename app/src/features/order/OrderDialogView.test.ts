import { describe, expect, it } from 'vitest';
import type { OrderDiff } from './model';
import { baseModList } from './model/testFixtures';
import { getOrderDialogViewModel } from './OrderDialogView';

describe('OrderDialogView model', () => {
  it('uses only the dialog description for discard draft confirmation text', () => {
    const model = getOrderDialogViewModel({ kind: 'discardDraft' }, true);

    expect(model.descriptionKey).toBe('order.dialog.discardDraftDesc');
    expect(model.body.kind).toBe('none');
    expect(model.submitLabelKey).toBe('order.discardDraft');
  });

  it('carries the full OrderDiff in the diffConfirm apply body for the unified view', () => {
    const diff: OrderDiff = {
      before: ['a.core', 'b.dep'],
      after: ['b.dep', 'c.extra'],
      items: [
        { kind: 'added', packageId: 'c.extra', toIndex: 1 },
        { kind: 'removed', packageId: 'a.core', fromIndex: 0 },
      ],
    };
    const model = getOrderDialogViewModel(
      { kind: 'diffConfirm', action: 'apply', modList: baseModList(), diff },
      true,
    );

    expect(model.body).toEqual({ kind: 'diff', diff });
  });

  it('carries the full OrderDiff in the diffConfirm syncFromGame body', () => {
    const diff: OrderDiff = {
      before: ['a.core'],
      after: ['a.core'],
      items: [{ kind: 'noChange' }],
    };
    const model = getOrderDialogViewModel(
      {
        kind: 'diffConfirm',
        action: 'syncFromGame',
        result: { modList: baseModList(), diff },
        diff,
      },
      true,
    );

    expect(model.body).toEqual({ kind: 'diff', diff });
    expect(model.submitLabelKey).toBe('order.syncFromGame');
  });
});
