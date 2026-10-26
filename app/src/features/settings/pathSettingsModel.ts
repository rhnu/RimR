import type { AppConfig } from '@/commands';

export type PathFieldKey =
  | 'gameDir'
  | 'gameDataDir'
  | 'localModsDir'
  | 'workshopModsDir'
  | 'rimrDataDir';

export const pathFieldKeys: ReadonlyArray<PathFieldKey> = [
  'gameDir',
  'gameDataDir',
  'localModsDir',
  'workshopModsDir',
  'rimrDataDir',
];

export function pathDraftDirty(
  draft: AppConfig | null,
  saved: AppConfig | null | undefined,
): boolean {
  return draft != null && JSON.stringify(draft) !== JSON.stringify(saved);
}

export function updatePathDraft(
  draft: AppConfig | null,
  field: PathFieldKey,
  value: string,
): AppConfig | null {
  return draft ? { ...draft, paths: { ...draft.paths, [field]: value } } : draft;
}

export function clearPathDraft(draft: AppConfig | null, field: PathFieldKey): AppConfig | null {
  return draft ? { ...draft, paths: { ...draft.paths, [field]: null } } : draft;
}

export function canScanConfig(config: AppConfig | null | undefined): boolean {
  return config?.paths.gameDir != null && config.paths.gameDataDir != null;
}
