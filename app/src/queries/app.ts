import { useMutation, useQuery } from '@tanstack/react-query';
import { appClient, rimrClient } from '@/commands';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { readQuery, unwrap } from './client';
import { queryKeys } from './keys';

export function useAppVersion() {
  return useQuery({
    queryKey: queryKeys.appVersion,
    queryFn: () => appClient.getVersion(),
    staleTime: Infinity,
    retry: false,
  });
}

export function useGameVersion(enabled: boolean) {
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useQuery({
    queryKey: queryKeys.gameVersion(epoch),
    queryFn: ({ signal }) => readQuery(rimrClient.getGameVersion(), signal),
    enabled,
    staleTime: 0,
    retry: false,
  });
}

export function useOpenProjectPage() {
  return useMutation({ mutationFn: () => unwrap(rimrClient.openProjectPage()) });
}
