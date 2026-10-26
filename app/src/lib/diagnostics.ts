import type { DiagnosticDto, ValidateOrderDto } from '@/commands';

export type ValidationSummary = {
  errors: number;
  warnings: number;
  infos: number;
  isClean: boolean;
};

export function diagnosticsByPackage(
  validation: ValidateOrderDto | null,
): Map<string, DiagnosticDto[]> {
  const map = new Map<string, DiagnosticDto[]>();
  if (!validation) {
    return map;
  }

  for (const diagnostic of allDiagnostics(validation)) {
    for (const packageId of diagnostic.relatedPackages) {
      const existing = map.get(packageId) ?? [];
      existing.push(diagnostic);
      map.set(packageId, existing);
    }
  }
  return map;
}

export function summarizeValidationReport(validation: ValidateOrderDto | null): ValidationSummary {
  if (!validation) {
    return { errors: 0, warnings: 0, infos: 0, isClean: true };
  }
  return {
    errors: validation.report.errors.length,
    warnings: validation.report.warnings.length,
    infos: validation.report.infos.length,
    isClean: validation.report.isClean,
  };
}

function allDiagnostics(validation: ValidateOrderDto): DiagnosticDto[] {
  return [...validation.report.errors, ...validation.report.warnings, ...validation.report.infos];
}
