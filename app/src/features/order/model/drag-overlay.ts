import type {
  DisplayAliasDto,
  ModIdentityDto,
  ModMetadataDto,
  ModTagBindingDto,
  TagDefDto,
} from '@/commands';
import { identityForMod, labelForIdentity, normalizePackageId } from '@/domain/mods/identity';
import { colorsForIdentity } from '@/domain/mods/tags';
import type { DragSource } from './drag-source';

export type DragOverlayState = {
  label: string;
  count: number;
  icon?: { kind: 'group' } | { kind: 'mod'; hasAssemblies: boolean };
  colors?: string[];
};

export type DragOverlayLabels = {
  aliases: DisplayAliasDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  tagDefs: TagDefDto[];
  modTags: ModTagBindingDto[];
};

/** Projects the same dragged rows used for the drop into display data. */
export function dragOverlayForSource(
  source: DragSource | null,
  labels: DragOverlayLabels,
): DragOverlayState | null {
  if (!source) return null;
  if (source.kind === 'catalog') {
    const lead = source.mods[0] ?? source.grabbed;
    const count = Math.max(source.mods.length, 1);
    return lead
      ? modOverlay(identityForMod(lead), count, lead.hasAssemblies, labels)
      : { label: source.catalogKey, count };
  }
  if (source.kind === 'child') return installedModOverlay(source.child.identity, 1, labels);
  const [lead] = source.entries;
  if (!lead) return null;
  const count = source.entries.length;
  if (lead.kind === 'group') return { label: lead.name, count, icon: { kind: 'group' } };
  if (lead.kind === 'separator') return { label: lead.title, count };
  return installedModOverlay(lead.identity, count, labels);
}

function installedModOverlay(
  identity: ModIdentityDto,
  count: number,
  labels: DragOverlayLabels,
): DragOverlayState {
  const mod = labels.modByPackageId.get(normalizePackageId(identity.packageId));
  return modOverlay(identity, count, mod?.hasAssemblies ?? false, labels);
}

function modOverlay(
  identity: ModIdentityDto,
  count: number,
  hasAssemblies: boolean,
  { aliases, modByPackageId, tagDefs, modTags }: DragOverlayLabels,
): DragOverlayState {
  return {
    label: labelForIdentity(identity, aliases, modByPackageId),
    count,
    icon: { kind: 'mod', hasAssemblies },
    colors: colorsForIdentity(modTags, tagDefs, identity),
  };
}
