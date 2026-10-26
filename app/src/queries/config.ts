import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rimrClient, type AppConfig } from '@/commands';
import { readQuery, unwrap } from './client';
import { queryKeys } from './keys';
import { retireWorkspace } from './workspace';

export function useAppConfig() {
  return useQuery({
    queryKey: queryKeys.appConfig,
    queryFn: ({ signal }) => readQuery(rimrClient.getAppConfig(), signal),
  });
}

export function useSaveAppConfig() {
  const client = useQueryClient();
  return useMutation({
    scope: { id: 'configuration' },
    mutationFn: (config: AppConfig) => unwrap(rimrClient.saveAppConfig(config)),
    onSuccess: async (config) => {
      const previous = client.getQueryData<AppConfig>(queryKeys.appConfig);
      if (JSON.stringify(previous?.paths) !== JSON.stringify(config.paths))
        await retireWorkspace(client);
      client.setQueryData(queryKeys.appConfig, config);
    },
  });
}

export function useAutodetectPaths() {
  const client = useQueryClient();
  return useMutation({
    scope: { id: 'configuration' },
    mutationFn: () => unwrap(rimrClient.autodetectPaths()),
    onSuccess: async () => {
      await retireWorkspace(client);
      await client.invalidateQueries({ queryKey: queryKeys.appConfig });
    },
  });
}

export function useClearSessionCache() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(rimrClient.clearSessionCache()),
    onSuccess: () => retireWorkspace(client),
  });
}
