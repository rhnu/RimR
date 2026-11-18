import {
  CancelledError,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { rimrClient } from '@/commands';
import type {
  CreateModListRequest,
  DeleteModListRequest,
  LibraryDto,
  LibrarySettingsDto,
  ModListDto,
  SaveModListRequest,
  SetCurrentModListRequest,
} from '@/commands';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { assertWorkspace, inWorkspace, readQuery } from './client';
import type { QueryEnableOptions } from './catalog';
import { queryKeys } from './keys';

type CurrentModListConstraint = { expectedCurrentModListId?: string };

function assertCurrentModList(
  client: QueryClient,
  epoch: number,
  expectedCurrentModListId: string | undefined,
): void {
  if (expectedCurrentModListId === undefined) return;
  const library = client.getQueryData<LibraryDto>(queryKeys.library(epoch));
  if (library?.currentModList.id !== expectedCurrentModListId) throw new CancelledError();
}

export function useLibrary(options?: QueryEnableOptions) {
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useQuery({
    queryKey: queryKeys.library(epoch),
    queryFn: ({ signal }) => readQuery(rimrClient.loadLibrary(), signal),
    enabled: options?.enabled ?? false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Read the cached library alongside the workspace identity it belongs to. */
export function readCurrentLibrary(client: QueryClient) {
  const epoch = useWorkspaceStore.getState().epoch;
  return { epoch, library: client.getQueryData<LibraryDto>(queryKeys.library(epoch)) };
}

/** Evaluate updates only after preceding edits have published their new revision. */
export function useUpdateLibrarySettings() {
  const client = useQueryClient();
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useMutation({
    meta: { blocksUpdate: true },
    scope: { id: 'library-settings-' + epoch },
    mutationFn: (update: (current: LibrarySettingsDto) => LibrarySettingsDto) => {
      assertWorkspace(epoch);
      const current = client.getQueryData<LibraryDto>(queryKeys.library(epoch));
      if (!current) throw new Error('The library is not loaded');
      return inWorkspace(epoch, () =>
        rimrClient.saveLibrarySettings({ settings: update(current.settings) }),
      );
    },
    onSuccess: (settings) => {
      client.setQueryData<LibraryDto>(queryKeys.library(epoch), (current) =>
        current ? { ...current, settings } : current,
      );
    },
  });
}

function useModListMutation<Request>(
  operation: (request: Request) => ReturnType<typeof rimrClient.saveModList>,
  select: boolean,
) {
  const client = useQueryClient();
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useMutation({
    meta: { blocksUpdate: true },
    scope: { id: 'library-lists-' + epoch },
    mutationFn: (request: Request & CurrentModListConstraint) =>
      inWorkspace(epoch, () => {
        // A preceding selection can change the current list while this mutation is queued.
        assertCurrentModList(client, epoch, request.expectedCurrentModListId);
        return operation(request);
      }),
    onSuccess: async (modList: ModListDto) => {
      client.setQueryData<LibraryDto>(queryKeys.library(epoch), (current) => {
        if (!current) return current;
        const summaries = current.modListsIndex.modLists.filter((item) => item.id !== modList.id);
        const isCurrent = select || current.currentModList.id === modList.id;
        return {
          ...current,
          currentModList: isCurrent ? modList : current.currentModList,
          modListsIndex: {
            ...current.modListsIndex,
            currentModListId: select ? modList.id : current.modListsIndex.currentModListId,
            modLists: [...summaries, { id: modList.id, name: modList.name }],
          },
        };
      });
      await client.invalidateQueries({ queryKey: queryKeys.library(epoch) });
    },
  });
}

export function useCreateModList() {
  return useModListMutation<CreateModListRequest>(
    ({ name, baseModList }) => rimrClient.createModList({ name, baseModList }),
    true,
  );
}

export function useSaveModList() {
  return useModListMutation<SaveModListRequest>(
    ({ modList }) => rimrClient.saveModList({ modList }),
    false,
  );
}

export function useSetCurrentModList() {
  return useModListMutation<SetCurrentModListRequest>(
    ({ modListId }) => rimrClient.setCurrentModList({ modListId }),
    true,
  );
}

export function useDeleteModList() {
  const client = useQueryClient();
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useMutation({
    meta: { blocksUpdate: true },
    scope: { id: 'library-lists-' + epoch },
    mutationFn: ({
      modListId,
      expectedCurrentModListId,
    }: DeleteModListRequest & CurrentModListConstraint) =>
      inWorkspace(epoch, () => {
        assertCurrentModList(client, epoch, expectedCurrentModListId);
        return rimrClient.deleteModList({ modListId });
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.library(epoch) }),
  });
}
