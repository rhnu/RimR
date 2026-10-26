import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ModListDto, ModListSummaryDto } from '@/commands';

export interface ModListSwitcherProps {
  modLists: ModListSummaryDto[];
  current: ModListDto;
  onChange: (modListId: string) => void;
}

export function ModListSwitcher({ modLists, current, onChange }: ModListSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs">
          <span className="max-w-[16ch] truncate">{current.name}</span>
          <span className="text-muted-foreground">({modLists.length})</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        {modLists.map((modList) => (
          <DropdownMenuItem
            key={modList.id}
            className="justify-between text-xs"
            onClick={() => onChange(modList.id)}
          >
            <span className="max-w-[24ch] truncate">{modList.name}</span>
            {modList.id === current.id ? <Check className="size-3.5" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
