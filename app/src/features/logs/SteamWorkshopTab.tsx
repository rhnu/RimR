import { useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from 'lucide-react';
import type { SteamWorkshopLogDto, SteamWorkshopLogEntryDto } from '@/commands';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSteamWorkshopLog } from '@/hooks/useLogs';

export function SteamWorkshopTab() {
  const query = useSteamWorkshopLog();
  const [search, setSearch] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => query.data?.entries ?? [], [query.data]);
  const filtered = useMemo(() => filterWorkshopEntries(entries, search), [entries, search]);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  const hasData = query.data != null;
  const onRefresh = () => void query.refetch();

  return (
    <div className="space-y-2">
      <SteamWorkshopToolbar
        search={search}
        onSearchChange={setSearch}
        hasData={hasData}
        filteredCount={filtered.length}
        totalCount={entries.length}
        isFetching={query.isFetching}
        onRefresh={onRefresh}
      />
      <SteamWorkshopBody
        isError={query.isError}
        isFetching={query.isFetching}
        hasData={hasData}
        data={query.data}
        filtered={filtered}
        hasSearch={!!search}
        parentRef={parentRef}
        virtualizer={virtualizer}
        onRefresh={onRefresh}
      />
    </div>
  );
}

function SteamWorkshopToolbar({
  search,
  onSearchChange,
  hasData,
  filteredCount,
  totalCount,
  isFetching,
  onRefresh,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  hasData: boolean;
  filteredCount: number;
  totalCount: number;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={t('logs.steam.searchPlaceholder')}
        className="h-8 max-w-xs text-xs"
      />
      <div className="flex-1" />
      {hasData ? (
        <Badge variant="secondary">
          {filteredCount}/{totalCount}
        </Badge>
      ) : null}
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={isFetching}>
        {isFetching ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {t('logs.steam.refresh')}
      </Button>
    </div>
  );
}

function SteamWorkshopBody({
  isError,
  isFetching,
  hasData,
  data,
  filtered,
  hasSearch,
  parentRef,
  virtualizer,
  onRefresh,
}: {
  isError: boolean;
  isFetching: boolean;
  hasData: boolean;
  data: SteamWorkshopLogDto | undefined;
  filtered: SteamWorkshopLogEntryDto[];
  hasSearch: boolean;
  parentRef: RefObject<HTMLDivElement | null>;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();

  if (isError) {
    return (
      <div className="rounded-slight border border-border p-3 text-sm text-destructive">
        {t('logs.steam.loadError')}
      </div>
    );
  }

  if (!hasData && !isFetching) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-slight border border-border p-8">
        <p className="text-sm text-muted-foreground">{t('logs.steam.notLoaded')}</p>
        <Button size="sm" onClick={onRefresh}>
          <RefreshCw className="size-4" />
          {t('logs.steam.refresh')}
        </Button>
      </div>
    );
  }

  if (data && !data.found) {
    return (
      <div className="rounded-slight border border-border p-3">
        <p className="text-sm text-muted-foreground">{t('logs.steam.notFound')}</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{data.acfPath}</p>
      </div>
    );
  }

  if (data && filtered.length === 0) {
    return (
      <div className="rounded-slight border border-border p-3 text-sm text-muted-foreground">
        {hasSearch ? t('logs.steam.noMatch') : t('logs.steam.noEntries')}
      </div>
    );
  }

  return <SteamWorkshopList parentRef={parentRef} filtered={filtered} virtualizer={virtualizer} />;
}

function SteamWorkshopList({
  parentRef,
  filtered,
  virtualizer,
}: {
  parentRef: RefObject<HTMLDivElement | null>;
  filtered: SteamWorkshopLogEntryDto[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-slight border border-border">
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
        <span className="flex-1">{t('logs.steam.columnMod')}</span>
        <span className="w-48">{t('logs.steam.columnPackageId')}</span>
        <span className="w-36">{t('logs.steam.columnFileId')}</span>
        <span className="w-36">{t('logs.steam.columnUpdated')}</span>
        <span className="w-36">{t('logs.steam.columnTouched')}</span>
      </div>
      <div ref={parentRef} className="h-[calc(100vh-250px)] overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {virtualizer.getVirtualItems().map((virtualItem) => (
            <SteamWorkshopRow
              key={virtualItem.key}
              entry={filtered[virtualItem.index]}
              style={{
                position: 'absolute',
                top: virtualItem.start,
                left: 0,
                width: '100%',
                height: virtualItem.size,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SteamWorkshopRow({
  entry,
  style,
}: {
  entry: SteamWorkshopLogEntryDto;
  style: CSSProperties;
}) {
  const { t } = useTranslation();
  return (
    <div style={style} className="flex items-center gap-3 border-b border-border px-3 text-sm">
      <span className="flex-1 truncate">{entry.modName ?? t('logs.steam.unknownMod')}</span>
      <span className="w-48 truncate font-mono text-xs text-muted-foreground">
        {entry.packageId ?? '—'}
      </span>
      <span className="w-36 font-mono text-xs text-muted-foreground">{entry.publishedFileId}</span>
      <span className="w-36 text-xs text-muted-foreground">
        {formatTimestamp(entry.timeUpdatedMs)}
      </span>
      <span className="w-36 text-xs text-muted-foreground">
        {formatTimestamp(entry.timeTouchedMs)}
      </span>
    </div>
  );
}

function filterWorkshopEntries(
  entries: SteamWorkshopLogEntryDto[],
  search: string,
): SteamWorkshopLogEntryDto[] {
  if (!search.trim()) return entries;
  const q = search.toLowerCase();
  return entries.filter(
    (e) =>
      e.publishedFileId.toLowerCase().includes(q) ||
      (e.modName?.toLowerCase().includes(q) ?? false) ||
      (e.packageId?.toLowerCase().includes(q) ?? false),
  );
}

function formatTimestamp(ms: number): string {
  if (ms === 0) return '—';
  return new Date(ms).toLocaleString();
}
