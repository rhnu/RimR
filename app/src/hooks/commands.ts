import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { rimrClient } from '@/commands';
import { createPreviewWarmScheduler } from '@/lib/orderPreviewPrefetch';
import { queryKeys, sessionBoundQueryKeys } from '@/lib/queryKeys';
import type {
  ApplyModListRequest,
  AppConfig,
  CreateModListRequest,
  DeleteModListRequest,
  ExportGameConfigBackupRequest,
  ExportLibrarySettingsFileRequest,
  ExportModListFileRequest,
  ImportGameConfigBackupRequest,
  ImportLibrarySettingsFileRequest,
  ImportModListFileRequest,
  ModPreviewDto,
  OpenModFolderRequest,
  OpenSteamWorkshopPageRequest,
  RimrResult,
  SaveLibrarySettingsRequest,
  SaveModListRequest,
  SetCurrentModListRequest,
  ValidateActiveOrderRequest,
} from '@/commands';

export { queryKeys };

export function unwrap<T>(result: RimrResult<T>): Promise<T> {
  return result.match(
    (value) => value,
    (error) => {
      throw error;
    },
  );
}

export function useAppConfig() {
  return useQuery({
    queryKey: queryKeys.appConfig,
    queryFn: () => unwrap(rimrClient.getAppConfig()),
  });
}

export function useSaveAppConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: AppConfig) => unwrap(rimrClient.saveAppConfig(config)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.appConfig });
    },
  });
}

export function useAutodetectPaths() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(rimrClient.autodetectPaths()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.appConfig });
    },
  });
}

export function useClearSessionCache() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(rimrClient.clearSessionCache()),
    onSuccess: () => {
      for (const queryKey of sessionBoundQueryKeys) {
        queryClient.removeQueries({ queryKey });
      }
    },
  });
}

export type QueryEnableOptions = { enabled?: boolean };

export function useCatalogSnapshot(options?: QueryEnableOptions) {
  return useQuery({
    queryKey: queryKeys.catalogSnapshot,
    queryFn: () => unwrap(rimrClient.rebuildCatalog()),
    enabled: options?.enabled ?? false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function modPreviewQueryOptions(sourceKey: string) {
  return queryOptions({
    queryKey: queryKeys.modPreview(sourceKey),
    queryFn: () => unwrap(rimrClient.loadModPreview({ sourceKey })),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}

export function useModPreview(sourceKey: string | null) {
  return useQuery({
    ...(sourceKey == null
      ? {
          queryKey: queryKeys.modPreview(sourceKey),
          queryFn: () => {
            throw new Error('sourceKey is required');
          },
          staleTime: Infinity,
          gcTime: Infinity,
        }
      : modPreviewQueryOptions(sourceKey)),
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

export function modFolderSizeQueryOptions(sourceKey: string) {
  return queryOptions({
    queryKey: queryKeys.modFolderSize(sourceKey),
    queryFn: () => unwrap(rimrClient.loadModFolderSize({ sourceKey })),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });
}

export function useModFolderSize(sourceKey: string | null, enabled: boolean) {
  return useQuery({
    ...(sourceKey == null
      ? {
          queryKey: queryKeys.modFolderSize(sourceKey),
          queryFn: () => {
            throw new Error('sourceKey is required');
          },
          staleTime: 5 * 60_000,
          gcTime: Infinity,
        }
      : modFolderSizeQueryOptions(sourceKey)),
    enabled: sourceKey != null && enabled,
  });
}

export function usePrefetchModPreview() {
  const queryClient = useQueryClient();
  const scheduler = useMemo(
    () =>
      createPreviewWarmScheduler({
        delayMs: 100,
        maxConcurrent: 2,
        isWarm: (sourceKey) => {
          const state = queryClient.getQueryState(queryKeys.modPreview(sourceKey));
          return state?.status === 'success' || state?.fetchStatus === 'fetching';
        },
        warm: async (sourceKey) => {
          await queryClient.ensureQueryData(modPreviewQueryOptions(sourceKey));
        },
        decode: async (sourceKey) => {
          const preview = queryClient.getQueryData<ModPreviewDto>(queryKeys.modPreview(sourceKey));
          await decodePreviewDataUrl(preview?.previewDataUrl);
        },
      }),
    [queryClient],
  );
  useEffect(() => scheduler.cancel, [scheduler]);
  return scheduler;
}

export function useLoadActiveList(options?: QueryEnableOptions) {
  return useQuery({
    queryKey: queryKeys.activeList,
    queryFn: () => unwrap(rimrClient.loadActiveList()),
    enabled: options?.enabled ?? false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useLibrary(options?: QueryEnableOptions) {
  return useQuery({
    queryKey: queryKeys.library,
    queryFn: () => unwrap(rimrClient.loadLibrary()),
    enabled: options?.enabled ?? false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useValidateActiveOrder() {
  return useMutation({
    mutationFn: (request: ValidateActiveOrderRequest) =>
      unwrap(rimrClient.validateActiveOrder(request)),
  });
}

export function useSaveLibrarySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SaveLibrarySettingsRequest) =>
      unwrap(rimrClient.saveLibrarySettings(request)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library });
    },
  });
}

export function useCreateModList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateModListRequest) => unwrap(rimrClient.createModList(request)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library });
    },
  });
}

export function useSaveModList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SaveModListRequest) => unwrap(rimrClient.saveModList(request)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library });
    },
  });
}

export function useDeleteModList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: DeleteModListRequest) => unwrap(rimrClient.deleteModList(request)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library });
    },
  });
}

export function useSetCurrentModList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SetCurrentModListRequest) =>
      unwrap(rimrClient.setCurrentModList(request)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library });
    },
  });
}

export function useApplyModListToGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ApplyModListRequest) => unwrap(rimrClient.applyModListToGame(request)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.activeList });
      void queryClient.invalidateQueries({ queryKey: queryKeys.library });
    },
  });
}

export function useExportGameConfigBackup() {
  return useMutation({
    mutationFn: (request: ExportGameConfigBackupRequest) =>
      unwrap(rimrClient.exportGameConfigBackup(request)),
  });
}

export function useImportGameConfigBackup() {
  return useMutation({
    mutationFn: (request: ImportGameConfigBackupRequest) =>
      unwrap(rimrClient.importGameConfigBackup(request)),
  });
}

export function useExportModListFile() {
  return useMutation({
    mutationFn: (request: ExportModListFileRequest) =>
      unwrap(rimrClient.exportModListFile(request)),
  });
}

export function useImportModListFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ImportModListFileRequest) =>
      unwrap(rimrClient.importModListFile(request)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library });
    },
  });
}

export function useExportLibrarySettingsFile() {
  return useMutation({
    mutationFn: (request: ExportLibrarySettingsFileRequest) =>
      unwrap(rimrClient.exportLibrarySettingsFile(request)),
  });
}

export function useImportLibrarySettingsFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ImportLibrarySettingsFileRequest) =>
      unwrap(rimrClient.importLibrarySettingsFile(request)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library });
    },
  });
}

export function useOpenModFolder() {
  return useMutation({
    mutationFn: (request: OpenModFolderRequest) => unwrap(rimrClient.openModFolder(request)),
  });
}

export function useOpenSteamWorkshopPage() {
  return useMutation({
    mutationFn: (request: OpenSteamWorkshopPageRequest) =>
      unwrap(rimrClient.openSteamWorkshopPage(request)),
  });
}
