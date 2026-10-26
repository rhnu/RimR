import { create } from 'zustand';
import type { ModListDto } from '@/commands';
import type { ModListAction } from '@/domain/mod-list/types';
import {
  acknowledgeSave,
  discardDraft,
  editDraft,
  emptyDraftSession,
  receiveSavedList,
  savedDraftSession,
  type DraftSession,
} from '@/domain/mod-list/session';

type OrderDraftState = DraftSession & {
  initialize: (modList: ModListDto) => void;
  applyAction: (action: ModListAction) => void;
  acceptSaved: (submitted: ModListDto, saved: ModListDto) => void;
  replaceSavedDraft: (modList: ModListDto) => void;
  discard: () => void;
  reset: () => void;
};

export const useOrderDraftStore = create<OrderDraftState>((set) => ({
  ...emptyDraftSession(),
  initialize: (modList) => set((state) => receiveSavedList(state, modList)),
  applyAction: (action) => set((state) => editDraft(state, action)),
  acceptSaved: (submitted, saved) => set((state) => acknowledgeSave(state, submitted, saved)),
  replaceSavedDraft: (modList) => set(savedDraftSession(modList)),
  discard: () => set((state) => discardDraft(state)),
  reset: () => set(emptyDraftSession()),
}));
