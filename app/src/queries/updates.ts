import { CancelledError, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Update } from '@tauri-apps/plugin-updater';
import { logUpdate, updaterClient, updateErrorMessage } from '@/commands/updater-client';
import { queryKeys } from './keys';

export type UpdateCheck = {
  update: Update | null;
  bundleType: string;
};

export async function releaseUpdate(result: UpdateCheck | undefined): Promise<void> {
  if (!result?.update) return;
  try {
    await result.update.close();
  } catch (error) {
    logUpdate(`Could not release update resource: ${updateErrorMessage(error)}`, true);
  }
}

/** The query owns the plugin resource; the update controller owns only operation state. */
export function useUpdateCheck() {
  const client = useQueryClient();
  return useQuery({
    queryKey: queryKeys.update,
    queryFn: async ({ signal }): Promise<UpdateCheck> => {
      const bundleType = await updaterClient.getBundleType();
      if (signal.aborted) throw new CancelledError();
      const update = await updaterClient.check({ timeout: 30_000 });
      const result = { update, bundleType };
      if (signal.aborted) {
        await releaseUpdate(result);
        throw new CancelledError();
      }
      await releaseUpdate(client.getQueryData<UpdateCheck>(queryKeys.update));
      if (signal.aborted) {
        await releaseUpdate(result);
        throw new CancelledError();
      }
      return result;
    },
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
    structuralSharing: false,
    retry: false,
    meta: { errorHandled: true },
  });
}
