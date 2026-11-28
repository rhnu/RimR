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

export type DiagnosticItem = { diagnostic: DiagnosticDto; ignored: boolean };

/** One projection drives counters, row icons and reports without altering raw diagnostics. */
export function deriveDiagnosticState(
  scanDiagnostics: readonly DiagnosticDto[],
  validation: ValidateOrderDto | null,
  rules: readonly DiagnosticSuppressionDto[],
) {
  const ignoredKeys = new Set(rules.map((rule) => rule.key));
  const diagnostics = collectDiagnostics(scanDiagnostics, validation).map((diagnostic) => ({
    diagnostic,
    ignored: isSuppressed(diagnostic, ignoredKeys),
  }));
  const indexesByTarget = new Map<string, number[]>();
  const counts = { error: 0, warning: 0, info: 0 };
  let suppressed = 0;
  for (const [index, { diagnostic, ignored }] of diagnostics.entries()) {
    if (ignored) suppressed += 1;
    else counts[diagnostic.severity] += 1;
    const keys = matchKeys(
      diagnostic.relatedPackages,
      diagnostic.suppression?.sourceKeys ?? [],
      diagnostic.location?.sourceKey,
    );
    for (const key of new Set(keys)) {
      const indexes = indexesByTarget.get(key) ?? [];
      indexes.push(index);
      indexesByTarget.set(key, indexes);
    }
  }
  const validationSummary: ValidationSummary = {
    errors: counts.error,
    warnings: counts.warning,
    infos: counts.info,
    isClean: validation !== null && diagnostics.length === suppressed,
    suppressed,
  };

  function findForKeys(keys: Set<string>): DiagnosticItem[] {
    const indexes = new Set<number>();
    for (const key of keys) {
      for (const index of indexesByTarget.get(key) ?? []) indexes.add(index);
    }
    if (indexes.size === 0) return EMPTY_ITEMS;
    return [...indexes].sort((left, right) => left - right).map((index) => diagnostics[index]!);
  }

  return {
    diagnostics,
    validationSummary,
    forTargets: (identities: readonly ModIdentityDto[]) => findForKeys(targetKeys(identities)),
  };
}

export type DiagnosticState = ReturnType<typeof deriveDiagnosticState>;

const EMPTY_ITEMS: DiagnosticItem[] = [];

/** Match backend semantic keys; presentation text never defines diagnostic identity. */
function isSuppressed(diagnostic: DiagnosticDto, ignoredKeys: ReadonlySet<string>): boolean {
  return diagnostic.suppression != null && ignoredKeys.has(diagnostic.suppression.key);
}

function uniqueDiagnostics(diagnostics: readonly DiagnosticDto[]): DiagnosticDto[] {
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

function targetKeys(identities: readonly ModIdentityDto[]): Set<string> {
  return new Set(
    identities.flatMap(({ packageId, sourceKey }) => matchKeys([packageId], [], sourceKey)),
  );
}

function matchKeys(
  packages: readonly string[],
  sources: readonly string[],
  location?: string | null,
): string[] {
  if (sources.length > 0) return sources.map((source) => `source:${source}`);
  const keys = packages.map((pkg) => `package:${normalizePackageId(pkg)}`);
  if (location) keys.push(`source:${location}`);
  return keys;
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
