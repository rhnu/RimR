import type { MouseEvent } from 'react';
import type {
  DisplayAliasDto,
  ModIdentityDto,
  ModListEntryDto,
  ModMetadataDto,
  ModListGroupChildDto,
  ModTagBindingDto,
  SteamWorkshopOpenTarget,
  TagDefDto,
} from '@/commands';
import type { DiagnosticItem } from '@/domain/diagnostics/suppression';
import type { RowDiagnosticMenus } from '../diagnostic-menu-items';
import type { Selection } from '@/features/order/types';
import type { DropIndicatorStore } from '@/features/order/hooks/drop-indicator-store';

export type WarmFileInfo = (sourceKey: string | null | undefined, immediate?: boolean) => void;

export type ActiveEntryRowProps = {
  entry: ModListEntryDto;
  aliases: DisplayAliasDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  diagnostics: DiagnosticItem[];
  diagnosticMenus: RowDiagnosticMenus;
  tagDefs: TagDefDto[];
  modTags: ModTagBindingDto[];
  tagTargetIdentities: ModIdentityDto[];
  selected: boolean;
  canCreateGroup: boolean;
  onSelect: (
    entry: ModListEntryDto,
    selection: Selection,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void;
  onContextOpen: (entry: ModListEntryDto) => void;
  onRemove: (entryId: string) => void;
  onUngroup: (groupId: string) => void;
  onCreateGroup: () => void;
  onEditAlias: (identity: ModIdentityDto) => void;
  onAddSeparator: (entry: ModListEntryDto) => void;
  onRenameGroup: (entryId: string, name: string) => void;
  onRenameSeparator: (entryId: string, title: string) => void;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
  onWarmFileInfo: WarmFileInfo;
  onDoubleClick: (entry: ModListEntryDto) => void;
  onToggleModTag: (identities: ModIdentityDto[], tagId: string) => void;
  onCreateTag: (name: string, color: string | null) => void;
  onRenameTag: (tagId: string, name: string) => void;
  onSetTagColor: (tagId: string, color: string | null) => void;
  onDeleteTag: (tagId: string) => void;
  onReorderModTags: (identity: ModIdentityDto, tagIds: string[]) => void;
  dropIndicatorStore: DropIndicatorStore;
};

export type GroupChildRowProps = {
  groupId: string;
  child: ModListGroupChildDto;
  aliases: DisplayAliasDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  tagDefs: TagDefDto[];
  modTags: ModTagBindingDto[];
  diagnostics: DiagnosticItem[];
  diagnosticMenus: RowDiagnosticMenus;
  onWarmFileInfo: WarmFileInfo;
  onSelect: (child: ModListGroupChildDto) => void;
  onDoubleClick: (groupId: string, childId: string) => void;
  onEditAlias: (identity: ModIdentityDto) => void;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
  onToggleModTag: (identities: ModIdentityDto[], tagId: string) => void;
  onCreateTag: (name: string, color: string | null) => void;
  onRenameTag: (tagId: string, name: string) => void;
  onSetTagColor: (tagId: string, color: string | null) => void;
  onDeleteTag: (tagId: string) => void;
  onReorderModTags: (identity: ModIdentityDto, tagIds: string[]) => void;
  onRemove: (groupId: string, childId: string) => void;
  dropIndicatorStore: DropIndicatorStore;
};
