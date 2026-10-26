import { useOrderData } from './hooks/useOrderData';
import { useInitializeOrderDraft } from './hooks/useOrderDraft';
import { useOrderDraftStore } from '@/stores/orderDraftStore';
import {
  ActiveListError,
  ActiveListLoading,
  CatalogLoading,
  ModListLoadError,
  ModListLoading,
  NoCatalogState,
} from './OrderPageStates';
import { OrderWorkspaceProvider } from './context/OrderWorkspaceProvider';
import { OrderWorkspaceView } from './OrderWorkspaceView';
import { selectOrderPageState, type QueryLoadState } from './orderPageState';

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
