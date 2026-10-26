import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { rimrClient, type ModPreviewDto } from '@/commands';
import { createPreviewWarmScheduler } from '@/queries/preview-scheduler';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { readQuery } from './client';
import { queryKeys } from './keys';
import { useCatalogSnapshot } from './catalog';

export function modPreviewQueryOptions(sourceKey: string, epoch: number, catalogRevision: number) {
  return queryOptions({
    queryKey: queryKeys.modPreview(epoch, sourceKey, catalogRevision),
    queryFn: ({ signal }) => readQuery(rimrClient.loadModPreview({ sourceKey }), signal),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}

export function useModPreview(sourceKey: string | null) {
  const epoch = useWorkspaceStore((state) => state.epoch);
  const { dataUpdatedAt: catalogRevision } = useCatalogSnapshot();
  return useQuery({
    ...(sourceKey == null
      ? {
          queryKey: queryKeys.modPreview(epoch, sourceKey, catalogRevision),
          queryFn: () => {
            throw new Error('sourceKey is required');
          },
          staleTime: Infinity,
          gcTime: Infinity,
        }
      : modPreviewQueryOptions(sourceKey, epoch, catalogRevision)),
    enabled: sourceKey != null,
  });
}

export function decodePreviewDataUrl(previewDataUrl: string | null | undefined): Promise<void> {
  if (!previewDataUrl || typeof Image === 'undefined') {
    return Promise.resolve();
  }
  const image = new Image();
  image.decoding = 'async';
  image.src = previewDataUrl;
  if (typeof image.decode === 'function') {
    return image.decode().catch(() => undefined);
  }
  return new Promise((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
  });
}

export function modFolderSizeQueryOptions(
  sourceKey: string,
  epoch: number,
  catalogRevision: number,
) {
  return queryOptions({
    queryKey: queryKeys.modFolderSize(epoch, sourceKey, catalogRevision),
    queryFn: ({ signal }) => readQuery(rimrClient.loadModFolderSize({ sourceKey }), signal),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });
}

export function useModFolderSize(sourceKey: string | null, enabled: boolean) {
  const epoch = useWorkspaceStore((state) => state.epoch);
  const { dataUpdatedAt: catalogRevision } = useCatalogSnapshot();
  return useQuery({
    ...(sourceKey == null
      ? {
          queryKey: queryKeys.modFolderSize(epoch, sourceKey, catalogRevision),
          queryFn: () => {
            throw new Error('sourceKey is required');
          },
          staleTime: 5 * 60_000,
          gcTime: Infinity,
        }
      : modFolderSizeQueryOptions(sourceKey, epoch, catalogRevision)),
    enabled: sourceKey != null && enabled,
  });
}

export function usePrefetchModPreview() {
  const epoch = useWorkspaceStore((state) => state.epoch);
  const { dataUpdatedAt: catalogRevision } = useCatalogSnapshot();
  const queryClient = useQueryClient();
  const scheduler = useMemo(
    () =>
      createPreviewWarmScheduler({
        delayMs: 100,
        maxConcurrent: 2,
        isWarm: (sourceKey) => {
          const state = queryClient.getQueryState(
            queryKeys.modPreview(epoch, sourceKey, catalogRevision),
          );
          return state?.status === 'success' || state?.fetchStatus === 'fetching';
        },
        warm: async (sourceKey) => {
          await queryClient.ensureQueryData(
            modPreviewQueryOptions(sourceKey, epoch, catalogRevision),
          );
        },
        decode: async (sourceKey) => {
          const preview = queryClient.getQueryData<ModPreviewDto>(
            queryKeys.modPreview(epoch, sourceKey, catalogRevision),
          );
          await decodePreviewDataUrl(preview?.previewDataUrl);
        },
      }),
    [queryClient, epoch, catalogRevision],
  );
  useEffect(() => scheduler.cancel, [scheduler]);
  return scheduler;
}
