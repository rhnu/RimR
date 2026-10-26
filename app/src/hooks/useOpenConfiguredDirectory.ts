import { rimrClient } from '@/commands';
import type { OpenConfiguredDirectoryRequest } from '@/commands';
import { useMutation } from '@tanstack/react-query';
import { unwrap } from './commands';

export function useOpenConfiguredDirectory() {
  return useMutation({
    mutationFn: (request: OpenConfiguredDirectoryRequest) =>
      unwrap(rimrClient.openConfiguredDirectory(request)),
  });
}
