import { describe, expect, it } from 'vitest';
import { createInstance } from 'i18next';
import en from '@/i18n/locales/en.json';
import zhCN from '@/i18n/locales/zh-CN.json';
import type { DiagnosticDto, DiagnosticSuppressionDto, ModMetadataDto } from '@/commands';
import { formatPackageLabel, presentDiagnostic } from '@/domain/diagnostics/messages';

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

async function translator(locale = 'en') {
  const i18n = createInstance();
  await i18n.init({
    resources: { en: { translation: en }, 'zh-CN': { translation: zhCN } },
    lng: locale,
    interpolation: { escapeValue: false },
  });
  return i18n.t;
}

function suppression(overrides: Partial<DiagnosticSuppressionDto>): DiagnosticSuppressionDto {
  return {
    key: 'saved-rule',
    code: 'gameVersionUnsupported',
    params: {},
    relatedPackages: ['older.mod'],
    sourceKeys: [],
    gameVersion: '1.7',
    ...overrides,
  };
}

describe('game version diagnosis', () => {
  it.each([
    ['en', 'Unsupported on current version 1.7'],
    ['zh-CN', '不适配当前版本 1.7'],
  ])('uses major and minor versions in %s', async (locale, summary) => {
    const t = await translator(locale);
    const mods = new Map([['older.mod', mod('older.mod', 'Older Mod')]]);
    const mismatch = diagnostic({
      code: 'gameVersionUnsupported',
      params: {
        packageId: 'older.mod',
        gameVersion: '1.7.4633 rev123',
        supportedVersions: '1.5.812 rev40, 1.5, 1.6',
      },
      relatedPackages: ['older.mod'],
    });
    const presentation = presentDiagnostic(mismatch, t, mods);
    expect(presentation.summary).toBe(summary);
    expect(presentation.subject).toEqual({ packageId: 'older.mod', label: 'Older Mod' });
    expect(presentation.details.map(({ value }) => value)).toContain('1.5, 1.6');
    expect(presentDiagnostic(suppression({}), t, mods).summary).toBe(summary);
  });

  it.each([
    ['en', 'Listed by No Version Warning for 1.7', 'No Version Warning list'],
    ['zh-CN', 'No Version Warning 名单已收录（1.7）', 'No Version Warning 名单'],
  ])(
    'shows the local list and the declared versions in %s',
    async (locale, summary, sourceLabel) => {
      const t = await translator(locale);
      const path = 'workshop/2599504692/1.7/ModIdsToFix.xml';
      const presentation = presentDiagnostic(
        diagnostic({
          severity: 'info',
          code: 'gameVersionUnsupported',
          params: { packageId: 'older.mod', gameVersion: '1.7.5021', supportedVersions: '1.6' },
          relatedPackages: ['older.mod'],
          relatedLocations: [
            { path, sourceKey: null, xmlPath: null, line: null, col: null, byteOffset: null },
          ],
        }),
        t,
        new Map(),
      );
      expect(presentation.summary).toBe(summary);
      expect(presentation.details.map(({ value }) => value)).toContain('1.6');
      expect(presentation.details).toContainEqual({ label: sourceLabel, value: path, mono: true });
    },
  );
});

