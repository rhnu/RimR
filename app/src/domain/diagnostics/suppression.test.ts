import { describe, expect, it } from 'vitest';
import type {
  DiagnosticDto,
  DiagnosticSuppressionDto,
  ModListEntryDto,
  ValidateOrderDto,
} from '@/commands';
import { mod } from '@/domain/mod-list/test-fixtures';
import {
  addSuppressions,
  collectDiagnostics,
  deriveDiagnosticState,
  entryDiagnosticTargets,
  filterSuppressions,
  removeSuppressions,
} from './suppression';

function rule(
  key: string,
  overrides: Partial<DiagnosticSuppressionDto> = {},
): DiagnosticSuppressionDto {
  return {
    key,
    code: 'gameVersionUnsupported',
    params: { packageId: 'a.mod', gameVersion: '1.7' },
    relatedPackages: ['a.mod'],
    sourceKeys: [],
    gameVersion: '1.7',
    ...overrides,
  };
}

function diagnostic(
  suppression: DiagnosticSuppressionDto | null,
  severity: DiagnosticDto['severity'] = 'warning',
): DiagnosticDto {
  return {
    code: suppression?.code ?? 'gameVersionUnknown',
    severity,
    message: 'A display message',
    params: suppression?.params ?? {},
    relatedPackages: suppression?.relatedPackages ?? [],
    location: null,
    relatedLocations: [],
    suppression,
  };
}

function validation(diagnostics: DiagnosticDto[]): ValidateOrderDto {
  return {
    report: {
      errors: diagnostics.filter((item) => item.severity === 'error'),
      warnings: diagnostics.filter((item) => item.severity === 'warning'),
      infos: diagnostics.filter((item) => item.severity === 'info'),
      isClean: false,
      hasErrors: true,
    },
  };
}

describe('diagnostic suppression identity and targets', () => {
  it('uses backend identity despite translated messages and preserves different version identities', () => {
    const saved = rule('version:a:1.7');
    const translated = {
      ...diagnostic(saved),
      message: 'Another language',
      params: { supportedVersions: '1.6' },
    };
    const nextVersion = diagnostic(rule('version:a:1.8', { gameVersion: '1.8' }));
    const noRule = diagnostic(null);
    expect(
      deriveDiagnosticState([translated, nextVersion, noRule], null, [saved]).diagnostics,
    ).toEqual([
      { diagnostic: translated, ignored: true },
      { diagnostic: nextVersion, ignored: false },
      { diagnostic: noRule, ignored: false },
    ]);
  });

  it('collects selection union, deduplicating a shared relationship without adding unrelated future rules', () => {
    const ab = diagnostic(
      rule('conflict:a:b', { code: 'incompatibleActive', relatedPackages: ['a.mod', 'b.mod'] }),
    );
    const ac = diagnostic(
      rule('conflict:a:c', { code: 'incompatibleActive', relatedPackages: ['a.mod', 'c.mod'] }),
    );
    const d = diagnostic(rule('version:d', { relatedPackages: ['d.mod'] }));
    const state = deriveDiagnosticState([ab, ab, ac, d], null, []);
    const selected = [{ packageId: 'A.MOD' }, { packageId: 'b.mod' }];
    expect(state.forTargets(selected)).toEqual([
      { diagnostic: ab, ignored: false },
      { diagnostic: ac, ignored: false },
    ]);
    expect(state.menuForTargets(selected)).toEqual({
      pending: [ab.suppression, ac.suppression],
      ignored: [],
    });
  });

  it('requires exact source identity even when another installed copy shares the package ID', () => {
    const source = diagnostic(
      rule('xml:broken', { code: 'xmlMalformed', sourceKeys: ['local:broken'] }),
    );
    const missingPackage = diagnostic(
      rule('xml:unknown', {
        code: 'packageIdMissing',
        relatedPackages: [],
        sourceKeys: ['local:unknown'],
      }),
    );
    const state = deriveDiagnosticState([source, missingPackage], null, []);
    expect(state.forTargets([{ packageId: 'a.mod', sourceKey: 'local:healthy' }])).toEqual([]);
    expect(state.forTargets([{ packageId: 'a.mod', sourceKey: 'local:broken' }])).toEqual([
      { diagnostic: source, ignored: false },
    ]);
    expect(
      state.forTargets([{ packageId: 'invalid:unknown', sourceKey: 'local:unknown' }]),
    ).toEqual([{ diagnostic: missingPackage, ignored: false }]);
  });

  it('expands groups including disabled children and ignores separators', () => {
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
    expect(entryDiagnosticTargets(group)).toEqual([{ packageId: 'a.mod' }, { packageId: 'b.mod' }]);
    expect(entryDiagnosticTargets({ kind: 'separator', id: 's', title: 'Section' })).toEqual([]);
  });
});

