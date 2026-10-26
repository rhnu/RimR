import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rimrClient } from '@/commands';
import type { CleanModsRequest, ModCleanupPreviewRequest } from '@/commands';
import { queryKeys } from '@/lib/queryKeys';
import { unwrap } from './commands';

export function usePreviewModCleanup() {
  return useMutation({
    mutationFn: (request: ModCleanupPreviewRequest) =>
      unwrap(rimrClient.previewModCleanup(request)),
  });
}

export function useCleanMods() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CleanModsRequest) => unwrap(rimrClient.cleanMods(request)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalogSnapshot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activeList });
      void queryClient.invalidateQueries({ queryKey: queryKeys.library });
      queryClient.removeQueries({ queryKey: queryKeys.modPreviewRoot });
      queryClient.removeQueries({ queryKey: queryKeys.modFolderSizeRoot });
    },
  });
}
