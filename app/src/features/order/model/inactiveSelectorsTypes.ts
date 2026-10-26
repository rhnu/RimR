import type {
  DisplayAliasDto,
  ModListEntryDto,
  ModListGroupChildDto,
  ModMetadataDto,
} from '@/commands';
import type { AvailableModSortKey, SortDirection } from '@/lib/availableMods';
import type { CompiledSmartSearch } from './smartSearch';

export type InactiveRenderRow =
  | {
      kind: 'catalog';
      id: string;
      mod: ModMetadataDto;
      depth: 0;
      missing: false;
    }
  | {
      kind: 'entry';
      id: string;
      entry: ModListEntryDto;
      entryId: string;
      depth: 0;
      missing: boolean;
    }
  | {
      kind: 'child';
      id: string;
      groupId: string;
      child: ModListGroupChildDto;
      parent: Extract<ModListEntryDto, { kind: 'group' }>;
      depth: 1;
      missing: boolean;
    };

export type InactiveRenderContext = {
  searchOptions: {
    aliases: DisplayAliasDto[];
    modByPackageId: Map<string, ModMetadataDto>;
  };
  search: CompiledSmartSearch;
  catalogPackageIds: Set<string>;
  sortKey: AvailableModSortKey;
  sortDirection: SortDirection;
};
