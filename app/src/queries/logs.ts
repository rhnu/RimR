import { useQuery } from '@tanstack/react-query';
import type { LogSourceDto } from '@/commands';
import { rimrClient } from '@/commands';
import { queryKeys } from './keys';
import { readQuery } from './client';
import { useWorkspaceStore } from '@/stores/workspace-store';

export function useSteamWorkshopLog() {
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useQuery({
    queryKey: queryKeys.steamWorkshopLog(epoch),
    queryFn: ({ signal }) => readQuery(rimrClient.loadSteamWorkshopLog(), signal),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function usePlayerLog(source: LogSourceDto) {
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useQuery({
    queryKey: queryKeys.playerLog(epoch, source),
    queryFn: ({ signal }) => readQuery(rimrClient.loadPlayerLog({ source }), signal),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
