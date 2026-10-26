import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/commands';
import { queryKeys } from './keys';

export function useAppVersion() {
  return useQuery({
    queryKey: queryKeys.appVersion,
    queryFn: () => appClient.getVersion(),
    staleTime: Infinity,
    retry: false,
  });
}
