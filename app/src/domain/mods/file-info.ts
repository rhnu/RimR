import type { ModFolderSizeDto, ModPreviewDto } from '@/commands';

export function currentModPreview(
  sourceKey: string | null,
  data: ModPreviewDto | null | undefined,
): ModPreviewDto | null {
  return currentSourceKeyData(sourceKey, data);
}

export function currentModFolderSize(
  sourceKey: string | null,
  data: ModFolderSizeDto | null | undefined,
): ModFolderSizeDto | null {
  return currentSourceKeyData(sourceKey, data);
}

function currentSourceKeyData<T extends { sourceKey: string }>(
  sourceKey: string | null,
  data: T | null | undefined,
): T | null {
  if (sourceKey == null || data == null || data.sourceKey !== sourceKey) {
    return null;
  }
  return data;
}
