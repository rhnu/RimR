import type { ReactNode } from 'react';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from './dropdown-menu';

export function MenuItem({
  active,
  disabled,
  onSelect,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex h-7 w-full items-center px-2 text-left text-xs hover:bg-accent disabled:opacity-50',
        active && 'bg-accent font-medium',
      )}
    >
      {children}
    </DropdownMenuItem>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium uppercase text-muted-foreground">
      {children}
    </DropdownMenuLabel>
  );
}

export function MenuSeparator() {
  return <DropdownMenuSeparator className="my-1 h-px bg-border" />;
}

export function MenuSub({ children }: { children: ReactNode }) {
  return <DropdownMenuPrimitive.Sub>{children}</DropdownMenuPrimitive.Sub>;
}

export function MenuSubTrigger({ children }: { children: ReactNode }) {
  return (
    <DropdownMenuPrimitive.SubTrigger asChild>
      <button
        type="button"
        className="flex h-7 w-full cursor-default items-center justify-between px-2 text-left text-xs outline-hidden select-none hover:bg-accent focus:bg-accent data-[state=open]:bg-accent"
      >
        {children}
        <span aria-hidden>›</span>
      </button>
    </DropdownMenuPrimitive.SubTrigger>
  );
}

export function MenuSubContent({ children }: { children: ReactNode }) {
  return (
    <DropdownMenuPrimitive.SubContent
      sideOffset={-2}
      alignOffset={-4}
      className="z-50 min-w-44 rounded-slight border border-border bg-popover p-1 text-popover-foreground shadow-lg"
    >
      {children}
    </DropdownMenuPrimitive.SubContent>
  );
}
