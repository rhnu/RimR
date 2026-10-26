import { describe, expect, it } from 'vitest';
import type { DiagnosticDto, ValidateOrderDto } from '@/commands';
import { diagnosticsByPackage, summarizeValidationReport } from '@/lib/diagnostics';

function diagnostic(
  severity: DiagnosticDto['severity'],
  code: DiagnosticDto['code'],
  relatedPackages: string[],
): DiagnosticDto {
  return {
    severity,
    code,
    message: `${code} message`,
    location: null,
    relatedLocations: [],
    params: {},
    relatedPackages,
  };
}

const validation: ValidateOrderDto = {
  report: {
    isClean: false,
    hasErrors: true,
    errors: [diagnostic('error', 'incompatibleActive', ['a.mod', 'b.mod'])],
    warnings: [diagnostic('warning', 'orderViolationLoadAfter', ['c.mod', 'a.mod'])],
    infos: [diagnostic('info', 'packageIdDuplicate', [])],
  },
  graph: {
    edges: [],
    incompatibilities: [],
  },
};

describe('diagnostics helpers', () => {
  it('maps diagnostics to every related package', () => {
    const map = diagnosticsByPackage(validation);

    expect(map.get('a.mod')?.map((d) => d.code)).toEqual([
      'incompatibleActive',
      'orderViolationLoadAfter',
    ]);
    expect(map.get('b.mod')?.map((d) => d.code)).toEqual(['incompatibleActive']);
    expect(map.has('packageIdDuplicate')).toBe(false);
  });

  it('summarizes validation counts', () => {
    expect(summarizeValidationReport(validation)).toEqual({
      errors: 1,
      warnings: 1,
      infos: 1,
      isClean: false,
    });
  });
});
