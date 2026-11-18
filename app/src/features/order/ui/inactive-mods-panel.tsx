import type { ComponentProps, MouseEvent } from 'react';
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
import { DroppablePanel } from '@/features/order/ui/panels';
import { InactiveModRow } from './rows/inactive-mod-row';
import { InactivePanelActions } from '@/features/order/ui/inactive-panel-actions';
import { InactiveChildRow, InactiveEntryRow } from '@/features/order/ui/inactive-structured-rows';
import { tagTargetsForEntry, tagTargetsForIdentity } from '@/features/order/model';
import { catalogItemKey, isPackageAddressableMod } from '@/domain/mods/catalog';
import type { InactiveRenderRow } from '@/features/order/model';
import { displayName, identityForMod } from '@/domain/mods/identity';
import type { Selection } from '@/features/order/types';
import { INACTIVE_DROP_ID } from '@/features/order/dnd-ids';
import type { DiagnosticItem } from '@/domain/diagnostics/suppression';
import type { OrderDiagnosticTarget } from '../model/diagnostic-targets';
import type { RowDiagnosticMenus } from './diagnostic-menu-items';

type RowProps = {
  aliases: DisplayAliasDto[];
  tagDefs: TagDefDto[];
  modTags: ModTagBindingDto[];
  selectedCatalogKeys: Set<string>;
  canCreateGroup: boolean;
  diagnosticsForTarget: (target: OrderDiagnosticTarget) => DiagnosticItem[];
  diagnosticMenus: RowDiagnosticMenus;
  modByPackageId: Map<string, ModMetadataDto>;
  onSelect: (mod: ModMetadataDto, event: MouseEvent<HTMLButtonElement>) => void;
  onSelectEntry: (
    entry: ModListEntryDto,
    selection: Selection,
    event?: MouseEvent<HTMLButtonElement>,
  ) => void;
  onSelectChild: (child: ModListGroupChildDto) => void;
  onContextOpen: (mod: ModMetadataDto) => void;
  onContextOpenEntry: (entry: ModListEntryDto) => void;
  onAdd: (mod: ModMetadataDto) => void;
  onActivateEntry: (entryId: string) => void;
  onActivateChild: (groupId: string, childId: string) => void;
  onDoubleClick: (mod: ModMetadataDto) => void;
  onRenameGroup: (entryId: string, name: string) => void;
  onCreateGroup: () => void;
  onEditAlias: (mod: ModMetadataDto) => void;
  onEditActiveAlias: (identity: ModIdentityDto) => void;
  onOpenModFolder: (sourceKey: string) => void;
  onOpenSteamWorkshopPage: (sourceKey: string, target: SteamWorkshopOpenTarget) => void;
  onToggleModTag: (identities: ModIdentityDto[], tagId: string) => void;
  onCreateTag: (name: string, color: string | null) => void;
  onRenameTag: (tagId: string, name: string) => void;
  onSetTagColor: (tagId: string, color: string | null) => void;
  onDeleteTag: (tagId: string) => void;
  onReorderModTags: (identity: ModIdentityDto, tagIds: string[]) => void;
  onWarmFileInfo: (sourceKey: string | null | undefined, immediate?: boolean) => void;
};

export type InactiveModsPanelProps = RowProps & {
  rows: InactiveRenderRow[];
  selectedInactiveTagIdentities: ModIdentityDto[];
  selectedActiveTagIdentities: ModIdentityDto[];
  filters: ComponentProps<typeof InactivePanelActions>;
};

export function InactiveModsPanel({ rows, filters, ...rowProps }: InactiveModsPanelProps) {
  const { t } = useTranslation();
  return (
    <DroppablePanel
      id={INACTIVE_DROP_ID}
      title={t('order.unintroducedTitle')}
      count={rows.length}
      actions={<InactivePanelActions {...filters} />}
    >
      {rows.map((row) => (
        <InactivePanelRow key={row.id} row={row} {...rowProps} />
      ))}
    </DroppablePanel>
  );
}

type InactivePanelRowProps = RowProps & {
  row: InactiveRenderRow;
  selectedInactiveTagIdentities: ModIdentityDto[];
  selectedActiveTagIdentities: ModIdentityDto[];
};

function InactivePanelRow(props: InactivePanelRowProps) {
  const { row } = props;
  if (row.kind === 'catalog') {
    return <CatalogInactivePanelRow {...props} row={row} />;
  }
  if (row.kind === 'entry') {
    return <StructuredInactiveEntryPanelRow {...props} row={row} />;
  }
  return <StructuredInactiveChildPanelRow {...props} row={row} />;
}

