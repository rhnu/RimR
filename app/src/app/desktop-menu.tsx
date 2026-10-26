import type { ReactNode, Ref } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type MenuId = 'file' | 'modList' | 'tools' | 'view' | 'settings' | 'help';

export function DesktopMenu({
  label,
  id,
  openMenu,
  setOpenMenu,
  children,
  triggerRef,
}: {
  label: string;
  id: MenuId;
  openMenu: MenuId | null;
  setOpenMenu: (menu: MenuId | null) => void;
  children: ReactNode;
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  const open = openMenu === id;
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) setOpenMenu(id);
        else if (openMenu === id) setOpenMenu(null);
      }}
      modal={false}
    >
      <div className="relative h-full">
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            className={cn(
              'h-full px-3 text-xs text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              open && 'bg-accent',
            )}
            onMouseEnter={() => {
              if (openMenu) setOpenMenu(id);
            }}
          >
            {label}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={0}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="min-w-48 rounded-slight border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {children}
        </DropdownMenuContent>
      </div>
    </DropdownMenu>
  );
}
