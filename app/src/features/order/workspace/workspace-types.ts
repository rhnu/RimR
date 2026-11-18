import type { MouseEvent } from 'react';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import type {
  ActiveListLoadDto,
  CatalogSnapshotDto,
  LibraryDto,
  LibrarySettingsDto,
  ModIdentityDto,
  ModListDto,
  ModListEntryDto,
  ModListGroupChildDto,
  ModMetadataDto,
} from '@/commands';
import type { ModListAction, GameSyncResult } from '@/domain/mod-list/types';
import type { DiagnosticState } from '@/domain/diagnostics/suppression';
import type { AvailableModSortKey, SortDirection } from '@/domain/mods/available-mods';
import type { ActiveRenderRow, InactiveRenderRow } from '../model/selectors';
import type { DropIndicatorStore } from '../hooks/drop-indicator-store';
import type { DragOverlayState } from '../model/drag-overlay';
import type { OrderDialog, Selection } from '../types';

export type QueryResource<T> = {
  data: T | undefined;
  dataUpdatedAt: number;
  isFetching: boolean;
  isError: boolean;
  fetchStatus: 'fetching' | 'paused' | 'idle';
  refetch: (options?: { throwOnError?: boolean }) => Promise<{ data: T | undefined }>;
};
export type OrderWorkspaceData = {
  scan: QueryResource<CatalogSnapshotDto>;
  activeList: QueryResource<ActiveListLoadDto>;
};
export type OrderData = OrderWorkspaceData & {
  library: QueryResource<LibraryDto>;
};
export type OrderModSettings = Required<
  Pick<LibrarySettingsDto, 'aliases' | 'tagDefs' | 'modTags'>
>;
export type OrderDraftState = {
  draft: ModListDto | null;
  baseline: ModListDto | null;
  modListDirty: boolean;
  hasConflict: boolean;
  applyDraft: (action: ModListAction) => void;
  acceptSaved: (submitted: ModListDto, saved: ModListDto) => void;
  replaceSavedDraft: (modList: ModListDto) => void;
  resetToBaseline: () => void;
};
export type OrderFilters = {
  availableSortKey: AvailableModSortKey;
  setAvailableSortKey: (key: AvailableModSortKey) => void;
  availableSortDirection: SortDirection;
  toggleAvailableSortDirection: () => void;
  inactiveSearch: string;
  setInactiveSearch: (value: string) => void;
  activeSearch: string;
  setActiveSearch: (value: string) => void;
};
export type OrderDerived = {
  mods: ModMetadataDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  modByCatalogKey: Map<string, ModMetadataDto>;
  sortedInactiveMods: ModMetadataDto[];
  inactiveRows: InactiveRenderRow[];
  activeRows: ActiveRenderRow[];
  diagnostics: DiagnosticState;
  activeCount: number;
  draftActiveModsKey: string;
  gameActiveModsKey: string;
  inactiveCatalogKeys: string[];
  inactiveSourceKeys: (string | null | undefined)[];
  visibleActiveEntryIds: string[];
  activeSourceKeys: (string | null | undefined)[];
};
export type OrderPreview = {
  warmModPreview: (sourceKey: string | null | undefined, immediate?: boolean) => void;
  warmSelectedPreview: (
    sourceKey: string | null | undefined,
    orderedSourceKeys: readonly (string | null | undefined)[],
  ) => void;
};
export type OrderSelection = {
  selection: Selection;
  selectedEntryIds: Set<string>;
  selectedInactiveCatalogKeys: Set<string>;
  resetSelections: () => void;
  selectInactiveMod: (mod: ModMetadataDto, event: MouseEvent<HTMLButtonElement>) => void;
  selectActiveEntry: (
    entry: ModListEntryDto,
    selectedEntry: Selection,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void;
  ensureInactiveSelected: (mod: ModMetadataDto) => void;
  ensureActiveSelected: (entry: ModListEntryDto) => void;
  selectGroupChild: (child: ModListGroupChildDto) => void;
};
export type OrderCommands = {
  savePending: boolean;
  applyPending: boolean;
  handleSaveModList: () => void;
  handleApply: (modList?: ModListDto | null) => void;
  handleSaveAlias: (identity: ModIdentityDto, displayAlias: string) => void;
  handleSetCurrentModList: (modListId: string) => void;
};
export type OrderSync = {
  handleSyncFromGame: () => void;
  handleRebuildCatalog: () => void;
  applyGameSync: (result: GameSyncResult) => void;
  applySaveSync: (result: GameSyncResult) => void;
  applyMissingModRemoval: (modList: ModListDto, packageIds: string[]) => void;
};
export type OrderEditActions = {
  setDialog: (dialog: OrderDialog) => void;
  handleDialogSubmit: (value: string) => void;
  addInactiveMod: (mod: ModMetadataDto) => void;
  activateInactiveEntry: (entryId: string) => void;
  activateInactiveChild: (groupId: string, childId: string) => void;
  createInactiveGroupDialog: () => void;
  editInactiveAlias: (mod: ModMetadataDto) => void;
  removeActiveEntry: (entryId: string) => void;
  handleActiveDoubleClick: (entry: ModListEntryDto) => void;
  ungroupActiveEntry: (groupId: string) => void;
  createActiveGroupDialog: () => void;
  editActiveAlias: (identity: ModIdentityDto) => void;
  addSeparatorAbove: (entry: ModListEntryDto) => void;
  renameActiveGroup: (entryId: string, name: string) => void;
  renameActiveSeparator: (entryId: string, title: string) => void;
  removeGroupChild: (groupId: string, childId: string) => void;
};
export type OrderDrag = {
  dragOverlay: DragOverlayState | null;
  dropIndicatorStore: DropIndicatorStore;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
};
