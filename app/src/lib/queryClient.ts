import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { formatRimrError } from '@/lib/formatError';

function onErrorToast(error: unknown): void {
  const { title, description, descriptionKey } = formatRimrError(error);
  const resolvedDescription = description ?? (descriptionKey ? i18n.t(descriptionKey) : undefined);
  toast.error(title, resolvedDescription ? { description: resolvedDescription } : undefined);
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error) => onErrorToast(error) }),
  mutationCache: new MutationCache({ onError: (error) => onErrorToast(error) }),
  defaultOptions: {
    mutations: { retry: 0 },
  },
});
