import type { QueryClient } from '@tanstack/react-query';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useOrderDraftStore } from '@/stores/order-draft-store';
import { useOrderDialogStore } from '@/stores/order-dialog-store';
import { useValidationStore } from '@/stores/validation';
import { queryKeys } from './keys';

/** Retire queries before publishing the next workspace identity. */
export async function retireWorkspace(
  client: QueryClient,
  options: { discardDraft?: boolean } = {},
): Promise<void> {
  await client.cancelQueries({ queryKey: queryKeys.workspaceRoot });
  client.removeQueries({ queryKey: queryKeys.workspaceRoot });
  if (options.discardDraft !== false) {
    useOrderDraftStore.getState().reset();
    useOrderDialogStore.getState().close();
  }
  useValidationStore.getState().clear();
  useWorkspaceStore.getState().advance();
}
