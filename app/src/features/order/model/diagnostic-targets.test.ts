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
  const entryScope = targets.scopeForTarget(entryTarget, selection, []);
  const selectedScope = targets.scopeForTarget(catalogTarget, selection, []);
  expect(entryScope).toMatchObject({ kind: 'mod', name: 'Workshop' });
  expect(selectedScope).toMatchObject({ kind: 'selection' });
  expect(targets.forScope(entryScope!)).toEqual([{ diagnostic: workshopIssue, ignored: true }]);
  expect(targets.forScope(selectedScope!)).toEqual([
    { diagnostic: localIssue, ignored: false },
    { diagnostic: workshopIssue, ignored: true },
  ]);

  const refreshed = createDiagnosticTargets(
    deriveDiagnosticState([localIssue, workshopIssue], null, [localRule]),
    new Map([['a.mod', local]]),
  );
  expect(refreshed.forScope(entryScope!)).toEqual([{ diagnostic: workshopIssue, ignored: false }]);
});

it('uses all group children and includes other selected mods when opening from a selected group', () => {
  const related = issue({
    key: 'a:b',
    code: 'incompatibleActive',
    params: {},
    relatedPackages: ['a.mod', 'b.mod'],
    sourceKeys: [],
    gameVersion: null,
  });
  const disabledChild = issue({
    ...related.suppression!,
    key: 'b',
    relatedPackages: ['b.mod'],
  });
  const selectedMod = issue({
    ...related.suppression!,
    key: 'c',
    relatedPackages: ['c.mod'],
  });
  const group: ModListEntryDto = {
    kind: 'group',
    id: 'g',
    name: 'Group',
    collapsed: true,
    entries: [
      { id: 'a', identity: { packageId: 'a.mod' }, active: true },
      { id: 'b', identity: { packageId: 'b.mod' }, active: false },
    ],
  };
  const targets = createDiagnosticTargets(
    deriveDiagnosticState([related, disabledChild, selectedMod], null, []),
    new Map(),
  );
  const other: ModListEntryDto = {
    kind: 'mod',
    id: 'entry-c',
    active: true,
    identity: { packageId: 'c.mod' },
  };
  const selection = {
    entryIds: new Set([group.id]),
    catalogKeys: new Set<string>(),
    entries: [group, other],
    catalog: new Map(),
  };
  const scope = targets.scopeForTarget({ kind: 'entry', entry: group }, selection, []);
  expect(scope).toMatchObject({ kind: 'group', name: 'Group' });
  expect(scope?.identities).toHaveLength(2);
  expect(targets.forScope(scope!)).toEqual([
    { diagnostic: related, ignored: false },
    { diagnostic: disabledChild, ignored: false },
  ]);
  const multiScope = targets.scopeForTarget(
    { kind: 'entry', entry: group },
    { ...selection, entryIds: new Set([group.id, other.id]) },
    [],
  );
  expect(multiScope?.kind).toBe('selection');
  expect(multiScope?.identities).toHaveLength(3);
  expect(targets.forScope(multiScope!)).toEqual([
    { diagnostic: related, ignored: false },
    { diagnostic: disabledChild, ignored: false },
    { diagnostic: selectedMod, ignored: false },
  ]);
});

it('offers up to three ignore shortcuts ordered by report count for one mod', () => {
  const rules = [
    rule('dependency-1', 'dependencyMissing', 'a.mod', 'one.mod'),
    rule('dependency-2', 'dependencyMissing', 'a.mod', 'two.mod'),
    rule('version', 'gameVersionUnsupported', 'a.mod'),
    rule('conflict', 'incompatibleActive', 'a.mod', 'one.mod'),
    rule('order', 'orderViolationLoadAfter', 'a.mod', 'one.mod'),
  ];
  const targets = createDiagnosticTargets(
    deriveDiagnosticState(rules.map(issue), null, []),
    new Map(),
  );

  expect(
    targets.ignoreShortcutsForScope({
      kind: 'mod',
      name: 'A',
      identities: [{ packageId: 'a.mod' }],
    }),
  ).toEqual([
    { code: 'dependencyMissing', rules: rules.slice(0, 2) },
    { code: 'gameVersionUnsupported', rules: [rules[2]] },
    { code: 'incompatibleActive', rules: [rules[3]] },
  ]);
});

it('requires pending ignorable matches for every selected mod and counts shared reports once', () => {
  const shared = rule('shared', 'incompatibleActive', 'a.mod', 'b.mod');
  const extra = rule('extra', 'incompatibleActive', 'a.mod', 'outside.mod');
  const versionA = rule('version-a', 'gameVersionUnsupported', 'a.mod');
  const versionB = rule('version-b', 'gameVersionUnsupported', 'b.mod');
  const missingA = rule('missing-a', 'dependencyMissing', 'a.mod');
  const missingB = rule('missing-b', 'dependencyMissing', 'b.mod');
  const targets = createDiagnosticTargets(
    deriveDiagnosticState(
      [
        ...[shared, extra, versionA, versionB, missingA].map(issue),
        { ...issue(missingB), suppression: undefined },
      ],
      null,
      [versionB],
    ),
    new Map(),
  );

  expect(
    targets.ignoreShortcutsForScope({
      kind: 'selection',
      identities: [{ packageId: 'a.mod' }, { packageId: 'b.mod' }],
    }),
  ).toEqual([{ code: 'incompatibleActive', rules: [shared, extra] }]);
  expect(
    targets.ignoreShortcutsForScope({
      kind: 'selection',
      identities: [{ packageId: 'a.mod' }, { packageId: 'unaffected.mod' }],
    }),
  ).toEqual([]);
});

function rule(
  key: string,
  code: DiagnosticSuppressionDto['code'],
  ...relatedPackages: string[]
): DiagnosticSuppressionDto {
  return { key, code, params: {}, relatedPackages, sourceKeys: [], gameVersion: null };
}

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
