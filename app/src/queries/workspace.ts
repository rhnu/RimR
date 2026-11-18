import type { QueryClient } from '@tanstack/react-query';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useOrderCommandStore } from '@/stores/order-command-store';
import { useOrderDraftStore } from '@/stores/order-draft-store';
import { useOrderDialogStore } from '@/stores/order-dialog-store';
import { useValidationStore } from '@/stores/validation';
import { queryKeys } from './keys';

/** Prevent old results from entering the new cache while its predecessor is removed. */
export async function invalidateWorkspace(client: QueryClient): Promise<void> {
  const { epoch, advance } = useWorkspaceStore.getState();
  const previousWorkspace = { queryKey: queryKeys.workspace(epoch) };
  advance();
  useValidationStore.getState().clear();
  await client.cancelQueries(previousWorkspace);
  client.removeQueries(previousWorkspace);
}

/** End the current editing session when the configured workspace is replaced. */
export function retireWorkspace(client: QueryClient): Promise<void> {
  const invalidation = invalidateWorkspace(client);
  useOrderCommandStore.getState().clear();
  useOrderDialogStore.getState().close();
  useOrderDraftStore.getState().reset();
  return invalidation;
}
