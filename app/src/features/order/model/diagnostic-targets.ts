import type { DisplayAliasDto, ModIdentityDto, ModListEntryDto, ModMetadataDto } from '@/commands';
import { entryDiagnosticTargets, type DiagnosticState } from '@/domain/diagnostics/suppression';
import { catalogItemKey } from '@/domain/mods/catalog';
import {
  displayName,
  identityForMod,
  labelForIdentity,
  resolveSourceKey,
} from '@/domain/mods/identity';

export type OrderDiagnosticTarget =
  | { kind: 'entry'; entry: ModListEntryDto }
  | { kind: 'mod'; identity: ModIdentityDto }
  | { kind: 'source'; identity: ModIdentityDto }
  | { kind: 'catalog'; mod: ModMetadataDto };

export type OrderDiagnosticScope =
  | { kind: 'mod'; name: string; identities: [ModIdentityDto] }
  | { kind: 'selection'; identities: ModIdentityDto[] }
  | { kind: 'group'; name: string; identities: ModIdentityDto[] };

type DiagnosticSelection = {
  entryIds: Set<string>;
  catalogKeys: Set<string>;
  entries: ModListEntryDto[];
  catalog: Map<string, ModMetadataDto>;
};

export function createDiagnosticTargets(
  diagnostics: DiagnosticState,
  modByPackageId: Map<string, ModMetadataDto>,
) {
  function installedIdentities(identities: ModIdentityDto[]) {
    return identities.map((identity) => ({
      ...identity,
      sourceKey: resolveSourceKey(identity, modByPackageId) ?? identity.sourceKey,
    }));
  }

  function identitiesFor(target: OrderDiagnosticTarget): ModIdentityDto[] {
    if (target.kind === 'catalog') return [identityForMod(target.mod)];
    if (target.kind === 'source') return [target.identity];
    return installedIdentities(
      target.kind === 'entry' ? entryDiagnosticTargets(target.entry) : [target.identity],
    );
  }

  function multiSelectedIdentities(target: OrderDiagnosticTarget, selected: DiagnosticSelection) {
    if (target.kind === 'entry' && selected.entryIds.has(target.entry.id)) {
      const entries = selected.entries.filter(
        (entry) => entry.kind !== 'separator' && selected.entryIds.has(entry.id),
      );
      return entries.length > 1 ? installedIdentities(entries.flatMap(entryDiagnosticTargets)) : [];
    }
    if (target.kind === 'catalog' && selected.catalogKeys.has(catalogItemKey(target.mod))) {
      const identities = [...selected.catalogKeys].flatMap((key) => {
        const mod = selected.catalog.get(key);
        return mod ? [identityForMod(mod)] : [];
      });
      return identities.length > 1 ? identities : [];
    }
    return [];
  }

  return {
    forTarget: (target: OrderDiagnosticTarget) => diagnostics.forTargets(identitiesFor(target)),
    forScope: (scope: OrderDiagnosticScope) => diagnostics.forTargets(scope.identities),
    scopeForTarget(
      target: OrderDiagnosticTarget,
      selected: DiagnosticSelection,
      aliases: DisplayAliasDto[],
    ): OrderDiagnosticScope | null {
      if (target.kind === 'entry' && target.entry.kind === 'separator') return null;
      const selection = multiSelectedIdentities(target, selected);
      if (selection.length > 0) return { kind: 'selection', identities: selection };
      if (target.kind === 'entry' && target.entry.kind === 'group') {
        return { kind: 'group', name: target.entry.name, identities: identitiesFor(target) };
      }
      const [identity] = identitiesFor(target);
      if (!identity) return null;
      const name =
        target.kind === 'catalog'
          ? displayName(target.mod, aliases)
          : labelForIdentity(identity, aliases, modByPackageId);
      return { kind: 'mod', name, identities: [identity] };
    },
  };
}
