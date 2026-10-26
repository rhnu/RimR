import type { ModIdentityDto, ModTagBindingDto, TagDefDto } from '@/commands';
import { identityMatches } from '@/features/order/identity';

export function findBinding(
  bindings: ModTagBindingDto[],
  identity: ModIdentityDto,
): ModTagBindingDto | undefined {
  return bindings.find((binding) => identityMatches(binding.identity, identity));
}

export function tagIdsForIdentity(
  bindings: ModTagBindingDto[],
  identity: ModIdentityDto,
): string[] {
  return findBinding(bindings, identity)?.tagIds ?? [];
}

export function tagIdsForIdentities(
  bindings: ModTagBindingDto[],
  identities: ModIdentityDto[],
): string[] {
  const [first, ...rest] = uniqueIdentities(identities);
  if (!first) return [];
  const firstIds = tagIdsForIdentity(bindings, first);
  if (rest.length === 0) return firstIds;
  return firstIds.filter((id) =>
    rest.every((identity) => tagIdsForIdentity(bindings, identity).includes(id)),
  );
}

export function colorsForIdentity(
  bindings: ModTagBindingDto[],
  defs: TagDefDto[],
  identity: ModIdentityDto,
): string[] {
  const ids = tagIdsForIdentity(bindings, identity);
  const colorById = new Map(defs.map((def) => [def.id, def.color] as const));
  return ids.map((tid) => colorById.get(tid)).filter((color): color is string => Boolean(color));
}

export function upsertModTags(
  bindings: ModTagBindingDto[],
  identity: ModIdentityDto,
  tagIds: string[],
): ModTagBindingDto[] {
  const next = bindings.filter((binding) => !identityMatches(binding.identity, identity));
  if (tagIds.length > 0) {
    next.push({ identity, tagIds });
  }
  return next;
}

export function toggleModTag(
  bindings: ModTagBindingDto[],
  identity: ModIdentityDto,
  tagId: string,
): ModTagBindingDto[] {
  const current = tagIdsForIdentity(bindings, identity);
  const nextIds = current.includes(tagId)
    ? current.filter((tid) => tid !== tagId)
    : [...current, tagId];
  return upsertModTags(bindings, identity, nextIds);
}

export function toggleModTagForIdentities(
  bindings: ModTagBindingDto[],
  identities: ModIdentityDto[],
  tagId: string,
): ModTagBindingDto[] {
  const targets = uniqueIdentities(identities);
  if (targets.length === 0) return bindings;
  const remove = targets.every((identity) => tagIdsForIdentity(bindings, identity).includes(tagId));
  return targets.reduce((nextBindings, identity) => {
    const current = tagIdsForIdentity(nextBindings, identity);
    const nextIds = remove
      ? current.filter((tid) => tid !== tagId)
      : current.includes(tagId)
        ? current
        : [...current, tagId];
    return upsertModTags(nextBindings, identity, nextIds);
  }, bindings);
}

export function reorderModTags(
  bindings: ModTagBindingDto[],
  identity: ModIdentityDto,
  tagIds: string[],
): ModTagBindingDto[] {
  return upsertModTags(bindings, identity, tagIds);
}

export function upsertTagDef(defs: TagDefDto[], def: TagDefDto): TagDefDto[] {
  const next = defs.filter((d) => d.id !== def.id);
  next.push(def);
  return next;
}

export function renameTagDef(defs: TagDefDto[], id: string, name: string): TagDefDto[] {
  return defs.map((d) => (d.id === id ? { ...d, name } : d));
}

export function setTagDefColor(defs: TagDefDto[], id: string, color: string | null): TagDefDto[] {
  return defs.map((d) => (d.id === id ? { ...d, color: color ?? undefined } : d));
}

export function removeTagDef(
  defs: TagDefDto[],
  id: string,
): {
  defs: TagDefDto[];
  bindings: (bindings: ModTagBindingDto[]) => ModTagBindingDto[];
} {
  const nextDefs = defs.filter((d) => d.id !== id);
  function cleanupBindings(bindings: ModTagBindingDto[]): ModTagBindingDto[] {
    return bindings
      .map((binding) => ({ ...binding, tagIds: binding.tagIds.filter((tid) => tid !== id) }))
      .filter((binding) => binding.tagIds.length > 0);
  }
  return { defs: nextDefs, bindings: cleanupBindings };
}

export function createTagDef(name: string, color: string | null): TagDefDto {
  return { id: crypto.randomUUID(), name, color: color ?? undefined };
}

export function defById(defs: TagDefDto[], id: string): TagDefDto | undefined {
  return defs.find((d) => d.id === id);
}

function uniqueIdentities(identities: ModIdentityDto[]): ModIdentityDto[] {
  return identities.filter(
    (identity, index) =>
      identities.findIndex((candidate) => identityMatches(candidate, identity)) === index,
  );
}
