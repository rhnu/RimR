import type { LogEntryDto, LogLevelDto } from '@/commands';

export type LevelFilter = 'all' | LogLevelDto;

export function filterEntries(
  entries: LogEntryDto[],
  level: LevelFilter,
  search: string,
): LogEntryDto[] {
  let result = entries;
  if (level !== 'all') {
    result = result.filter((e) => e.level === level);
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    result = result.filter((e) => e.text.toLowerCase().includes(q));
  }
  return result;
}

export function levelTextClass(level: LogLevelDto): string {
  switch (level) {
    case 'exception':
      return 'text-destructive font-semibold';
    case 'error':
      return 'text-destructive/80';
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'info':
      return 'text-foreground/80';
  }
}
