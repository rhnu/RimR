import { useCallback } from 'react';
import { usePrefetchModPreview } from '@/hooks/commands';

export function useOrderPreview() {
  const previewWarm = usePrefetchModPreview();

  const warmModPreview = useCallback(
    (sourceKey: string | null | undefined, immediate = false): void => {
      if (immediate) {
        void previewWarm.warmNow(sourceKey);
      } else {
        previewWarm.schedule(sourceKey);
      }
    },
    [previewWarm],
  );

  const warmSelectedPreview = useCallback(
    (
      sourceKey: string | null | undefined,
      orderedSourceKeys: ReadonlyArray<string | null | undefined>,
    ) => {
      void previewWarm.warmNow(sourceKey);
      if (sourceKey == null) return;
      const index = orderedSourceKeys.findIndex((candidate) => candidate === sourceKey);
      if (index < 0) return;
      void previewWarm.warmNearby([orderedSourceKeys[index - 1], orderedSourceKeys[index + 1]]);
    },
    [previewWarm],
  );

  return { warmModPreview, warmSelectedPreview };
}
