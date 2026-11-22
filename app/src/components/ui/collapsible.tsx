import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible as Disclosure } from 'radix-ui';
import { cn } from '@/lib/utils';

export interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  contentClassName?: string;
  children: ReactNode;
}

export function Collapsible({
  title,
  defaultOpen = false,
  contentClassName,
  children,
}: CollapsibleProps) {
  return (
    <Disclosure.Root defaultOpen={defaultOpen}>
      <Disclosure.Trigger className="group flex min-h-8 w-full items-center justify-between gap-2 px-2 text-start text-sm font-semibold select-none hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
        {title}
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground group-data-[state=open]:rotate-180 motion-safe:transition-transform motion-safe:duration-120 motion-safe:ease-out"
        />
      </Disclosure.Trigger>
      <Disclosure.Content className={cn('space-y-2 px-2 pb-2', contentClassName)}>
        {children}
      </Disclosure.Content>
    </Disclosure.Root>
  );
}
