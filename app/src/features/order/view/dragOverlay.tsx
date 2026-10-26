import { Layers } from 'lucide-react';
import type { ReactNode } from 'react';
import type {
  DisplayAliasDto,
  ModListDto,
  ModListEntryDto,
  ModMetadataDto,
  ModTagBindingDto,
  TagDefDto,
} from '@/commands';
import { ModTypeIcon } from '@/components/mod/ModTypeIcon';
import { parseCatalogId, parseChildId, parseEntryId } from '@/features/order/dndIds';
import { identityForMod, labelForIdentity } from '@/features/order/identity';
import { colorsForIdentity } from '@/features/tags/tagModel';
import { entryById, orderedSelectedDragIds } from '@/features/order/model';

export type DragOverlayState = {
  label: string;
  count: number;
  icon?: ReactNode;
  colors?: string[];
};

export function dragOverlayForId(
  id: string,
  modList: ModListDto | null,
  aliases: DisplayAliasDto[],
  modByPackageId: Map<string, ModMetadataDto>,
  modByCatalogKey: Map<string, ModMetadataDto>,
  selectedInactivePackageIds: Set<string>,
  inactivePackageIds: string[],
  selectedEntryIds: Set<string>,
  visibleActiveEntryIds: string[],
  tagDefs: TagDefDto[],
  modTags: ModTagBindingDto[],
): DragOverlayState | null {
  if (parseCatalogId(id)) {
    return inactiveDragOverlay(
      id,
      aliases,
      modByPackageId,
      modByCatalogKey,
      selectedInactivePackageIds,
      inactivePackageIds,
      tagDefs,
      modTags,
    );
  }
  if (parseEntryId(id) && modList) {
    return entryDragOverlay(
      id,
      modList,
      aliases,
      modByPackageId,
      selectedEntryIds,
      visibleActiveEntryIds,
      tagDefs,
      modTags,
    );
  }
  if (parseChildId(id) && modList) {
    return childDragOverlay(id, modList, aliases, modByPackageId, tagDefs, modTags);
  }
  return null;
}

function inactiveDragOverlay(
  id: string,
  aliases: DisplayAliasDto[],
  modByPackageId: Map<string, ModMetadataDto>,
  modByCatalogKey: Map<string, ModMetadataDto>,
  selected: Set<string>,
  orderedIds: string[],
  tagDefs: TagDefDto[],
  modTags: ModTagBindingDto[],
): DragOverlayState {
  const itemKey = parseCatalogId(id)?.catalogKey ?? id;
  const itemKeys = orderedSelectedDragIds(itemKey, selected, orderedIds);
  const first = modByCatalogKey.get(itemKeys[0] ?? itemKey);
  return {
    label: first ? labelForIdentityFromMod(first, aliases, modByPackageId) : itemKey,
    count: itemKeys.length,
    icon: first ? <ModTypeIcon hasAssemblies={first.hasAssemblies} /> : undefined,
    colors: first ? colorsForIdentity(modTags, tagDefs, identityForMod(first)) : undefined,
  };
}

function entryDragOverlay(
  id: string,
  modList: ModListDto,
  aliases: DisplayAliasDto[],
  modByPackageId: Map<string, ModMetadataDto>,
  selected: Set<string>,
  orderedIds: string[],
  tagDefs: TagDefDto[],
  modTags: ModTagBindingDto[],
): DragOverlayState | null {
  const entryId = parseEntryId(id)?.entryId ?? id;
  const entryIds = orderedSelectedDragIds(entryId, selected, orderedIds);
  const selectedEntries = new Set(entryIds);
  const entry =
    modList.entries.find((candidate) => selectedEntries.has(candidate.id)) ??
    entryById(modList, entryId);
  if (!entry) return null;
  return {
    label: labelForEntry(entry, aliases, modByPackageId),
    count: entryIds.length,
    icon: iconForEntry(entry, modByPackageId),
    colors: entry.kind === 'mod' ? colorsForIdentity(modTags, tagDefs, entry.identity) : undefined,
  };
}

function childDragOverlay(
  id: string,
  modList: ModListDto,
  aliases: DisplayAliasDto[],
  modByPackageId: Map<string, ModMetadataDto>,
  tagDefs: TagDefDto[],
  modTags: ModTagBindingDto[],
): DragOverlayState | null {
  const parsed = parseChildId(id);
  if (!parsed) return null;
  const group = modList.entries.find(
    (entry): entry is Extract<ModListEntryDto, { kind: 'group' }> =>
      entry.kind === 'group' && entry.id === parsed.groupId,
  );
  const child = group?.entries.find((candidate) => candidate.id === parsed.childId);
  if (!child) return null;
  return {
    label: labelForIdentity(child.identity, aliases, modByPackageId),
    count: 1,
    icon: (
      <ModTypeIcon
        hasAssemblies={modByPackageId.get(child.identity.packageId)?.hasAssemblies ?? false}
      />
    ),
    colors: colorsForIdentity(modTags, tagDefs, child.identity),
  };
}

function labelForIdentityFromMod(
  mod: ModMetadataDto,
  aliases: DisplayAliasDto[],
  modByPackageId: Map<string, ModMetadataDto>,
): string {
  return labelForIdentity(identityForMod(mod), aliases, modByPackageId);
}

function labelForEntry(
  entry: ModListEntryDto,
  aliases: DisplayAliasDto[],
  modByPackageId: Map<string, ModMetadataDto>,
): string {
  if (entry.kind === 'mod') return labelForIdentity(entry.identity, aliases, modByPackageId);
  if (entry.kind === 'group') return entry.name;
  return entry.title;
}

function iconForEntry(
  entry: ModListEntryDto,
  modByPackageId: Map<string, ModMetadataDto>,
): ReactNode {
  if (entry.kind === 'mod') {
    return (
      <ModTypeIcon
        hasAssemblies={modByPackageId.get(entry.identity.packageId)?.hasAssemblies ?? false}
      />
    );
  }
  if (entry.kind === 'group') {
    return <Layers className="size-4 shrink-0 text-muted-foreground" />;
  }
  return undefined;
}
