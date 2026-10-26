import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppConfig } from '@/commands';
import {
  clearPathDraft,
  pathDraftDirty,
  updatePathDraft,
  type PathFieldKey,
} from '@/features/settings/path-settings-model';
import { mergePathDraft } from '../model/path-draft';

/** Page-local path edits receive saved changes without losing newer input. */
export function useSettingsDraft(saved: AppConfig | null | undefined) {
  const [draft, setDraft] = useState<AppConfig | null>(null);
  const baselineRef = useRef<AppConfig | null>(null);

  useEffect(() => {
    if (!saved) return;
    const previous = baselineRef.current;
    baselineRef.current = saved;
    setDraft((current) => mergePathDraft(current, previous, saved));
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

  const acceptSaved = useCallback((submitted: AppConfig, next: AppConfig) => {
    setDraft((current) => mergePathDraft(current, submitted, next));
  }, []);

  return {
    draft,
    baseline,
    isReady,
    isDirty,
    updatePath,
    clearPath,
    reset,
    acceptSaved,
  };
}
