import type {
  DiagnosticDto,
  DiagnosticSuppressionDto,
  ModIdentityDto,
  ModListEntryDto,
  ModMetadataDto,
  ValidateOrderDto,
} from '@/commands';
import { normalizePackageId } from '@/domain/mods/identity';

export type ValidationSummary = {
  errors: number;
  warnings: number;
  infos: number;
  isClean: boolean;
  suppressed: number;
};

/** One projection drives counters, row icons and reports without altering raw diagnostics. */
export function deriveDiagnosticState(
  scanDiagnostics: readonly DiagnosticDto[],
  validation: ValidateOrderDto | null,
  rules: readonly DiagnosticSuppressionDto[],
  mods: Map<string, ModMetadataDto>,
) {
  const rawDiagnostics = collectDiagnostics(scanDiagnostics, validation);
  const active = rawDiagnostics.filter((diagnostic) => !isSuppressed(diagnostic, rules));
  const diagnosticsMap = new Map<string, DiagnosticDto[]>();
  const sourcePackages = new Map(
    [...mods.values()].map((mod) => [mod.sourceKey, normalizePackageId(mod.packageId)]),
  );
  for (const diagnostic of active) {
    const sources = diagnostic.suppression?.sourceKeys ?? [];
    const packages =
      sources.length > 0
        ? sources.flatMap((source) => sourcePackages.get(source) ?? [])
        : diagnostic.relatedPackages.map(normalizePackageId);
    if (sources.length === 0 && packages.length === 0 && diagnostic.location?.sourceKey) {
      const packageId = sourcePackages.get(diagnostic.location.sourceKey);
      if (packageId) packages.push(packageId);
    }
    for (const packageId of new Set(packages)) {
      const items = diagnosticsMap.get(packageId) ?? [];
      items.push(diagnostic);
      diagnosticsMap.set(packageId, items);
    }
  }
  const validationSummary: ValidationSummary = {
    errors: active.filter((diagnostic) => diagnostic.severity === 'error').length,
    warnings: active.filter((diagnostic) => diagnostic.severity === 'warning').length,
    infos: active.filter((diagnostic) => diagnostic.severity === 'info').length,
    isClean: validation !== null && active.length === 0,
    suppressed: rawDiagnostics.length - active.length,
  };
  return { rawDiagnostics, allDiagnostics: rawDiagnostics, diagnosticsMap, validationSummary };
}

/** Match backend semantic keys; presentation text never defines diagnostic identity. */
export function isSuppressed(
  diagnostic: DiagnosticDto,
  rules: readonly DiagnosticSuppressionDto[],
): boolean {
  return Boolean(
    diagnostic.suppression && rules.some((rule) => rule.key === diagnostic.suppression?.key),
  );
}

export function uniqueDiagnostics(diagnostics: readonly DiagnosticDto[]): DiagnosticDto[] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key =
      diagnostic.suppression?.key ??
      JSON.stringify([
        diagnostic.code,
        diagnostic.relatedPackages,
        diagnostic.location,
        diagnostic.params,
      ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function collectDiagnostics(
  scan: readonly DiagnosticDto[],
  validation: ValidateOrderDto | null,
): DiagnosticDto[] {
  return uniqueDiagnostics([
    ...scan,
    ...(validation
      ? [...validation.report.errors, ...validation.report.warnings, ...validation.report.infos]
      : []),
  ]);
}

export function diagnosticsForTargets(
  diagnostics: readonly DiagnosticDto[],
  identities: readonly ModIdentityDto[],
): DiagnosticDto[] {
  const packages = new Set(identities.map((identity) => normalizePackageId(identity.packageId)));
  const sources = new Set(
    identities.flatMap((identity) => (identity.sourceKey ? [identity.sourceKey] : [])),
  );
  return uniqueDiagnostics(
    diagnostics.filter((diagnostic) => {
      const sourceKeys = diagnostic.suppression?.sourceKeys ?? [];
      if (sourceKeys.length > 0) return sourceKeys.some((source) => sources.has(source));
      return (
        diagnostic.relatedPackages.some((pkg) => packages.has(normalizePackageId(pkg))) ||
        Boolean(diagnostic.location?.sourceKey && sources.has(diagnostic.location.sourceKey))
      );
    }),
  );
}

export function entryDiagnosticTargets(entry: ModListEntryDto): ModIdentityDto[] {
  if (entry.kind === 'mod') return [entry.identity];
  if (entry.kind === 'group') return entry.entries.map((child) => child.identity);
  return [];
}

export function addSuppressions(
  current: readonly DiagnosticSuppressionDto[],
  additions: readonly DiagnosticSuppressionDto[],
): DiagnosticSuppressionDto[] {
  return [...new Map([...current, ...additions].map((rule) => [rule.key, rule])).values()];
}

export function removeSuppressions(
  current: readonly DiagnosticSuppressionDto[],
  keys: readonly string[],
): DiagnosticSuppressionDto[] {
  const removed = new Set(keys);
  return current.filter((rule) => !removed.has(rule.key));
}

export function filterSuppressions(
  rules: readonly DiagnosticSuppressionDto[],
  query: string,
  code: string,
  version: string,
  mods: ReadonlyMap<string, ModMetadataDto> = new Map(),
): DiagnosticSuppressionDto[] {
  const needle = query.trim().toLocaleLowerCase();
  return rules.filter(
    (rule) =>
      (!code || rule.code === code) &&
      (!version || (rule.gameVersion ?? 'independent') === version) &&
      (!needle ||
        [
          ...rule.relatedPackages,
          ...rule.sourceKeys,
          ...Object.values(rule.params),
          ...rule.relatedPackages.flatMap((pkg) => mods.get(normalizePackageId(pkg))?.name ?? []),
        ].some((value) => value.toLocaleLowerCase().includes(needle))),
  );
}
