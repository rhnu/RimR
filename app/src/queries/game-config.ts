import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rimrClient, type ApplyModListRequest } from '@/commands';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { inWorkspace, readQuery } from './client';
import type { QueryEnableOptions } from './catalog';
import { queryKeys } from './keys';

export function useLoadActiveList(options?: QueryEnableOptions) {
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useQuery({
    queryKey: queryKeys.activeList(epoch),
    queryFn: ({ signal }) => readQuery(rimrClient.loadActiveList(), signal),
    enabled: options?.enabled ?? false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useApplyModListToGame() {
  const client = useQueryClient();
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useMutation({
    scope: { id: 'apply-' + epoch },
    mutationFn: (request: ApplyModListRequest) =>
      inWorkspace(epoch, () => rimrClient.applyModListToGame(request)),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.activeList(epoch) }),
  });
}
