import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function ButtonGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'inline-flex items-center',
        '[&>*]:-ml-px',
        '[&>*]:focus:z-10',
        '[&>*:first-child]:ml-0',
        '[&>*:first-child]:rounded-l-slight',
        '[&>*:first-child]:rounded-r-none',
        '[&>*:last-child]:rounded-r-slight',
        '[&>*:last-child]:rounded-l-none',
        '[&>*:not(:first-child):not(:last-child)]:rounded-none',
        className,
      )}
    >
      {children}
    </div>
  );
}
