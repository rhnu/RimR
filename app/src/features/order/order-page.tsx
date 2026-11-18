import { useOrderData } from './hooks/use-order-data';
import { useInitializeOrderDraft, useOrderDraft } from './hooks/use-order-draft';
import {
  ActiveListError,
  ActiveListLoading,
  CatalogLoading,
  ModListLoadError,
  ModListLoading,
  NoCatalogState,
} from '@/features/order/ui/order-page-states';
import { OrderWorkspace } from './workspace/order-workspace';
import { selectOrderPageState, type QueryLoadState } from '@/features/order/model/order-page-state';

export function OrderPage() {
  const data = useOrderData();
  const { activeList, library, scan } = data;
  // Initialize before mounting the workspace for the selected list.
  useInitializeOrderDraft(library.data?.currentModList);
  const draftState = useOrderDraft();
  const draft = draftState.draft?.id === library.data?.currentModList.id ? draftState.draft : null;
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
        return <ModListLoading />;
      }
      return (
        <OrderWorkspace
          data={{ scan, activeList }}
          library={library.data}
          draftState={{ ...draftState, draft }}
        />
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
