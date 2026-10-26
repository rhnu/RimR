import { useOrderData } from './hooks/use-order-data';
import { useInitializeOrderDraft } from './hooks/use-order-draft';
import { useOrderDraftStore } from '@/stores/order-draft-store';
import {
  ActiveListError,
  ActiveListLoading,
  CatalogLoading,
  ModListLoadError,
  ModListLoading,
  NoCatalogState,
} from '@/features/order/ui/order-page-states';
import { OrderWorkspaceProvider } from './context/order-workspace-provider';
import { OrderWorkspaceView } from '@/features/order/ui/order-workspace-view';
import { selectOrderPageState, type QueryLoadState } from '@/features/order/model/order-page-state';

export function OrderPage() {
  const data = useOrderData();
  const { activeList, library, scan, appConfig } = data;
  // Seed the draft store as soon as the library's currentModList is available.
  // Must run BEFORE the switch below: the workspace branch is gated on
  // `hasDraft`, and `OrderWorkspaceProvider` is only mounted inside that
  // branch, so it cannot be the one responsible for seeding the store.
  useInitializeOrderDraft(library.data?.currentModList);
  const draft = useOrderDraftStore((state) => state.draft);
  switch (
    selectOrderPageState({
      activeList: queryLoadState(activeList),
      scan: queryLoadState(scan),
      library: queryLoadState(library),
      hasDraft: draft != null,
    })
  ) {
    case 'activeListLoading':
      return <ActiveListLoading />;
    case 'activeListError':
      return <ActiveListError onRetry={() => void activeList.refetch()} />;
    case 'catalogLoading':
      return <CatalogLoading />;
    case 'noCatalog':
      return <NoCatalogState />;
    case 'modListLoading':
      return <ModListLoading />;
    case 'modListLoadError':
      return <ModListLoadError onRetry={() => void library.refetch()} />;
    case 'workspace': {
      if (!library.data || !draft) {
        return <ModListLoadError onRetry={() => void library.refetch()} />;
      }
      return (
        <OrderWorkspaceProvider
          appConfig={appConfig}
          scan={scan}
          library={library}
          activeList={activeList}
        >
          <OrderWorkspaceView />
        </OrderWorkspaceProvider>
      );
    }
  }
}

function queryLoadState(query: {
  data: unknown;
  isFetching: boolean;
  fetchStatus: QueryLoadState['fetchStatus'];
  isError: boolean;
}): QueryLoadState {
  return {
    hasData: query.data != null,
    isFetching: query.isFetching,
    fetchStatus: query.fetchStatus,
    isError: query.isError,
  };
}