function CatalogInactivePanelRow({
  row,
  selectedInactiveTagIdentities,
  ...props
}: InactivePanelRowProps & { row: Extract<InactiveRenderRow, { kind: 'catalog' }> }) {
  const identity = identityForMod(row.mod);
  const itemKey = catalogItemKey(row.mod);
  const canAdd = isPackageAddressableMod(row.mod);
  return (
    <InactiveModRow
      diagnostics={props.diagnosticsForTarget({ kind: 'catalog', mod: row.mod })}
      diagnosticMenus={props.diagnosticMenus}
      mod={row.mod}
      label={displayName(row.mod, props.aliases)}
      tagDefs={props.tagDefs}
      modTags={props.modTags}
      tagTargetIdentities={tagTargetsForIdentity(identity, selectedInactiveTagIdentities)}
      selected={props.selectedCatalogKeys.has(itemKey)}
      canAdd={canAdd}
      canCreateGroup={props.canCreateGroup}
      onWarmFileInfo={props.onWarmFileInfo}
      onSelect={props.onSelect}
      onContextOpen={props.onContextOpen}
      onAdd={props.onAdd}
      onDoubleClick={props.onDoubleClick}
      onCreateGroup={props.onCreateGroup}
      onEditAlias={props.onEditAlias}
      onOpenModFolder={props.onOpenModFolder}
      onOpenSteamWorkshopPage={props.onOpenSteamWorkshopPage}
      onToggleModTag={props.onToggleModTag}
      onCreateTag={props.onCreateTag}
      onRenameTag={props.onRenameTag}
      onSetTagColor={props.onSetTagColor}
      onDeleteTag={props.onDeleteTag}
      onReorderModTags={props.onReorderModTags}
    />
  );
}

function StructuredInactiveEntryPanelRow({
  row,
  selectedActiveTagIdentities,
  ...props
}: InactivePanelRowProps & { row: Extract<InactiveRenderRow, { kind: 'entry' }> }) {
  return (
    <InactiveEntryRow
      row={row}
      diagnosticMenus={props.diagnosticMenus}
      aliases={props.aliases}
      tagDefs={props.tagDefs}
      modTags={props.modTags}
      tagTargetIdentities={tagTargetsForEntry(row.entry, selectedActiveTagIdentities)}
      modByPackageId={props.modByPackageId}
      onWarmFileInfo={props.onWarmFileInfo}
      onSelect={props.onSelectEntry}
      onContextOpen={props.onContextOpenEntry}
      onRenameGroup={props.onRenameGroup}
      onAddActive={props.onActivateEntry}
      onDoubleClick={props.onActivateEntry}
      onEditAlias={props.onEditActiveAlias}
      onOpenModFolder={props.onOpenModFolder}
      onOpenSteamWorkshopPage={props.onOpenSteamWorkshopPage}
      onToggleModTag={props.onToggleModTag}
      onCreateTag={props.onCreateTag}
      onRenameTag={props.onRenameTag}
      onSetTagColor={props.onSetTagColor}
      onDeleteTag={props.onDeleteTag}
      onReorderModTags={props.onReorderModTags}
    />
  );
}

function StructuredInactiveChildPanelRow({
  row,
  ...props
}: InactivePanelRowProps & { row: Extract<InactiveRenderRow, { kind: 'child' }> }) {
  return (
    <InactiveChildRow
      row={row}
      diagnosticMenus={props.diagnosticMenus}
      aliases={props.aliases}
      tagDefs={props.tagDefs}
      modTags={props.modTags}
      modByPackageId={props.modByPackageId}
      onWarmFileInfo={props.onWarmFileInfo}
      onSelect={props.onSelectChild}
      onAddActive={props.onActivateChild}
      onDoubleClick={props.onActivateChild}
      onEditAlias={props.onEditActiveAlias}
      onOpenModFolder={props.onOpenModFolder}
      onOpenSteamWorkshopPage={props.onOpenSteamWorkshopPage}
      onToggleModTag={props.onToggleModTag}
      onCreateTag={props.onCreateTag}
      onRenameTag={props.onRenameTag}
      onSetTagColor={props.onSetTagColor}
      onDeleteTag={props.onDeleteTag}
      onReorderModTags={props.onReorderModTags}
    />
  );
}
