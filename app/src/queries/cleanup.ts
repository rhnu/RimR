import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rimrClient } from '@/commands';
import type { CleanModsRequest, ModCleanupPreviewRequest } from '@/commands';
import { invalidateWorkspace } from './workspace';
import { unwrap } from './client';

export function usePreviewModCleanup() {
  return useMutation({
    mutationFn: (request: ModCleanupPreviewRequest) =>
      unwrap(rimrClient.previewModCleanup(request)),
  });
}

export function useCleanMods() {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { blocksUpdate: true },
    mutationFn: (request: CleanModsRequest) => unwrap(rimrClient.cleanMods(request)),
    onSuccess: () => invalidateWorkspace(queryClient),
  });
}
