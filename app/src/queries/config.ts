import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { rimrClient, type AppConfig } from '@/commands';
import { mergePathEdits, pathsChanged, type PathDraft } from '@/domain/workspace/path-settings';
import { readQuery, unwrap } from './client';
import { queryKeys } from './keys';
import { invalidateWorkspace, retireWorkspace } from './workspace';

export type ConfigOperation =
  | { type: 'save'; draft: PathDraft }
  | { type: 'autodetect' }
  | { type: 'clearCache' };

const configOperationKey = ['configOperation'] as const;

type ConfigOperationCallbacks = {
  onSuccess?: (saved: AppConfig | undefined) => void;
  onError?: () => void;
};

export function useAppConfig() {
  return useQuery({
    queryKey: queryKeys.appConfig,
    queryFn: ({ signal }) => readQuery(rimrClient.getAppConfig(), signal),
  });
}

export function isPathWritePending(client: QueryClient): boolean {
  return (
    client.isMutating({
      mutationKey: configOperationKey,
      predicate: (mutation) => (mutation.state.variables as ConfigOperation).type !== 'clearCache',
    }) > 0
  );
}

export function useConfigOperation() {
  const client = useQueryClient();
  const pending = useMutationState({
    filters: { mutationKey: configOperationKey, status: 'pending' },
    select: (mutation) => (mutation.state.variables as ConfigOperation).type,
  });
  const { mutate } = useMutation({
    mutationKey: configOperationKey,
    meta: { blocksUpdate: true },
    mutationFn: (operation: ConfigOperation) => runConfigOperation(client, operation),
  });
  return {
    pending: pending.length > 0 ? pending[0] : null,
    run: (operation: ConfigOperation, callbacks?: ConfigOperationCallbacks) => {
      if (client.isMutating({ mutationKey: configOperationKey })) return;
      mutate(operation, callbacks);
    },
  };
}

async function runConfigOperation(
  client: QueryClient,
  operation: ConfigOperation,
): Promise<AppConfig | undefined> {
  if (operation.type === 'clearCache') {
    await unwrap(rimrClient.clearSessionCache());
    await invalidateWorkspace(client);
    return;
  }

  const previous = await unwrap(rimrClient.getAppConfig());
  let saved: AppConfig;
  if (operation.type === 'save') {
    saved = await unwrap(
      rimrClient.saveAppConfig({
        ...previous,
        paths: mergePathEdits(previous.paths, operation.draft),
      }),
    );
  } else {
    // Auto-detection saves these paths and returns their persisted values.
    const { gameDir, gameDataDir, localModsDir, workshopModsDir } = await unwrap(
      rimrClient.autodetectPaths(),
    );
    saved = {
      ...previous,
      paths: { ...previous.paths, gameDir, gameDataDir, localModsDir, workshopModsDir },
    };
  }

  await client.cancelQueries({ queryKey: queryKeys.appConfig, exact: true });
  const retirement = pathsChanged(previous.paths, saved.paths)
    ? retireWorkspace(client)
    : undefined;
  client.setQueryData(queryKeys.appConfig, saved);
  await retirement;
  return saved;
}
