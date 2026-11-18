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
    gcTime: Infinity,
    refetchOnReconnect: false,
  });
}

export function usePlayerLog(source: LogSourceDto, live: boolean) {
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useQuery({
    queryKey: queryKeys.playerLog(epoch, source),
    queryFn: ({ signal }) => readQuery(rimrClient.loadPlayerLog({ source }), signal),
    gcTime: Infinity,
    refetchOnReconnect: false,
    refetchInterval: live ? 3000 : false,
    refetchIntervalInBackground: true,
  });
}
