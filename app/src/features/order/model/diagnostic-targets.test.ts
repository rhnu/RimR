import { expect, it } from 'vitest';
import type { DiagnosticDto, DiagnosticSuppressionDto, ModListEntryDto } from '@/commands';
import { deriveDiagnosticState } from '@/domain/diagnostics/suppression';
import { mod } from '@/domain/mod-list/test-fixtures';
import { catalogItemKey } from '@/domain/mods/catalog';
import { createDiagnosticTargets, type OrderDiagnosticTarget } from './diagnostic-targets';

it('matches draft entries to the live copy while catalog rows keep their exact copy', () => {
  const local = mod('a.mod', 'Local', { sourceKey: 'local:old' });
  const workshop = mod('a.mod', 'Workshop', { sourceKey: 'workshop:current' });
  const localRule: DiagnosticSuppressionDto = {
    key: 'local',
    code: 'xmlMalformed',
    params: {},
    sourceKeys: [local.sourceKey],
    relatedPackages: ['a.mod'],
    gameVersion: null,
  };
  const workshopRule = { ...localRule, key: 'workshop', sourceKeys: [workshop.sourceKey] };
  const localIssue = issue(localRule);
  const workshopIssue = issue(workshopRule);
  const state = deriveDiagnosticState([localIssue, workshopIssue], null, [workshopRule]);
  const targets = createDiagnosticTargets(state, new Map([['a.mod', workshop]]));
  const entry: ModListEntryDto = {
    kind: 'mod',
    id: 'entry-a',
    active: true,
    identity: { packageId: 'A.MOD', sourceKey: local.sourceKey },
  };
  const entryTarget: OrderDiagnosticTarget = { kind: 'entry', entry };
  const catalogTarget: OrderDiagnosticTarget = { kind: 'catalog', mod: local };
  const selection = {
    entryIds: new Set([entry.id]),
    catalogKeys: new Set([catalogItemKey(local), catalogItemKey(workshop)]),
    entries: [entry],
    catalog: new Map([local, workshop].map((item) => [catalogItemKey(item), item])),
  };

  expect(targets.forTarget(entryTarget)).toEqual([{ diagnostic: workshopIssue, ignored: true }]);
  expect(targets.forTarget(catalogTarget)).toEqual([{ diagnostic: localIssue, ignored: false }]);
  expect(targets.menuForTarget(entryTarget, selection)).toEqual({
    pending: [],
    ignored: [workshopRule],
  });
  expect(targets.menuForTarget(catalogTarget, selection)).toEqual({
    pending: [localRule],
    ignored: [workshopRule],
  });
});

function issue(suppression: DiagnosticSuppressionDto): DiagnosticDto {
  return {
    code: suppression.code,
    params: suppression.params,
    relatedPackages: suppression.relatedPackages,
    severity: 'warning',
    message: 'A source diagnostic',
    location: null,
    relatedLocations: [],
    suppression,
  };
}
