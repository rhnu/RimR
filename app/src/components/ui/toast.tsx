import { Toaster, type ToasterProps } from 'sonner';

import { cn } from '@/lib/utils';

export function Toast({ className, ...props }: ToasterProps) {
  return (
    <Toaster
      position="bottom-right"
      className={cn('toaster group', className)}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: cn(
            'group rounded-slight border border-border bg-popover text-popover-foreground shadow-sm',
            'flex items-center gap-3 p-3',
          ),
          title: 'text-sm font-medium text-popover-foreground',
          description: 'text-xs text-muted-foreground',
          closeButton:
            'absolute right-1 top-1 rounded-none border-none bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          icon: 'shrink-0',
          success: 'border-l-2 border-l-green-600',
          error: 'border-l-2 border-l-destructive',
          info: 'border-l-2 border-l-blue-500',
          warning: 'border-l-2 border-l-amber-500',
        },
      }}
      {...props}
    />
  );
}
