import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

/** Evaluate updates only after preceding edits have published their new revision. */
export function useUpdateLibrarySettings() {
  const client = useQueryClient();
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useMutation({
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
    scope: { id: 'library-lists-' + epoch },
    mutationFn: (request: Request) => inWorkspace(epoch, () => operation(request)),
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
    (request) => rimrClient.createModList(request),
    true,
  );
}

export function useSaveModList() {
  return useModListMutation<SaveModListRequest>(
    (request) => rimrClient.saveModList(request),
    false,
  );
}

export function useSetCurrentModList() {
  return useModListMutation<SetCurrentModListRequest>(
    (request) => rimrClient.setCurrentModList(request),
    true,
  );
}

export function useDeleteModList() {
  const client = useQueryClient();
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useMutation({
    scope: { id: 'library-lists-' + epoch },
    mutationFn: (request: DeleteModListRequest) =>
      inWorkspace(epoch, () => rimrClient.deleteModList(request)),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.library(epoch) }),
  });
}
