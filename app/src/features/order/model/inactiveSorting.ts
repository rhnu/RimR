import type { ModIdentityDto, ModListEntryDto, ModListGroupChildDto } from '@/commands';
import { displayName, identityForMod, labelForIdentity } from '@/features/order/identity';
import type { InactiveRenderContext, InactiveRenderRow } from './inactiveSelectorsTypes';

export function sortGroupBlocks(
  blocks: InactiveRenderRow[][],
  ctx: InactiveRenderContext,
): InactiveRenderRow[][] {
  return [...blocks].sort((a, b) => compareGroupBlocks(a, b, ctx));
}

export function sortOrdinaryRows(
  rows: InactiveRenderRow[],
  ctx: InactiveRenderContext,
): InactiveRenderRow[] {
  return [...rows].sort((a, b) => compareModLikeRows(a, b, ctx));
}

export function sortGroupChildren(
  children: ModListGroupChildDto[],
  ctx: InactiveRenderContext,
): ModListGroupChildDto[] {
  return [...children].sort((a, b) => compareIdentities(a.identity, b.identity, ctx));
}

function sortIdentities(
  identities: ModIdentityDto[],
  ctx: InactiveRenderContext,
): ModIdentityDto[] {
  return [...identities].sort((a, b) => compareIdentities(a, b, ctx));
}

function compareGroupBlocks(
  a: InactiveRenderRow[],
  b: InactiveRenderRow[],
  ctx: InactiveRenderContext,
): number {
  const aEntry = groupBlockEntry(a);
  const bEntry = groupBlockEntry(b);
  if (!aEntry || !bEntry) return 0;
  const primary =
    ctx.sortKey === 'modifiedAt'
      ? compareNumber(groupBlockModifiedAt(a, ctx), groupBlockModifiedAt(b, ctx))
      : compareText(groupBlockSortText(a, aEntry, ctx), groupBlockSortText(b, bEntry, ctx));
  if (primary !== 0) return primary * sortMultiplier(ctx);
  return compareText(aEntry.name, bEntry.name);
}

function compareModLikeRows(
  a: InactiveRenderRow,
  b: InactiveRenderRow,
  ctx: InactiveRenderContext,
): number {
  return compareIdentities(rowIdentity(a), rowIdentity(b), ctx);
}

function compareIdentities(
  a: ModIdentityDto,
  b: ModIdentityDto,
  ctx: InactiveRenderContext,
): number {
  const primary =
    ctx.sortKey === 'modifiedAt'
      ? compareNumber(identityModifiedAt(a, ctx), identityModifiedAt(b, ctx))
      : compareText(identitySortText(a, ctx), identitySortText(b, ctx));
  if (primary !== 0) return primary * sortMultiplier(ctx);
  return compareText(a.packageId, b.packageId) || compareText(a.sourceKey ?? '', b.sourceKey ?? '');
}

function rowIdentity(row: InactiveRenderRow): ModIdentityDto {
  if (row.kind === 'catalog') return identityForMod(row.mod);
  if (row.kind === 'child') return row.child.identity;
  if (row.entry.kind === 'mod') return row.entry.identity;
  return { packageId: row.entry.id };
}

function groupBlockEntry(
  block: InactiveRenderRow[],
): Extract<ModListEntryDto, { kind: 'group' }> | null {
  const entry = block[0]?.kind === 'entry' ? block[0].entry : null;
  return entry?.kind === 'group' ? entry : null;
}

function groupBlockSortText(
  block: InactiveRenderRow[],
  group: Extract<ModListEntryDto, { kind: 'group' }>,
  ctx: InactiveRenderContext,
): string {
  if (ctx.sortKey === 'name' || ctx.sortKey === 'packageId') return group.name;
  return firstGroupBlockChildSortText(block, ctx) || group.name;
}

function firstGroupBlockChildSortText(
  block: InactiveRenderRow[],
  ctx: InactiveRenderContext,
): string {
  const sortedIdentities = sortIdentities(groupBlockChildIdentities(block), ctx);
  return sortedIdentities[0] ? identitySortText(sortedIdentities[0], ctx) : '';
}

function identitySortText(identity: ModIdentityDto, ctx: InactiveRenderContext): string {
  const mod = ctx.searchOptions.modByPackageId.get(identity.packageId);
  switch (ctx.sortKey) {
    case 'name':
      return mod
        ? displayName(mod, ctx.searchOptions.aliases)
        : labelForIdentity(identity, ctx.searchOptions.aliases, ctx.searchOptions.modByPackageId);
    case 'packageId':
      return identity.packageId;
    case 'author':
      return mod?.authors[0] ?? '';
    case 'source':
      return mod?.sourceKind ?? identity.sourceKind ?? '';
    case 'modifiedAt':
      return String(identityModifiedAt(identity, ctx));
  }
}

function groupBlockModifiedAt(block: InactiveRenderRow[], ctx: InactiveRenderContext): number {
  return Math.max(
    0,
    ...groupBlockChildIdentities(block).map((identity) => identityModifiedAt(identity, ctx)),
  );
}

function groupBlockChildIdentities(block: InactiveRenderRow[]): ModIdentityDto[] {
  return block.flatMap((row) => (row.kind === 'child' ? [row.child.identity] : []));
}

function identityModifiedAt(identity: ModIdentityDto, ctx: InactiveRenderContext): number {
  return ctx.searchOptions.modByPackageId.get(identity.packageId)?.modifiedAtMs ?? 0;
}

function sortMultiplier(ctx: InactiveRenderContext): number {
  return ctx.sortDirection === 'asc' ? 1 : -1;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}

function compareNumber(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}
