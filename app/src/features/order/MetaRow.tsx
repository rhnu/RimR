import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Meta({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('break-words text-sm', mono && 'font-mono text-xs')}>{value}</div>
    </div>
  );
}
