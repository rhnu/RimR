import type { TFunction } from 'i18next';
import type {
  DiagnosticDto,
  DiagnosticLocationDto,
  DiagnosticSuppressionDto,
  ModMetadataDto,
} from '@/commands';
import { normalizePackageId } from '@/domain/mods/identity';
import { officialDisplayName } from '@/domain/mods/official-content';
import type en from '@/i18n/locales/en.json';

export type DiagnosticPresentation = {
  summary: string;
  subject?: { packageId: string; label: string };
  details: { label: string; value: string; mono?: boolean }[];
};

type Diagnostic = DiagnosticDto | DiagnosticSuppressionDto;
type DetailKey = keyof typeof en.diagnostics.details;
type AddDetail = (key: DetailKey, value: string | undefined, mono?: boolean) => void;

const targetParams = {
  dependencyMissing: 'dependencyPackageId',
  dependencyInactive: 'dependencyPackageId',
  incompatibleActive: 'incompatiblePackageId',
  orderViolationLoadAfter: 'targetPackageId',
  orderViolationLoadBefore: 'targetPackageId',
} as const;

/** Presents the same diagnostic while it is active or stored as an ignore rule. */
export function presentDiagnostic(
  item: Diagnostic,
  t: TFunction,
  mods: ReadonlyMap<string, ModMetadataDto>,
): DiagnosticPresentation {
  const live = 'location' in item ? item : undefined;
  const saved = 'sourceKeys' in item ? item : item.suppression;
  const locations = [...(live?.location ? [live.location] : []), ...(live?.relatedLocations ?? [])];
  const details: DiagnosticPresentation['details'] = [];
  const addDetail: AddDetail = (key, value, mono) => {
    if (value) details.push({ label: t(`diagnostics.details.${key}`), value, mono });
  };
  const context = { live, saved, locations, t, mods, addDetail };
  const { summary, subject, packageIds } = describeDiagnostic(item, context);
  addDetail(packageIds.size === 1 ? 'packageId' : 'packageIds', [...packageIds].join(', '), true);
  if (item.code === 'packageIdDuplicate') {
    addDuplicateLocations(item, context);
  } else {
    const relatedLocation =
      item.code === 'gameVersionUnsupported' ? 'noVersionWarningList' : 'relatedLocation';
    for (const location of locations) {
      const key = location === live?.location ? 'location' : relatedLocation;
      addDetail(key, formatLocation(location), true);
    }
  }
  return { summary, subject, details };
}

type DiagnosticContext = {
  live: DiagnosticDto | undefined;
  saved: DiagnosticSuppressionDto | null | undefined;
  locations: DiagnosticLocationDto[];
  t: TFunction;
  mods: ReadonlyMap<string, ModMetadataDto>;
  addDetail: AddDetail;
};

function describeDiagnostic(item: Diagnostic, context: DiagnosticContext) {
  const { t, live, saved, locations, mods, addDetail } = context;
  const packageId = param(item, 'packageId');
  const packageIds = new Set(item.relatedPackages);
  if (packageId) packageIds.add(packageId);
  const labelFor = (id: string) => {
    const normalized = normalizePackageId(id);
    return mods.get(normalized)?.name?.trim() || officialDisplayName(normalized) || id;
  };

  let summary: string;
  let subject: DiagnosticPresentation['subject'];
  switch (item.code) {
    case 'gameVersionUnsupported':
    case 'configModMissing':
    case 'activeModMissing':
    case 'packageIdDuplicate': {
      const id = packageId ?? (packageIds.size === 1 ? item.relatedPackages[0] : undefined);
      if (id) subject = { packageId: id, label: labelFor(id) };
      summary = summarizeSinglePackage(item.code, item, context);
      break;
    }
    case 'dependencyMissing':
    case 'dependencyInactive':
    case 'incompatibleActive':
    case 'orderViolationLoadAfter':
    case 'orderViolationLoadBefore': {
      const targetId = param(item, targetParams[item.code]);
      if (targetId) packageIds.add(targetId);
      const primary = packageId ?? otherPackage(packageIds, targetId);
      const target = targetId ?? otherPackage(packageIds, packageId);
      const summaryKey =
        item.code === 'orderViolationLoadAfter' || item.code === 'orderViolationLoadBefore'
          ? 'mustLoadBefore'
          : item.code;
      // Both order codes describe an edge from the later mod to its prerequisite.
      summary =
        primary && target
          ? t(`diagnostics.${summaryKey}`, { package: labelFor(primary), target: labelFor(target) })
          : t(`suppression.types.${item.code}`);
      addDetail('rule', param(item, 'rule'), true);
      addDetail('alternativeDependencies', param(item, 'alternativePackageIds'), true);
      break;
    }
    case 'xmlMalformed':
    case 'packageIdMissing':
    case 'sourceReadFailed': {
      const source = param(item, 'sourceKey') ?? live?.location?.sourceKey ?? saved?.sourceKeys[0];
      const sourceLabel = source && (mods.get(source)?.name?.trim() || sourceBasename(source));
      summary = t(`diagnostics.${item.code}`);
      if (sourceLabel) summary = t('diagnostics.sourceIssue', { source: sourceLabel, summary });
      const readOrParseError = item.code === 'packageIdMissing' ? undefined : live?.message;
      addDetail('reason', param(item, 'error') ?? readOrParseError);
      if (locations.length === 0) addDetail('source', source, true);
      break;
    }
    case 'circularDependency':
      summary = summarizeCycle(item, context, labelFor);
      break;
    case 'gameVersionUnknown':
      summary = t('diagnostics.gameVersionUnknown');
      break;
  }

  return { summary, subject, packageIds };
}

