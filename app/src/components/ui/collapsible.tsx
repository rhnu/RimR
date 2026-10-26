import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Collapsible({ title, defaultOpen = false, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-7 w-full select-none items-center gap-1 px-2 text-xs font-semibold uppercase text-muted-foreground hover:bg-muted/50"
      >
        <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
        {title}
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-in-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 p-2 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
