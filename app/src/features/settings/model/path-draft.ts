import type { AppConfig } from '@/commands';

/** Adopt saved fields only when the user has not changed them since the baseline. */
export function mergePathDraft(
  draft: AppConfig | null,
  baseline: AppConfig | null,
  saved: AppConfig,
): AppConfig {
  if (!draft || !baseline) return saved;
  const paths = { ...saved.paths };
  for (const key of Object.keys(paths) as Array<keyof AppConfig['paths']>) {
    if (draft.paths[key] !== baseline.paths[key]) paths[key] = draft.paths[key];
  }
  return { ...saved, paths };
}
