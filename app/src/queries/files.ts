import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rimrClient } from '@/commands';
import type {
  ExportGameConfigBackupRequest,
  ImportGameConfigBackupRequest,
  ExportModListFileRequest,
  ImportModListFileRequest,
  ExportLibrarySettingsFileRequest,
  ImportLibrarySettingsFileRequest,
} from '@/commands';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { inWorkspace } from './client';
import { queryKeys } from './keys';

export function useExportGameConfigBackup() {
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useMutation({
    mutationFn: (request: ExportGameConfigBackupRequest) =>
      inWorkspace(epoch, () => rimrClient.exportGameConfigBackup(request)),
  });
}

export function useImportGameConfigBackup() {
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useMutation({
    mutationFn: (request: ImportGameConfigBackupRequest) =>
      inWorkspace(epoch, () => rimrClient.importGameConfigBackup(request)),
  });
}

export function useExportModListFile() {
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useMutation({
    mutationFn: (request: ExportModListFileRequest) =>
      inWorkspace(epoch, () => rimrClient.exportModListFile(request)),
  });
}

export function useImportModListFile() {
  const queryClient = useQueryClient();
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useMutation({
    mutationFn: (request: ImportModListFileRequest) =>
      inWorkspace(epoch, () => rimrClient.importModListFile(request)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library(epoch) });
    },
  });
}

export function useExportLibrarySettingsFile() {
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useMutation({
    mutationFn: (request: ExportLibrarySettingsFileRequest) =>
      inWorkspace(epoch, () => rimrClient.exportLibrarySettingsFile(request)),
  });
}

export function useImportLibrarySettingsFile() {
  const queryClient = useQueryClient();
  const epoch = useWorkspaceStore((state) => state.epoch);
  return useMutation({
    mutationFn: (request: ImportLibrarySettingsFileRequest) =>
      inWorkspace(epoch, () => rimrClient.importLibrarySettingsFile(request)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library(epoch) });
    },
  });
}
