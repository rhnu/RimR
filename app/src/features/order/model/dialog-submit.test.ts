import { describe, expect, it, vi } from 'vitest';
import type { ModIdentityDto } from '@/commands';
import { baseModList } from '@/domain/mod-list/test-fixtures';
import { submitOrderDialog, type DialogSubmitActions } from './dialog-submit';

const identity: ModIdentityDto = {
  packageId: 'foo.bar',
  sourceKind: 'local',
  sourceKey: 'local:foo.bar',
  steamAppId: null,
};

function actions(): DialogSubmitActions {
  return {
    applyDraft: vi.fn<DialogSubmitActions['applyDraft']>(),
    onSaveAlias: vi.fn<DialogSubmitActions['onSaveAlias']>(),
    onApplyGameSync: vi.fn<DialogSubmitActions['onApplyGameSync']>(),
    onApplySaveSync: vi.fn<DialogSubmitActions['onApplySaveSync']>(),
    onApplyToGame: vi.fn<DialogSubmitActions['onApplyToGame']>(),
    onRemoveMissingMods: vi.fn<DialogSubmitActions['onRemoveMissingMods']>(),
    onDiscardDraft: vi.fn<DialogSubmitActions['onDiscardDraft']>(),
    createActiveGroup: vi.fn<DialogSubmitActions['createActiveGroup']>(),
    createInactiveGroup: vi.fn<DialogSubmitActions['createInactiveGroup']>(),
  };
}

it('applies the draft shown in the preview without editing or saving the list', () => {
  const draft = baseModList();
  const submitActions = actions();

  submitOrderDialog(
    {
      kind: 'diffConfirm',
      action: 'apply',
      modList: draft,
      catalogRevision: 2,
      diff: { before: [], after: [], items: [] },
    },
    '',
    submitActions,
  );

  expect(submitActions.onApplyToGame).toHaveBeenCalledExactlyOnceWith(draft);
  expect(submitActions.applyDraft).not.toHaveBeenCalled();
});

describe('submitOrderDialog alias editing', () => {
  it('removes an existing alias when the submitted value is empty', () => {
    const submitActions = actions();

    submitOrderDialog(
      {
        kind: 'editAlias',
        identity,
        value: 'Custom Name',
        baseValue: 'Original Name',
        initialValue: 'Custom Name',
        hadAlias: true,
      },
      '',
      submitActions,
    );

    expect(submitActions.onSaveAlias).toHaveBeenCalledWith(identity, '');
  });

  it('does not save when an item without an alias is submitted empty', () => {
    const submitActions = actions();

    submitOrderDialog(
      {
        kind: 'editAlias',
        identity,
        value: 'Original Name',
        baseValue: 'Original Name',
        initialValue: 'Original Name',
        hadAlias: false,
      },
      '',
      submitActions,
    );

    expect(submitActions.onSaveAlias).not.toHaveBeenCalled();
  });

  it('saves a changed non-empty alias', () => {
    const submitActions = actions();

    submitOrderDialog(
      {
        kind: 'editAlias',
        identity,
        value: 'Custom Name',
        baseValue: 'Original Name',
        initialValue: 'Custom Name',
        hadAlias: true,
      },
      'New Name',
      submitActions,
    );

    expect(submitActions.onSaveAlias).toHaveBeenCalledWith(identity, 'New Name');
  });

  it('does not save when the submitted alias has not changed', () => {
    const submitActions = actions();

    submitOrderDialog(
      {
        kind: 'editAlias',
        identity,
        value: 'Custom Name',
        baseValue: 'Original Name',
        initialValue: 'Custom Name',
        hadAlias: true,
      },
      ' Custom Name ',
      submitActions,
    );

    expect(submitActions.onSaveAlias).not.toHaveBeenCalled();
  });
});