type SinglePackageCode =
  | 'gameVersionUnsupported'
  | 'configModMissing'
  | 'activeModMissing'
  | 'packageIdDuplicate';

function summarizeSinglePackage(
  code: SinglePackageCode,
  item: Diagnostic,
  { t, live, locations, saved, addDetail }: DiagnosticContext,
): string {
  if (code === 'gameVersionUnsupported') {
    const version =
      majorMinorVersion(saved?.gameVersion) ?? majorMinorVersion(param(item, 'gameVersion'));
    const supported = new Set(
      param(item, 'supportedVersions')
        ?.split(',')
        .flatMap((value) => majorMinorVersion(value) ?? []),
    );
    addDetail('supportedVersions', [...supported].join(', '));
    if (version) {
      const key = live?.severity === 'info' ? 'versionListedByNoVersionWarning' : 'versionMismatch';
      return t(`diagnostics.${key}`, { version });
    }
  }
  if (code === 'packageIdDuplicate') {
    const count = Math.max(locations.length, saved?.sourceKeys.length ?? 0);
    if (count > 1) return t('diagnostics.duplicateCopies', { count });
  }
  return t(`diagnostics.${code}`);
}

function summarizeCycle(
  item: Diagnostic,
  { t, live, addDetail }: DiagnosticContext,
  labelFor: (id: string) => string,
): string {
  const rawCycle = param(item, 'cycle');
  const ids = live
    ? [...item.relatedPackages, ...item.relatedPackages.slice(0, 1)]
    : rawCycle?.split(' -> ');
  const packages = new Set(item.relatedPackages);
  const cycle =
    ids?.every((id) => packages.has(id)) && new Set(ids).size === packages.size ? ids : undefined;
  addDetail('cycle', cycle?.map(labelFor).join(' → ') || rawCycle);

  const participants = [...new Set(cycle ?? item.relatedPackages)].map(labelFor);
  const names = participants.slice(0, 2).join(t('diagnostics.cycleSeparator'));
  if (!names) return t('diagnostics.circularDependency');
  if (participants.length <= 2) return t('diagnostics.cycleWithMods', { mods: names });
  return t('diagnostics.cycleWithMoreMods', {
    mods: names,
    count: participants.length,
    remaining: participants.length - 2,
  });
}

function addDuplicateLocations(
  item: Diagnostic,
  { locations, saved, addDetail }: DiagnosticContext,
) {
  if (locations.length > 0) {
    // The backend puts the effective copy first in the structured locations.
    for (const [index, location] of locations.entries()) {
      addDetail(index === 0 ? 'loadedCopy' : 'shadowedCopy', formatLocation(location), true);
    }
    return;
  }

  const loaded = param(item, 'usedPath');
  const shadowed = param(item, 'shadowedPaths');
  addDetail('loadedCopy', loaded, true);
  addDetail('shadowedCopies', shadowed, true);
  if (loaded || shadowed) return;

  const paths = param(item, 'paths');
  if (paths) addDetail('location', paths, true);
  else for (const source of saved?.sourceKeys ?? []) addDetail('source', source, true);
}

function param(item: Diagnostic, key: string): string | undefined {
  return item.params[key]?.trim() || undefined;
}

function otherPackage(
  packages: ReadonlySet<string>,
  known: string | undefined,
): string | undefined {
  if (!known || packages.size !== 2) return undefined;
  return [...packages].find((id) => id !== known);
}

function sourceBasename(source: string): string | undefined {
  return source
    .split(/[\\/]+/)
    .filter(Boolean)
    .pop();
}

function majorMinorVersion(raw: string | null | undefined): string | undefined {
  const [major, minor] = raw?.split('rev', 1)[0]?.trim().split('.') ?? [];
  if (!major || !/^\d+$/.test(major) || Number(major) === 0) return undefined;
  return `${Number(major)}.${minor && /^\d+$/.test(minor) ? Number(minor) : 0}`;
}

function formatLocation(location: DiagnosticLocationDto): string {
  return [
    location.path,
    location.xmlPath ?? null,
    location.line != null && location.col != null ? `${location.line}:${location.col}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n');
}

/// Formats a package ID as `Name (packageId)` when a human-readable name is
/// available, otherwise returns the raw package ID.
export function formatPackageLabel(
  packageId: string,
  modByPackageId: Map<string, ModMetadataDto>,
): string {
  const mod = modByPackageId.get(packageId);
  const name = mod?.name ?? officialDisplayName(packageId);
  return name ? `${name} (${packageId})` : packageId;
}
