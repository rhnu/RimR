import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  DisplayAliasDto,
  ModIdentityDto,
  ModListEntryDto,
  ModListGroupChildDto,
  ModMetadataDto,
  ModTagBindingDto,
  SteamWorkshopOpenTarget,
  TagDefDto,
} from '@/commands';
import { FilterInput } from '@/components/ui/filter-input';
import { DroppablePanel } from '@/features/order/ui/panels';
import { ActiveEntryRow } from './rows/active-entry-row';
import { GroupChildRow } from './rows/group-child-row';
import type { Selection } from '@/features/order/types';
import type { ActiveRenderRow } from '@/features/order/model';
import type { DiagnosticItem } from '@/domain/diagnostics/suppression';
import type { OrderDiagnosticTarget } from '../model/diagnostic-targets';
import type { RowDiagnosticNavigation } from './diagnostic-row-menu';
import { tagTargetsForEntry } from '@/features/order/model';
import type { DropIndicatorStore } from '@/features/order/hooks/drop-indicator-store';
import { ACTIVE_DROP_ID } from '@/features/order/dnd-ids';
export type ActiveModsPanelProps = {
  count: number;
  search: string;
  onSearchChange: (value: string) => void;
  selectedTagIdentities: ModIdentityDto[];
  canCreateGroup: boolean;
  rows: ActiveRenderRow[];
  aliases: DisplayAliasDto[];
  tagDefs: TagDefDto[];
  modTags: ModTagBindingDto[];
  selectedEntryIds: Set<string>;
  diagnosticsForTarget: (target: OrderDiagnosticTarget) => DiagnosticItem[];
  diagnosticNavigation: RowDiagnosticNavigation;
  modByPackageId: Map<string, ModMetadataDto>;
  dropIndicatorStore: DropIndicatorStore;
  onWarmFileInfo: (sourceKey: string | null | undefined, immediate?: boolean) => void;
  onSelectEntry: (
    entry: ModListEntryDto,
    selection: Selection,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void;
  onContextOpen: (entry: ModListEntryDto) => void;
  onRemove: (entryId: string) => void;
  onDoubleClickEntry: (entry: ModListEntryDto) => void;
  onUngroup: (groupId: string) => void;
  onCreateGroup: () => void;
  onEditAlias: (identity: ModIdentityDto) => void;
  onAddSeparator: (entry: ModListEntryDto) => void;
  onRenameGroup: (entryId: string, name: string) => void;
  onRenameSeparator: (entryId: string, title: string) => void;
  onSelectChild: (child: ModListGroupChildDto) => void;
  onDoubleClickChild: (groupId: string, childId: string) => void;
  onRemoveChild: (groupId: string, childId: string) => void;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
  onToggleModTag: (identities: ModIdentityDto[], tagId: string) => void;
  onCreateTag: (name: string, color: string | null) => void;
  onRenameTag: (tagId: string, name: string) => void;
  onSetTagColor: (tagId: string, color: string | null) => void;
  onDeleteTag: (tagId: string) => void;
  onReorderModTags: (identity: ModIdentityDto, tagIds: string[]) => void;
};

export function ActiveModsPanel(props: ActiveModsPanelProps) {
  const { t } = useTranslation();
  return (
    <DroppablePanel
      id={ACTIVE_DROP_ID}
      title={t('order.activeModListTitle')}
      count={props.count}
      actions={
        <FilterInput
          value={props.search}
          onValueChange={props.onSearchChange}
          label={t('order.searchActive')}
          className="h-7 px-2 text-xs shadow-none"
        />
      }
    >
      <ActiveRows {...props} />
    </DroppablePanel>
  );
}

function ActiveRows(props: ActiveModsPanelProps) {
  return (
    <>
      {props.rows.map((row) =>
        row.kind === 'entry' ? (
          <ActiveEntryRow
            key={row.id}
            entry={row.entry}
            aliases={props.aliases}
            tagDefs={props.tagDefs}
            modTags={props.modTags}
            tagTargetIdentities={tagTargetsForEntry(row.entry, props.selectedTagIdentities)}
            modByPackageId={props.modByPackageId}
            diagnostics={props.diagnosticsForTarget({ kind: 'entry', entry: row.entry })}
            diagnosticNavigation={props.diagnosticNavigation}
            selected={row.entry.kind === 'mod' && props.selectedEntryIds.has(row.entry.id)}
            canCreateGroup={props.canCreateGroup}
            dropIndicatorStore={props.dropIndicatorStore}
            onWarmFileInfo={props.onWarmFileInfo}
            onSelect={props.onSelectEntry}
            onContextOpen={props.onContextOpen}
            onRemove={props.onRemove}
            onDoubleClick={props.onDoubleClickEntry}
            onUngroup={props.onUngroup}
            onCreateGroup={props.onCreateGroup}
            onEditAlias={props.onEditAlias}
            onAddSeparator={props.onAddSeparator}
            onRenameGroup={props.onRenameGroup}
            onRenameSeparator={props.onRenameSeparator}
            onOpenModFolder={props.onOpenModFolder}
            onOpenSteamWorkshopPage={props.onOpenSteamWorkshopPage}
            onToggleModTag={props.onToggleModTag}
            onCreateTag={props.onCreateTag}
            onRenameTag={props.onRenameTag}
            onSetTagColor={props.onSetTagColor}
            onDeleteTag={props.onDeleteTag}
            onReorderModTags={props.onReorderModTags}
          />
        ) : (
          <GroupChildRow
            key={row.id}
            groupId={row.groupId}
            child={row.child}
            aliases={props.aliases}
            tagDefs={props.tagDefs}
            modTags={props.modTags}
            modByPackageId={props.modByPackageId}
            diagnostics={props.diagnosticsForTarget({ kind: 'mod', identity: row.child.identity })}
            diagnosticNavigation={props.diagnosticNavigation}
            dropIndicatorStore={props.dropIndicatorStore}
            onWarmFileInfo={props.onWarmFileInfo}
            onSelect={props.onSelectChild}
            onDoubleClick={props.onDoubleClickChild}
            onEditAlias={props.onEditAlias}
            onOpenModFolder={props.onOpenModFolder}
            onOpenSteamWorkshopPage={props.onOpenSteamWorkshopPage}
            onToggleModTag={props.onToggleModTag}
            onCreateTag={props.onCreateTag}
            onRenameTag={props.onRenameTag}
            onSetTagColor={props.onSetTagColor}
            onDeleteTag={props.onDeleteTag}
            onReorderModTags={props.onReorderModTags}
            onRemove={props.onRemoveChild}
          />
        ),
      )}
    </>
  );
}
