import type { ModListDto } from '@/commands';
import { modListReducer } from './reducer';
import type { ModListAction } from './types';

export type DraftSession = {
  draft: ModListDto | null;
  baseline: ModListDto | null;
  isDirty: boolean;
  isReady: boolean;
  hasConflict: boolean;
};

export function emptyDraftSession(): DraftSession {
  return { draft: null, baseline: null, isDirty: false, isReady: false, hasConflict: false };
}

export function savedDraftSession(modList: ModListDto): DraftSession {
  return { draft: modList, baseline: modList, isDirty: false, isReady: true, hasConflict: false };
}

export function receiveSavedList(state: DraftSession, incoming: ModListDto): DraftSession {
  if (!state.baseline || state.baseline.id !== incoming.id) return savedDraftSession(incoming);
  if (incoming.revision <= state.baseline.revision) return state;
  if (!state.isDirty) return savedDraftSession(incoming);
  return { ...state, baseline: incoming, hasConflict: true };
}

export function editDraft(state: DraftSession, action: ModListAction): DraftSession {
  if (!state.draft) return state;
  const draft = modListReducer(state.draft, action);
  return { ...state, draft, isDirty: !sameEditableList(draft, state.baseline) };
}

/** A save acknowledges its submitted snapshot, never subsequent edits or another list. */
export function acknowledgeSave(
  state: DraftSession,
  submitted: ModListDto,
  saved: ModListDto,
): DraftSession {
  if (!state.draft || state.draft.id !== submitted.id || saved.id !== submitted.id) return state;
  if (state.baseline && state.baseline.revision > saved.revision) return state;
  if (sameEditableList(state.draft, submitted)) return savedDraftSession(saved);
  const draft = {
    ...state.draft,
    revision: saved.revision,
    name: state.draft.name === submitted.name ? saved.name : state.draft.name,
    note: state.draft.note === submitted.note ? saved.note : state.draft.note,
    entries:
      JSON.stringify(state.draft.entries) === JSON.stringify(submitted.entries)
        ? saved.entries
        : state.draft.entries,
  };
  return {
    draft,
    baseline: saved,
    isDirty: !sameEditableList(draft, saved),
    isReady: true,
    hasConflict: false,
  };
}

export function discardDraft(state: DraftSession): DraftSession {
  return state.baseline ? savedDraftSession(state.baseline) : emptyDraftSession();
}

function sameEditableList(left: ModListDto, right: ModListDto | null): boolean {
  if (!right || left.id !== right.id || left.name !== right.name || left.note !== right.note)
    return false;
  return JSON.stringify(left.entries) === JSON.stringify(right.entries);
}
