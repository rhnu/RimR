import { useMutation, useQuery } from '@tanstack/react-query';
import { rimrClient, type ValidateActiveOrderRequest } from '@/commands';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { inWorkspace, readQuery } from './client';
import { queryKeys } from './keys';

export type QueryEnableOptions = { enabled?: boolean };

export function useCatalogSnapshot(options?: QueryEnableOptions) {
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useQuery({
    queryKey: queryKeys.catalogSnapshot(epoch),
    queryFn: ({ signal }) => readQuery(rimrClient.rebuildCatalog(), signal),
    enabled: options?.enabled ?? false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useValidateActiveOrder() {
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useMutation({
    mutationFn: (request: ValidateActiveOrderRequest) =>
      inWorkspace(epoch, () => rimrClient.validateActiveOrder(request)),
  });
}
