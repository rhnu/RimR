import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import type { LogEntryDto, LogSourceDto } from '@/commands';
import { Button } from '@/components/ui/button';
import { usePlayerLog } from '@/hooks/useLogs';
import { filterEntries, type LevelFilter } from './rimWorldLogModel';
import { LogRow, RimWorldLogStats, RimWorldLogToolbar } from './RimWorldLogParts';

function buildRefIndexMap(entries: LogEntryDto[]): Map<string, number> {
  const map = new Map<string, number>();
  entries.forEach((entry, index) => {
    if (entry.refId && !map.has(entry.refId)) {
      map.set(entry.refId, index);
    }
  });
  return map;
}

export function RimWorldLogTab() {
  const [source, setSource] = useState<LogSourceDto>('playerLog');
  const { data, isFetching, isError, refetch } = usePlayerLog(source);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [search, setSearch] = useState('');
  const [live, setLive] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!live) return;
    const interval = setInterval(() => {
      void refetch();
    }, 3000);
    return () => clearInterval(interval);
  }, [live, refetch]);

  useEffect(() => {
    void refetch();
  }, [source, refetch]);

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const filtered = useMemo(
    () => filterEntries(entries, levelFilter, search),
    [entries, levelFilter, search],
  );
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 22,
    overscan: 15,
  });
  const refIndexMap = useMemo(() => buildRefIndexMap(filtered), [filtered]);

  const refJump = useCallback(
    (refId: string) => {
      const index = refIndexMap.get(refId);
      if (index != null) virtualizer.scrollToIndex(index, { align: 'start' });
    },
    [refIndexMap, virtualizer],
  );

  const hasData = data != null;
  const onRefresh = () => void refetch();

  return (
    <div className="space-y-2">
      <RimWorldLogToolbar
        source={source}
        onSourceChange={setSource}
        levelFilter={levelFilter}
        onLevelFilterChange={setLevelFilter}
        search={search}
        onSearchChange={setSearch}
        live={live}
        onToggleLive={() => setLive((v) => !v)}
        isFetching={isFetching}
        onRefresh={onRefresh}
      />
      {hasData && data ? <RimWorldLogStats data={data} /> : null}
      <RimWorldLogBody
        isError={isError}
        isFetching={isFetching}
        hasData={hasData}
        filtered={filtered}
        hasFilter={!!search || levelFilter !== 'all'}
        parentRef={parentRef}
        virtualizer={virtualizer}
        onRefresh={onRefresh}
        onRefClick={refJump}
      />
    </div>
  );
}

function RimWorldLogBody({
  isError,
  isFetching,
  hasData,
  filtered,
  hasFilter,
  parentRef,
  virtualizer,
  onRefresh,
  onRefClick,
}: {
  isError: boolean;
  isFetching: boolean;
  hasData: boolean;
  filtered: LogEntryDto[];
  hasFilter: boolean;
  parentRef: RefObject<HTMLDivElement | null>;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  onRefresh: () => void;
  onRefClick: (refId: string) => void;
}) {
  const { t } = useTranslation();

  if (isError) {
    return (
      <div className="rounded-slight border border-border p-3 text-sm text-destructive">
        {t('logs.rimworld.loadError')}
      </div>
    );
  }

  if (!hasData && !isFetching) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-slight border border-border p-8">
        <p className="text-sm text-muted-foreground">{t('logs.rimworld.notLoaded')}</p>
        <Button size="sm" onClick={onRefresh}>
          <RefreshCw className="size-4" />
          {t('logs.rimworld.refresh')}
        </Button>
      </div>
    );
  }

  if (hasData && filtered.length === 0) {
    return (
      <div className="rounded-slight border border-border p-3 text-sm text-muted-foreground">
        {hasFilter ? t('logs.rimworld.noMatch') : t('logs.rimworld.empty')}
      </div>
    );
  }

  return (
    <RimWorldLogList
      parentRef={parentRef}
      filtered={filtered}
      virtualizer={virtualizer}
      onRefClick={onRefClick}
    />
  );
}

function RimWorldLogList({
  parentRef,
  filtered,
  virtualizer,
  onRefClick,
}: {
  parentRef: RefObject<HTMLDivElement | null>;
  filtered: LogEntryDto[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  onRefClick: (refId: string) => void;
}) {
  return (
    <div
      ref={parentRef}
      className="h-[calc(100vh-260px)] overflow-auto rounded-slight border border-border"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: virtualItem.start,
              left: 0,
              width: '100%',
            }}
          >
            <LogRow entry={filtered[virtualItem.index]} onRefClick={onRefClick} />
          </div>
        ))}
      </div>
    </div>
  );
}
