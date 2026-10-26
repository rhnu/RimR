import type { ModCleanupKindDto, ModCleanupPreviewDto } from '@/commands';

export const TOOL_CLEANUP_ITEMS = [
  { kind: 'textureOnlyInvalid', labelKey: 'tools.cleanupTextureOnly' },
  { kind: 'invalid', labelKey: 'tools.cleanupInvalid' },
] as const satisfies Array<{ kind: ModCleanupKindDto; labelKey: string }>;

export function shouldOpenModCleanupDialog(preview: ModCleanupPreviewDto): boolean {
  return preview.candidates.length > 0;
}

export function cleanupSourceKeys(preview: ModCleanupPreviewDto): string[] {
  return preview.candidates.map((candidate) => candidate.sourceKey);
}
