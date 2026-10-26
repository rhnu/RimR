import type { DiagnosticDto, DiagnosticLocationDto, ModMetadataDto } from '@/commands';
import { officialDisplayName } from '@/lib/officialContent';

export function formatDiagnosticMessage(
  diagnostic: DiagnosticDto,
  t: unknown,
  modByPackageId?: Map<string, ModMetadataDto>,
): string {
  const key = `diagnostics.${diagnostic.code}`;
  const translate = t as (key: string, params?: Record<string, string>) => unknown;
  const params = modByPackageId
    ? enrichPackageParams(diagnostic.params, modByPackageId)
    : diagnostic.params;
  const translated = String(translate(key, params));
  return translated === key ? diagnostic.message : translated;
}

export function formatDiagnosticLocation(diagnostic: DiagnosticDto): string | null {
  return diagnostic.location ? formatLocation(diagnostic.location) : null;
}

export function formatLocation(location: DiagnosticLocationDto): string {
  return [
    location.path,
    location.xmlPath ?? null,
    location.line != null && location.col != null ? `${location.line}:${location.col}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ');
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

function enrichPackageParams(
  params: Record<string, string>,
  modByPackageId: Map<string, ModMetadataDto>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    result[key] = key.toLowerCase().endsWith('packageid')
      ? formatPackageLabel(value, modByPackageId)
      : value;
  }
  return result;
}
