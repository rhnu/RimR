import {
  CancelledError,
  isCancelledError,
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import type { RimrResult } from '@/commands';
import i18n from '@/i18n';
import { formatRimrError } from '@/commands/errors';
import { useWorkspaceStore } from '@/stores/workspace-store';

export function reportError(error: unknown): void {
  if (isCancelledError(error)) return;
  const { title, description, descriptionKey } = formatRimrError(error);
  const detail = description ?? (descriptionKey ? i18n.t(descriptionKey) : undefined);
  toast.error(title, detail ? { description: detail } : undefined);
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.getObserversCount() > 0) reportError(error);
    },
  }),
  mutationCache: new MutationCache({ onError: reportError }),
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

export function unwrap<T>(result: RimrResult<T>): Promise<T> {
  return result.match(
    (value) => value,
    (error) => {
      throw error;
    },
  );
}

export async function readQuery<T>(result: RimrResult<T>, signal: AbortSignal): Promise<T> {
  const value = await unwrap(result);
  signal.throwIfAborted();
  return value;
}

export function assertWorkspace(epoch: number): void {
  if (useWorkspaceStore.getState().epoch !== epoch) throw new CancelledError();
}

export async function inWorkspace<T>(epoch: number, operation: () => RimrResult<T>): Promise<T> {
  assertWorkspace(epoch);
  try {
    const result = await unwrap(operation());
    assertWorkspace(epoch);
    return result;
  } catch (error) {
    assertWorkspace(epoch);
    throw error;
  }
}