describe('mod relationship diagnostics', () => {
  it.each(['orderViolationLoadAfter', 'orderViolationLoadBefore'] as const)(
    'keeps the prerequisite first for %s',
    async (code) => {
      const t = await translator();
      const mods = new Map([
        ['aaa.later', mod('aaa.later', 'Later')],
        ['zzz.first', mod('zzz.first', 'First')],
      ]);
      const item = diagnostic({
        code,
        params: {
          packageId: 'aaa.later',
          targetPackageId: 'zzz.first',
          rule: code === 'orderViolationLoadAfter' ? 'loadAfter' : 'loadBefore',
        },
        relatedPackages: ['aaa.later', 'zzz.first'],
      });
      const presentation = presentDiagnostic(item, t, mods);
      expect(presentation.summary).toBe('First must load before Later');
      expect(presentation.details).toContainEqual(
        expect.objectContaining({ label: 'Rule', value: item.params.rule }),
      );
    },
  );

  it('does not infer a relationship direction from a saved rule with only sorted IDs', async () => {
    const t = await translator();
    const saved = suppression({
      code: 'dependencyMissing',
      relatedPackages: ['aaa.required', 'zzz.dependent'],
    });
    const presentation = presentDiagnostic(saved, t, new Map());
    expect(presentation.summary).toBe('Missing dependency');
    expect(presentation.details).toContainEqual(
      expect.objectContaining({ label: 'Package IDs', value: 'aaa.required, zzz.dependent' }),
    );
  });

  it('describes a saved cycle with mod names in the original edge order', async () => {
    const t = await translator('zh-CN');
    const mods = new Map([
      ['aaa.mod', mod('aaa.mod', 'Alpha')],
      ['bbb.mod', mod('bbb.mod', 'Beta')],
      ['ccc.mod', mod('ccc.mod', 'Gamma')],
    ]);
    const cycle = presentDiagnostic(
      suppression({
        code: 'circularDependency',
        params: { cycle: 'aaa.mod -> ccc.mod -> bbb.mod -> aaa.mod' },
        relatedPackages: ['aaa.mod', 'bbb.mod', 'ccc.mod'],
      }),
      t,
      mods,
    );
    expect(cycle.summary).toBe('循环依赖涉及 Alpha、Gamma 等 3 个模组');
    expect(cycle.details).toContainEqual(
      expect.objectContaining({ label: '循环顺序', value: 'Alpha → Gamma → Beta → Alpha' }),
    );
  });
});

describe('installation diagnostics', () => {
  it('keeps used and shadowed paths with their copy roles', async () => {
    const t = await translator('zh-CN');
    const loaded = 'D:\\Mods\\Older, Expanded';
    const shadowed = 'D:\\Workshop\\12345';
    const location = (sourceKey: string) => ({
      sourceKey,
      path: sourceKey + '\\About\\About.xml',
      xmlPath: '/ModMetaData/packageId',
      line: null,
      col: null,
      byteOffset: null,
    });
    const duplicate = diagnostic({
      code: 'packageIdDuplicate',
      params: { packageId: 'older.mod', usedPath: loaded, shadowedPaths: shadowed },
      relatedPackages: ['older.mod'],
      location: location(loaded),
      relatedLocations: [location(shadowed)],
    });
    const mods = new Map([['older.mod', mod('older.mod', 'Older Mod')]]);
    const current = presentDiagnostic(duplicate, t, mods);
    expect(current.summary).toBe('发现 2 个安装副本');
    expect(current.subject?.label).toBe('Older Mod');
    expect(current.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '加载的副本',
          value: expect.stringContaining(location(loaded).path),
        }),
        expect.objectContaining({
          label: '被忽略的副本',
          value: expect.stringContaining(location(shadowed).path),
        }),
      ]),
    );
    const saved = presentDiagnostic(
      suppression({
        code: duplicate.code,
        params: duplicate.params,
        gameVersion: null,
        sourceKeys: [loaded, shadowed],
      }),
      t,
      mods,
    );
    expect(saved.summary).toBe(current.summary);
    expect(saved.details).toContainEqual(
      expect.objectContaining({ label: '加载的副本', value: loaded }),
    );
  });

  it('keeps the source folder in the summary and parser facts in details', async () => {
    const t = await translator('zh-CN');
    const sourceKey = 'D:\\RimWorld\\Mods\\Broken Mod';
    const parsed = presentDiagnostic(
      diagnostic({
        code: 'xmlMalformed',
        location: {
          sourceKey,
          path: sourceKey + '\\About\\About.xml',
          xmlPath: '/ModMetaData',
          line: 4,
          col: 9,
          byteOffset: 88,
        },
        params: { sourceKey, error: 'Unexpected closing tag' },
        relatedPackages: [],
      }),
      t,
      new Map(),
    );
    expect(parsed.summary).toBe('无法解析 About.xml（Broken Mod）');
    expect(parsed.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '原因', value: 'Unexpected closing tag' }),
        expect.objectContaining({
          label: '位置',
          value: expect.stringMatching(/About\.xml.*\/ModMetaData.*4:9/s),
        }),
      ]),
    );
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
