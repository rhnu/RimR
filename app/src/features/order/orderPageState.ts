export type QueryLoadState = {
  hasData: boolean;
  isFetching: boolean;
  fetchStatus: 'fetching' | 'paused' | 'idle';
  isError: boolean;
};

export type OrderPageState =
  | 'activeListLoading'
  | 'activeListError'
  | 'catalogLoading'
  | 'noCatalog'
  | 'modListLoading'
  | 'modListLoadError'
  | 'workspace';

export function selectOrderPageState({
  activeList,
  scan,
  library,
  hasDraft,
}: {
  activeList: QueryLoadState;
  scan: QueryLoadState;
  library: QueryLoadState;
  hasDraft: boolean;
}): OrderPageState {
  if (isInitialLoading(activeList)) return 'activeListLoading';
  if (activeList.isError) return 'activeListError';
  if (isInitialLoading(scan)) return 'catalogLoading';
  if (!scan.hasData) return 'noCatalog';
  if (isInitialLoading(library)) return 'modListLoading';
  if (library.isError || !library.hasData || !hasDraft) return 'modListLoadError';
  return 'workspace';
}

function isInitialLoading(state: QueryLoadState): boolean {
  return !state.hasData && (state.isFetching || state.fetchStatus === 'fetching');
}
