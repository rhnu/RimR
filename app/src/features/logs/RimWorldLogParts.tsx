import { useTranslation } from 'react-i18next';
import { ChevronDown, FileText, Loader2, Pause, Play, RefreshCw } from 'lucide-react';
import type { LogEntryDto, LogSourceDto, PlayerLogDto } from '@/commands';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { levelTextClass, type LevelFilter } from './rimWorldLogModel';

const LEVEL_FILTERS: ReadonlyArray<LevelFilter> = ['all', 'exception', 'error', 'warning', 'info'];

function LevelFilterMenu({
  levelFilter,
  onLevelFilterChange,
}: {
  levelFilter: LevelFilter;
  onLevelFilterChange: (value: LevelFilter) => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs">
          <span>{t(`logs.rimworld.level.${levelFilter}`)}</span>
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {LEVEL_FILTERS.map((level) => (
          <DropdownMenuItem
            key={level}
            className="text-xs"
            onClick={() => onLevelFilterChange(level)}
          >
            {t(`logs.rimworld.level.${level}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RimWorldLogToolbar({
  source,
  onSourceChange,
  levelFilter,
  onLevelFilterChange,
  search,
  onSearchChange,
  live,
  onToggleLive,
  isFetching,
  onRefresh,
}: {
  source: LogSourceDto;
  onSourceChange: (source: LogSourceDto) => void;
  levelFilter: LevelFilter;
  onLevelFilterChange: (value: LevelFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  live: boolean;
  onToggleLive: () => void;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <LevelFilterMenu levelFilter={levelFilter} onLevelFilterChange={onLevelFilterChange} />
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={t('logs.rimworld.searchPlaceholder')}
        className="h-8 max-w-xs text-xs"
      />
      <ButtonGroup>
        <Button
          variant={source === 'playerLog' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSourceChange('playerLog')}
        >
          <FileText className="size-4" />
          {t('logs.rimworld.playerLog')}
        </Button>
        <Button
          variant={source === 'playerPrevLog' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSourceChange('playerPrevLog')}
        >
          <FileText className="size-4" />
          {t('logs.rimworld.playerPrevLog')}
        </Button>
      </ButtonGroup>
      <div className="flex-1" />
      <Button variant={live ? 'default' : 'outline'} size="sm" onClick={onToggleLive}>
        {live ? <Pause className="size-4" /> : <Play className="size-4" />}
        {t('logs.rimworld.live')}
      </Button>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={isFetching}>
        {isFetching ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {t('logs.rimworld.refresh')}
      </Button>
    </div>
  );
}

export function RimWorldLogStats({ data }: { data: PlayerLogDto }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="secondary">
        {t('logs.rimworld.stats.total', { count: data.totalLines })}
      </Badge>
      {data.exceptionCount > 0 ? (
        <Badge variant="destructive">
          {t('logs.rimworld.stats.exceptions', { count: data.exceptionCount })}
        </Badge>
      ) : null}
      {data.errorCount > 0 ? (
        <Badge variant="destructive" className="opacity-80">
          {t('logs.rimworld.stats.errors', { count: data.errorCount })}
        </Badge>
      ) : null}
      {data.warningCount > 0 ? (
        <Badge
          variant="outline"
          className="border-yellow-500/30 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
        >
          {t('logs.rimworld.stats.warnings', { count: data.warningCount })}
        </Badge>
      ) : null}
      <span className="font-mono text-xs text-muted-foreground/60">{data.filePath}</span>
    </div>
  );
}

export function LogRow({
  entry,
  onRefClick,
}: {
  entry: LogEntryDto;
  onRefClick: (refId: string) => void;
}) {
  const { t } = useTranslation();
  const levelClass = levelTextClass(entry.level);
  const indent = entry.isStackTrace ? 'pl-6' : '';
  return (
    <div
      className={`flex items-start gap-2 border-b border-border/50 px-2 py-0.5 font-mono text-xs ${indent} ${levelClass}`}
    >
      <span className="w-12 shrink-0 text-muted-foreground/50">{entry.lineNumber}</span>
      <span className="flex-1 min-w-0 whitespace-pre-wrap break-words">{entry.text}</span>
      {entry.refId ? (
        <button
          type="button"
          onClick={() => onRefClick(entry.refId!)}
          className="shrink-0 text-muted-foreground/60 hover:text-foreground"
          title={t('logs.rimworld.refJump', { refId: entry.refId })}
        >
          [Ref {entry.refId}]
        </button>
      ) : null}
      {entry.duplicateRef ? (
        <span className="shrink-0 text-muted-foreground/40">[dup →{entry.duplicateRef}]</span>
      ) : null}
    </div>
  );
}
