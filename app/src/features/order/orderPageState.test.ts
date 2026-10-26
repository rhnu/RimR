import { describe, expect, it } from 'vitest';
import { selectOrderPageState } from './orderPageState';

describe('selectOrderPageState', () => {
  it('keeps the catalog in a loading state while the first scan is fetching', () => {
    expect(
      selectOrderPageState({
        activeList: loaded(),
        scan: fetching(),
        library: idle(),
        hasDraft: false,
      }),
    ).toBe('catalogLoading');
  });

  it('shows no catalog only after scan loading has settled without data', () => {
    expect(
      selectOrderPageState({
        activeList: loaded(),
        scan: idle(),
        library: idle(),
        hasDraft: false,
      }),
    ).toBe('noCatalog');
  });

  it('orders active list, catalog, and mod list startup states', () => {
    expect(
      selectOrderPageState({
        activeList: fetching(),
        scan: fetching(),
        library: fetching(),
        hasDraft: false,
      }),
    ).toBe('activeListLoading');

    expect(
      selectOrderPageState({
        activeList: loaded(),
        scan: loaded(),
        library: fetching(),
        hasDraft: false,
      }),
    ).toBe('modListLoading');

    expect(
      selectOrderPageState({
        activeList: loaded(),
        scan: loaded(),
        library: loaded(),
        hasDraft: true,
      }),
    ).toBe('workspace');
  });
});

function idle() {
  return { hasData: false, isFetching: false, fetchStatus: 'idle' as const, isError: false };
}

function fetching() {
  return { hasData: false, isFetching: true, fetchStatus: 'fetching' as const, isError: false };
}

function loaded() {
  return { hasData: true, isFetching: false, fetchStatus: 'idle' as const, isError: false };
}
