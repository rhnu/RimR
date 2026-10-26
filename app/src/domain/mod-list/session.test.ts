import { describe, expect, it } from 'vitest';
import type { ModListDto } from '@/commands';
import {
  acknowledgeSave,
  discardDraft,
  emptyDraftSession,
  receiveSavedList,
  savedDraftSession,
} from './session';

const list = (overrides: Partial<ModListDto> = {}): ModListDto => ({
  id: '5357fb3e-8c04-4f48-af26-c8bc67275c06',
  revision: 1,
  name: 'Original',
  entries: [],
  ...overrides,
});

describe('draft session', () => {
  it('adopts newer saved data when clean, ignoring older refreshes', () => {
    const updated = list({ revision: 2, name: 'Renamed' });
    const state = receiveSavedList(savedDraftSession(list()), updated);
    expect(state.draft).toEqual(updated);
    expect(receiveSavedList(state, list())).toBe(state);
  });

  it('preserves edits and exposes a conflict when saved data changes', () => {
    const draft = list({ note: 'My changes' });
    const state = { ...savedDraftSession(list()), draft, isDirty: true };
    const latest = list({ revision: 2, name: 'Remote changes' });
    const received = receiveSavedList(state, latest);
    expect(received.draft).toBe(draft);
    expect(received.hasConflict).toBe(true);
    expect(discardDraft(received).draft).toBe(latest);
  });

  it('acknowledges a save while retaining edits made during the request', () => {
    const submitted = list({ name: 'Submitted' });
    const draft = { ...submitted, note: 'Edited while saving' };
    const state = { ...savedDraftSession(list()), draft, isDirty: true };
    const saved = { ...submitted, revision: 2 };
    const accepted = acknowledgeSave(state, submitted, saved);
    expect(accepted.draft).toEqual({ ...draft, revision: 2 });
    expect(accepted.baseline).toBe(saved);
    expect(accepted.isDirty).toBe(true);
  });

  it('ignores save responses belonging to another list or an older revision', () => {
    const submitted = list();
    const other = savedDraftSession(list({ id: '778d7bb7-3723-4ba8-8fde-39203462f7a6' }));
    expect(acknowledgeSave(other, submitted, list({ revision: 2 }))).toBe(other);
    const newer = savedDraftSession(list({ revision: 3 }));
    expect(acknowledgeSave(newer, submitted, list({ revision: 2 }))).toBe(newer);
  });

  it('receives a rename without discarding unsaved entries or reverting the new name', () => {
    const submitted = list();
    const draft = list({ note: 'Unsaved note' });
    const state = { ...savedDraftSession(submitted), draft, isDirty: true };
    const saved = list({ revision: 2, name: 'Renamed' });
    const accepted = acknowledgeSave(state, submitted, saved);
    expect(accepted.draft).toMatchObject({ name: 'Renamed', note: 'Unsaved note', revision: 2 });
    expect(accepted.isDirty).toBe(true);
  });

  it('initializes empty sessions and marks matching save acknowledgements clean', () => {
    const submitted = list();
    const state = receiveSavedList(emptyDraftSession(), submitted);
    expect(acknowledgeSave(state, submitted, list({ revision: 2 })).isDirty).toBe(false);
  });
});
