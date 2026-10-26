import type {
  ModIdentityDto,
  ModListDto,
  ModListEntryDto,
  ModListGroupChildDto,
  ModMetadataDto,
} from '@/commands';

export type ModEntry = Extract<ModListEntryDto, { kind: 'mod' }>;
export type GroupEntry = Extract<ModListEntryDto, { kind: 'group' }>;
export type SeparatorEntry = Extract<ModListEntryDto, { kind: 'separator' }>;

export type EntryIdGenerator = () => string;

export type DropEdge = 'before' | 'inside' | 'after';

export type DropIntent = {
  containerId: string;
  targetId: string;
  edge: DropEdge;
};

export type ModListAction =
  | { type: 'addMod'; mod: ModMetadataDto; index: number }
  | { type: 'addMods'; mods: ModMetadataDto[]; index: number }
  | { type: 'addModToGroup'; groupId: string; mod: ModMetadataDto; index: number }
  | { type: 'addModsToGroup'; groupId: string; mods: ModMetadataDto[]; index: number }
  | { type: 'removeEntry'; entryId: string }
  | { type: 'removeEntries'; entryIds: string[] }
  | { type: 'removeGroupChild'; groupId: string; childId: string }
  | { type: 'setEntryActive'; entryId: string; active: boolean }
  | { type: 'setEntriesActive'; entryIds: string[]; active: boolean }
  | { type: 'setGroupChildrenActive'; groupId: string; childIds: string[]; active: boolean }
  | {
      type: 'moveEntry';
      entryId: string;
      targetEntryId: string;
      edge: Exclude<DropEdge, 'inside'>;
    }
  | {
      type: 'moveEntries';
      entryIds: string[];
      targetEntryId: string;
      edge: Exclude<DropEdge, 'inside'>;
    }
  | {
      type: 'moveEntriesAndSetActive';
      entryIds: string[];
      targetEntryId: string;
      edge: Exclude<DropEdge, 'inside'>;
      active: boolean;
    }
  | {
      type: 'moveEntriesToIndexAndSetActive';
      entryIds: string[];
      index: number;
      active: boolean;
    }
  | {
      type: 'moveEntriesToGroupAndSetActive';
      entryIds: string[];
      groupId: string;
      index: number;
      active: boolean;
    }
  | { type: 'moveEntriesToGroup'; entryIds: string[]; groupId: string; index: number }
  | {
      type: 'moveGroupChild';
      groupId: string;
      childId: string;
      targetChildId: string;
      edge: Exclude<DropEdge, 'inside'>;
    }
  | {
      type: 'setGroupChildrenActiveAndMoveGroup';
      groupId: string;
      childIds: string[];
      active: boolean;
      index?: number;
      targetEntryId?: string;
      edge?: Exclude<DropEdge, 'inside'>;
    }
  | { type: 'createGroup'; entryIds: string[]; groupId: string; name: string }
  | {
      type: 'createGroupFromMods';
      mods: ModMetadataDto[];
      groupId: string;
      name: string;
      index: number;
      active?: boolean;
    }
  | { type: 'renameGroup'; groupId: string; name: string }
  | { type: 'ungroup'; groupId: string }
  | { type: 'insertSeparator'; separator: ModListEntryDto; index: number }
  | { type: 'renameSeparator'; entryId: string; title: string }
  | { type: 'replace'; modList: ModListDto };

export type OrderDiffItem =
  | { kind: 'added'; packageId: string; toIndex: number }
  | { kind: 'removed'; packageId: string; fromIndex: number }
  | { kind: 'moved'; packageId: string; fromIndex: number; toIndex: number }
  | { kind: 'groupSplit'; groupName: string; packageIds: string[] }
  | { kind: 'separatorMoved'; title: string }
  | { kind: 'missingSkipped'; packageId: string; label: string }
  | { kind: 'noChange' };

export type OrderDiff = {
  before: string[];
  after: string[];
  items: OrderDiffItem[];
};

export type OrderStructureEvent = Exclude<
  OrderDiffItem,
  { kind: 'added' } | { kind: 'removed' } | { kind: 'moved' } | { kind: 'noChange' }
>;

export type GameSyncResult = {
  modList: ModListDto;
  diff: OrderDiff;
};

export type PackageIdentityMap = Map<string, ModIdentityDto>;
export type CatalogByPackage = Map<string, ModMetadataDto>;
export type GroupChild = ModListGroupChildDto;
