import type { ReactNode } from 'react';
import { Grid } from '@/components/ui/layout';
import { cn } from '@/lib/utils';

export function Meta({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <Grid
      asChild
      className="grid-cols-[minmax(0,34%)_minmax(0,1fr)] items-baseline text-xs leading-5"
    >
      <dl>
        <dt className="wrap-anywhere text-muted-foreground">{label}</dt>
        <dd className={cn('min-w-0 wrap-anywhere', mono && 'font-mono')}>{value}</dd>
      </dl>
    </Grid>
  );
}
