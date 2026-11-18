import type { ModIdentityDto, ModListEntryDto, ModMetadataDto } from '@/commands';
import { entryDiagnosticTargets, type DiagnosticState } from '@/domain/diagnostics/suppression';
import { catalogItemKey } from '@/domain/mods/catalog';
import { identityForMod, resolveSourceKey } from '@/domain/mods/identity';

export type OrderDiagnosticTarget =
  | { kind: 'entry'; entry: ModListEntryDto }
  | { kind: 'mod'; identity: ModIdentityDto }
  | { kind: 'source'; identity: ModIdentityDto }
  | { kind: 'catalog'; mod: ModMetadataDto };

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

  return {
    forTarget: (target: OrderDiagnosticTarget) => diagnostics.forTargets(identitiesFor(target)),
    menuForTarget(
      target: OrderDiagnosticTarget,
      selected: {
        entryIds: Set<string>;
        catalogKeys: Set<string>;
        entries: ModListEntryDto[];
        catalog: Map<string, ModMetadataDto>;
      },
    ) {
      if (target.kind === 'entry' && selected.entryIds.has(target.entry.id)) {
        return diagnostics.menuForTargets(
          installedIdentities(
            selected.entries
              .filter((entry) => selected.entryIds.has(entry.id))
              .flatMap(entryDiagnosticTargets),
          ),
        );
      }
      if (target.kind === 'catalog' && selected.catalogKeys.has(catalogItemKey(target.mod))) {
        return diagnostics.menuForTargets(
          [...selected.catalogKeys].flatMap((key) => {
            const mod = selected.catalog.get(key);
            return mod ? [identityForMod(mod)] : [];
          }),
        );
      }
      return diagnostics.menuForTargets(identitiesFor(target));
    },
  };
}
