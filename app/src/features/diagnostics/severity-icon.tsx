import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { SeverityDto } from '@/commands';
import { cn } from '@/lib/utils';

const icons = {
  error: [CircleAlert, 'text-destructive'],
  warning: [TriangleAlert, 'text-warning'],
  info: [Info, 'text-muted-foreground'],
} as const;

/** Keeps diagnostic levels recognizable across the toolbar, lists, and reports. */
export function SeverityIcon({
  severity,
  className,
}: {
  severity: SeverityDto;
  className?: string;
}) {
  const [Icon, color] = icons[severity];
  return <Icon aria-hidden="true" className={cn('size-4 shrink-0', color, className)} />;
}
