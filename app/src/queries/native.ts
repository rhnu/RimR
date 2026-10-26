import { useMutation } from '@tanstack/react-query';
import { rimrClient } from '@/commands';
import type {
  OpenConfiguredDirectoryRequest,
  OpenModFolderRequest,
  OpenSteamWorkshopPageRequest,
  ReadSaveModIdsRequest,
} from '@/commands';
import { unwrap } from './client';

export function useOpenConfiguredDirectory() {
  return useMutation({
    mutationFn: (request: OpenConfiguredDirectoryRequest) =>
      unwrap(rimrClient.openConfiguredDirectory(request)),
  });
}

export function useReadSaveModIds() {
  return useMutation({
    mutationFn: (request: ReadSaveModIdsRequest) => unwrap(rimrClient.readSaveModIds(request)),
  });
}

export function useOpenModFolder() {
  return useMutation({
    mutationFn: (request: OpenModFolderRequest) => unwrap(rimrClient.openModFolder(request)),
  });
}

export function useOpenSteamWorkshopPage() {
  return useMutation({
    mutationFn: (request: OpenSteamWorkshopPageRequest) =>
      unwrap(rimrClient.openSteamWorkshopPage(request)),
  });
}

export function useLaunchGame() {
  return useMutation({ mutationFn: () => unwrap(rimrClient.launchGame()) });
}
