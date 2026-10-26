import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Splash({
  message,
  detail,
  className,
}: {
  message: string;
  detail?: string;
  className?: string;
}) {
  return (
    <output
      className={cn(
        'flex h-full min-h-[220px] items-center justify-center p-4 text-sm text-muted-foreground',
        className,
      )}
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <div className="space-y-1">
          <p>{message}</p>
          {detail ? <p className="text-xs">{detail}</p> : null}
        </div>
      </div>
    </output>
  );
}
