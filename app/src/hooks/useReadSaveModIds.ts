import { useMutation } from '@tanstack/react-query';
import { rimrClient } from '@/commands';
import type { ReadSaveModIdsRequest } from '@/commands';
import { unwrap } from '@/hooks/commands';

export function useReadSaveModIds() {
  return useMutation({
    mutationFn: (request: ReadSaveModIdsRequest) => unwrap(rimrClient.readSaveModIds(request)),
  });
}
