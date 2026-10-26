import type { MouseEvent } from 'react';
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  SensorDescriptor,
  SensorOptions,
} from '@dnd-kit/core';
import type {
  AppConfig,
  ActiveListLoadDto,
  CatalogSnapshotDto,
  LibraryDto,
  ModIdentityDto,
  ModListDto,
  ModListEntryDto,
  ModListGroupChildDto,
  ModMetadataDto,
  DiagnosticDto,
  SteamWorkshopOpenTarget,
} from '@/commands';
import type { ModListAction, GameSyncResult } from '@/domain/mod-list/types';
import type { ValidationSummary } from '@/domain/diagnostics/validation';
import type { AvailableModSortKey, SortDirection } from '@/domain/mods/available-mods';
import type { ActiveRenderRow, InactiveRenderRow } from '../model/selectors';
import type { DropIndicatorStore } from '../hooks/drop-indicator-store';
import type { DragOverlayState } from '../ui/view/drag-overlay';
import type { OrderDialog, Selection } from '../types';
import type { OrderValidation } from '../hooks/use-order-validation';
import type { TagCommands } from '@/features/library/hooks/use-tag-commands';

export type QueryResource<T> = {
  data: T | undefined;
  dataUpdatedAt: number;
  isFetching: boolean;
  isError: boolean;
  fetchStatus: 'fetching' | 'paused' | 'idle';
  refetch: (options?: { throwOnError?: boolean }) => Promise<{ data: T | undefined }>;
};
export type OrderData = {
  appConfig: QueryResource<AppConfig>;
  scan: QueryResource<CatalogSnapshotDto>;
  activeList: QueryResource<ActiveListLoadDto>;
  library: QueryResource<LibraryDto>;
};
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
  diagnosticsMap: Map<string, DiagnosticDto[]>;
  validationSummary: ValidationSummary;
  allDiagnostics: DiagnosticDto[];
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
export type OrderContentValue = {
  data: OrderData;
  draftState: OrderDraftState;
  validation: OrderValidation;
  derived: OrderDerived & { differsFromGame: boolean };
};
export type OrderInteractionValue = {
  filters: OrderFilters;
  preview: OrderPreview;
  selection: OrderSelection;
};
export type OrderActionsValue = {
  commands: OrderCommands & { handleApplyWithDiff: () => void };
  sync: OrderSync;
  editActions: OrderEditActions;
  tagCommands: TagCommands;
  setDialog: (dialog: OrderDialog) => void;
  handleOpenModFolder: (sourceKey: string) => void;
  handleOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
};
export type OrderDragValue = {
  drag: OrderDrag;
  sensors: SensorDescriptor<SensorOptions>[];
};
export type OrderWorkspaceBase = OrderContentValue & OrderInteractionValue & OrderActionsValue;
