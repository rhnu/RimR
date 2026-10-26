import { useQuery } from '@tanstack/react-query';
import type { LogSourceDto } from '@/commands';
import { rimrClient } from '@/commands';
import { queryKeys } from '@/lib/queryKeys';
import { unwrap } from './commands';

export function useSteamWorkshopLog() {
  return useQuery({
    queryKey: queryKeys.steamWorkshopLog,
    queryFn: () => unwrap(rimrClient.loadSteamWorkshopLog()),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function usePlayerLog(source: LogSourceDto) {
  return useQuery({
    queryKey: queryKeys.playerLog(source),
    queryFn: () => unwrap(rimrClient.loadPlayerLog({ source })),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
