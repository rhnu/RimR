import { useCallback, useEffect, useState } from 'react';
import type { AppConfig } from '@/commands';
import {
  clearPathDraft,
  pathDraftDirty,
  updatePathDraft,
  type PathFieldKey,
} from '@/features/settings/pathSettingsModel';

// React binding for the AppConfig draft used by SetupPage / SettingsPage.
//
// Shape parallels `useOrderDraft` (draft / baseline / isDirty / isReady):
// the draft and dirty flag are derived from `useState` + the saved query
// data; pure mutations (`updatePathDraft`, `clearPathDraft`) come from
// `pathSettingsModel`. This is local state — settings drafts do not need
// to survive route changes — so we deliberately keep it in `useState`
// instead of a global store, mirroring the rules in docs/state-management.md
// (single-page interaction state lives in feature hooks / context).
export function useSettingsDraft(saved: AppConfig | null | undefined) {
  const [draft, setDraft] = useState<AppConfig | null>(null);

  useEffect(() => {
    if (saved) setDraft(saved);
  }, [saved]);

  const baseline = saved ?? null;
  const isReady = draft != null;
  const isDirty = pathDraftDirty(draft, saved);

  const updatePath = useCallback((field: PathFieldKey, value: string) => {
    setDraft((current) => updatePathDraft(current, field, value));
  }, []);

  const clearPath = useCallback((field: PathFieldKey) => {
    setDraft((current) => clearPathDraft(current, field));
  }, []);

  const reset = useCallback(() => {
    if (saved) setDraft(saved);
  }, [saved]);

  const replaceSavedDraft = useCallback((next: AppConfig) => {
    setDraft(next);
  }, []);

  return {
    draft,
    baseline,
    isReady,
    isDirty,
    updatePath,
    clearPath,
    reset,
    replaceSavedDraft,
  };
}
