import { useTranslation } from 'react-i18next';
import type { ModListEntryDto, ModMetadataDto, DisplayAliasDto } from '@/commands';
import { ModTypeIcon } from '@/components/mod/ModTypeIcon';
import { labelForIdentity } from '@/features/order/identity';
import type { Selection } from '@/features/order/types';
import type { WarmFileInfo } from './rowTypes';

type ActiveEntryContentProps = {
  entry: ModListEntryDto;
  aliases: DisplayAliasDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  onWarmFileInfo: WarmFileInfo;
  onSelect: (
    entry: ModListEntryDto,
    selection: Selection,
    event?: React.MouseEvent<HTMLButtonElement>,
  ) => void;
};

export function ActiveEntryContent(props: ActiveEntryContentProps) {
  if (props.entry.kind === 'mod') {
    return <ModEntryContent {...props} entry={props.entry} />;
  }
  if (props.entry.kind === 'group') {
    return <GroupEntryContent {...props} entry={props.entry} />;
  }
  return <SeparatorEntryContent {...props} entry={props.entry} />;
}

function ModEntryContent({
  entry,
  aliases,
  modByPackageId,
  onWarmFileInfo,
  onSelect,
}: ActiveEntryContentProps & { entry: Extract<ModListEntryDto, { kind: 'mod' }> }) {
  const mod = modByPackageId.get(entry.identity.packageId);
  return (
    <>
      <ModTypeIcon hasAssemblies={mod?.hasAssemblies ?? false} sourceKind={mod?.sourceKind} />
      <button
        type="button"
        className="h-full min-w-0 flex-1 truncate text-left text-sm font-medium"
        onPointerDown={() => onWarmFileInfo(entry.identity.sourceKey, true)}
        onFocus={() => onWarmFileInfo(entry.identity.sourceKey, true)}
        onClick={(event) => onSelect(entry, { kind: 'mod', identity: entry.identity }, event)}
      >
        {labelForIdentity(entry.identity, aliases, modByPackageId)}
      </button>
    </>
  );
}

function GroupEntryContent({
  entry,
  onSelect,
}: ActiveEntryContentProps & { entry: Extract<ModListEntryDto, { kind: 'group' }> }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="h-full min-w-0 flex-1 truncate text-left text-sm font-medium"
      onClick={(event) => onSelect(entry, { kind: 'group', entryId: entry.id }, event)}
    >
      {entry.name}
      <span className="ml-2 text-xs text-muted-foreground">
        {t('order.modsCount', { count: entry.entries.length })}
      </span>
    </button>
  );
}

function SeparatorEntryContent({
  entry,
  onSelect,
}: ActiveEntryContentProps & { entry: Extract<ModListEntryDto, { kind: 'separator' }> }) {
  return (
    <button
      type="button"
      className="h-full min-w-0 flex-1 truncate text-left text-sm font-semibold text-muted-foreground"
      onClick={(event) => onSelect(entry, { kind: 'separator', entryId: entry.id }, event)}
    >
      {entry.title}
    </button>
  );
}