describe('diagnostic suppression projection and persistence', () => {
  it('deduplicates scan and validation reports and derives counts from unsuppressed diagnostics', () => {
    const suppressed = diagnostic(
      rule('conflict:a:b', { code: 'incompatibleActive', relatedPackages: ['a.mod', 'b.mod'] }),
      'error',
    );
    const warning = diagnostic(rule('version:a'));
    const input = validation([suppressed, warning]);
    const state = deriveDiagnosticState([suppressed], input, [suppressed.suppression!]);
    expect(collectDiagnostics([suppressed], input)).toEqual([suppressed, warning]);
    expect(state.validationSummary).toEqual({
      errors: 0,
      warnings: 1,
      infos: 0,
      isClean: false,
      suppressed: 1,
    });
    expect(state.forTargets([{ packageId: 'a.mod' }])).toEqual([
      { diagnostic: suppressed, ignored: true },
      { diagnostic: warning, ignored: false },
    ]);
    expect(state.menuForTargets([{ packageId: 'b.mod' }])).toEqual({
      pending: [],
      ignored: [suppressed.suppression],
    });
    expect(input.report.errors).toEqual([suppressed]);
  });

  it('counts suppressed-only results separately and never marks pending validation clean', () => {
    const issue = diagnostic(rule('version:a'));
    expect(
      deriveDiagnosticState([], validation([issue]), [issue.suppression!]).validationSummary,
    ).toEqual({ errors: 0, warnings: 0, infos: 0, isClean: true, suppressed: 1 });
    expect(deriveDiagnosticState([], null, []).validationSummary.isClean).toBe(false);
  });

  it('leaves dormant rules available only for their matching package or copy', () => {
    const dormantSource = rule('xml:broken', { sourceKeys: ['local:broken'] });
    const dormantPackage = rule('version:a');
    const state = deriveDiagnosticState([], null, [dormantSource, dormantPackage]);
    expect(state.menuForTargets([{ packageId: 'a.mod', sourceKey: 'workshop:healthy' }])).toEqual({
      pending: [],
      ignored: [dormantPackage],
    });
    expect(state.menuForTargets([{ packageId: 'a.mod', sourceKey: 'local:broken' }])).toEqual({
      pending: [],
      ignored: [dormantSource, dormantPackage],
    });
  });

  it('merges and restores rules by key, retaining dormant unrelated rules', () => {
    const a = rule('a');
    const b = rule('b');
    const updated = rule('a', { params: { packageId: 'a.mod', supportedVersions: '1.6' } });
    expect(addSuppressions([a, b], [updated])).toEqual([updated, b]);
    expect(removeSuppressions([a, b], ['a'])).toEqual([b]);
    expect(filterSuppressions([a, b], ' A.MOD ', 'gameVersionUnsupported', '1.7')).toEqual([a, b]);
    expect(filterSuppressions([a], '', '', '1.8')).toEqual([]);
    expect(filterSuppressions([a], '', 'dependencyMissing', '')).toEqual([]);
    expect(
      filterSuppressions(
        [a],
        'friendly',
        '',
        '',
        new Map([['a.mod', mod('a.mod', 'Friendly Mod')]]),
      ),
    ).toEqual([a]);
    const independent = rule('source', { gameVersion: null, sourceKeys: ['local:broken'] });
    expect(filterSuppressions([a, independent], '', '', 'independent')).toEqual([independent]);
    expect(filterSuppressions([independent], 'broken', '', '')).toEqual([independent]);
  });
});
