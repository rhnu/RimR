import type { AppConfig } from '@/commands';

type Paths = AppConfig['paths'];
export type PathFieldKey = keyof Paths;

export const pathFieldKeys: ReadonlyArray<PathFieldKey> = [
  'gameDir',
  'gameDataDir',
  'localModsDir',
  'workshopModsDir',
  'rimrDataDir',
];

type PathEdit = { readonly value: string | null };
export type PathDraft = Partial<Record<PathFieldKey, PathEdit>>;

/** Record the user's choices independently of refreshed configuration. */
export function editPath(
  draft: PathDraft,
  field: PathFieldKey,
  value: string | null,
  saved: Paths,
  writePending: boolean,
): PathDraft {
  const next = { ...draft };
  // A pending write can still replace the saved value the user just selected.
  if (value === saved[field] && !writePending) delete next[field];
  else next[field] = { value };
  return next;
}

export function mergePathEdits(paths: Paths, draft: PathDraft): Paths {
  const merged = { ...paths };
  for (const field of pathFieldKeys) {
    const edit = draft[field];
    if (edit) merged[field] = edit.value;
  }
  return merged;
}

/** A write acknowledges the exact submitted edits, leaving later choices pending. */
export function reconcilePathEdits(
  draft: PathDraft,
  paths: Paths,
  submitted?: PathDraft,
): PathDraft {
  const remaining: PathDraft = {};
  for (const field of pathFieldKeys) {
    const edit = draft[field];
    if (edit && edit !== submitted?.[field] && edit.value !== paths[field]) {
      remaining[field] = edit;
    }
  }
  return remaining;
}

export function hasPathEdits(draft: PathDraft, paths: Paths | undefined): boolean {
  return pathFieldKeys.some((field) => {
    const edit = draft[field];
    return edit != null && edit.value !== paths?.[field];
  });
}

export function pathsChanged(previous: Paths, next: Paths): boolean {
  return pathFieldKeys.some((field) => previous[field] !== next[field]);
}

export function canScanConfig(config: AppConfig | undefined): boolean {
  return config?.paths.gameDir != null && config.paths.gameDataDir != null;
}
