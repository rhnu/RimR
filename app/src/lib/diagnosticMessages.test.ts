import { describe, expect, it } from 'vitest';
import type { DiagnosticDto, ModMetadataDto } from '@/commands';
import {
  formatDiagnosticMessage,
  formatDiagnosticLocation,
  formatPackageLabel,
} from '@/lib/diagnosticMessages';

function diagnostic(overrides: Partial<DiagnosticDto> = {}): DiagnosticDto {
  return {
    severity: 'warning',
    code: 'configModMissing',
    message: 'Mod in config but not installed: missing.mod',
    location: {
      sourceKey: null,
      path: 'ModsConfig.xml',
      xmlPath: '/ModsConfigData/activeMods/li[2]',
      line: 4,
      col: 9,
      byteOffset: 88,
    },
    relatedLocations: [],
    params: { packageId: 'missing.mod' },
    relatedPackages: ['missing.mod'],
    ...overrides,
  };
}

function mod(id: string, name: string | null): ModMetadataDto {
  return {
    sourceKey: `key.${id}`,
    sourceKind: 'local',
    packageId: id,
    path: `mods/${id}`,
    modifiedAtMs: 0,
    name,
    authors: [],
    supportedVersions: [],
    description: null,
    modVersion: null,
    url: null,
    modIconPath: null,
    steamAppId: null,
    hasAssemblies: false,
    rules: {
      loadAfter: [],
      loadBefore: [],
      forceLoadAfter: [],
      forceLoadBefore: [],
      incompatibleWith: [],
      modDependencies: [],
    },
    valid: true,
    dataMalformed: false,
  };
}

describe('diagnostic message formatting', () => {
  it('uses translated diagnostic templates with params', () => {
    const t = (key: string, params?: Record<string, string>) =>
      key === 'diagnostics.configModMissing' ? `Missing from catalog: ${params?.packageId}` : key;

    expect(formatDiagnosticMessage(diagnostic(), t)).toBe('Missing from catalog: missing.mod');
  });

  it('falls back to backend message when translation is missing', () => {
    const t = (key: string) => key;

    expect(formatDiagnosticMessage(diagnostic(), t)).toBe(
      'Mod in config but not installed: missing.mod',
    );
  });

  it('formats path, xml path, and line/column location details', () => {
    expect(formatDiagnosticLocation(diagnostic())).toBe(
      'ModsConfig.xml /ModsConfigData/activeMods/li[2] 4:9',
    );
  });

  it('enriches packageId params with mod names when modByPackageId is provided', () => {
    const t = (key: string, params?: Record<string, string>) =>
      key === 'diagnostics.configModMissing' ? `Missing: ${params?.packageId}` : key;
    const modByPackageId = new Map([['missing.mod', mod('missing.mod', 'Cool Mod')]]);

    expect(formatDiagnosticMessage(diagnostic(), t, modByPackageId)).toBe(
      'Missing: Cool Mod (missing.mod)',
    );
  });

  it('leaves non-packageId params untouched when enriching', () => {
    const t = (key: string, params?: Record<string, string>) =>
      key === 'diagnostics.sourceReadFailed' ? `Read error for ${params?.sourceKey}` : key;
    const modByPackageId = new Map([['key.bad', mod('key.bad', 'Should Not Appear')]]);
    const diag = diagnostic({
      code: 'sourceReadFailed',
      params: { sourceKey: 'key.bad' },
      relatedPackages: [],
    });

    expect(formatDiagnosticMessage(diag, t, modByPackageId)).toBe('Read error for key.bad');
  });
});

describe('formatPackageLabel', () => {
  it('returns Name (packageId) when name is available', () => {
    const modByPackageId = new Map([['some.mod', mod('some.mod', 'Some Mod')]]);
    expect(formatPackageLabel('some.mod', modByPackageId)).toBe('Some Mod (some.mod)');
  });

  it('returns official name for ludeon.rimworld IDs', () => {
    const modByPackageId = new Map<string, ModMetadataDto>();
    expect(formatPackageLabel('ludeon.rimworld', modByPackageId)).toBe(
      'RimWorld (ludeon.rimworld)',
    );
  });

  it('returns raw packageId when no name is available', () => {
    const modByPackageId = new Map<string, ModMetadataDto>();
    expect(formatPackageLabel('unknown.mod', modByPackageId)).toBe('unknown.mod');
  });

  it('returns raw packageId when mod name is null', () => {
    const modByPackageId = new Map([['null.mod', mod('null.mod', null)]]);
    expect(formatPackageLabel('null.mod', modByPackageId)).toBe('null.mod');
  });
});
