import { useAppConfig, useLibrary, useLoadActiveList, useCatalogSnapshot } from '@/hooks/commands';
import { needsSetup } from '@/lib/appConfig';

// Stage 7: data-loading entrypoint expressed as a React Query `enabled` dependency chain.
//
//   appConfig → scan → activeList → library
//
// Each downstream query only becomes `enabled` when its upstream is `isSuccess`, so the
// load order is described by the query state machine itself instead of manual effects
// + refetch calls. Mutations in `@/hooks/commands` continue to invalidate the relevant
// query keys; because the queries here are enabled, invalidation transparently triggers
// the appropriate refetches.
export function useOrderData() {
  const appConfig = useAppConfig();
  const setupComplete = appConfig.data != null && !needsSetup(appConfig.data);

  const scan = useCatalogSnapshot({ enabled: setupComplete });
  const activeList = useLoadActiveList({ enabled: scan.isSuccess });
  const library = useLibrary({ enabled: activeList.isSuccess });

  return { appConfig, scan, activeList, library };
}
