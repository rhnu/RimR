import { useTranslation } from 'react-i18next';
import type { DiagnosticDto, ModMetadataDto } from '@/commands';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  formatDiagnosticLocation,
  formatDiagnosticMessage,
  formatPackageLabel,
} from '@/lib/diagnosticMessages';
import { cn } from '@/lib/utils';

type DiagnosticGroup = {
  severity: DiagnosticDto['severity'];
  diagnostics: DiagnosticDto[];
};

export function ValidationDiagnosticList({
  diagnostics,
  modByPackageId,
}: {
  diagnostics: DiagnosticDto[];
  modByPackageId: Map<string, ModMetadataDto>;
}) {
  const { t } = useTranslation();
  const groups = groupBySeverity(diagnostics);
  if (groups.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        {t('order.validation.clean')}
      </div>
    );
  }
  return (
    <ScrollArea className="max-h-[60vh]">
      <div className="space-y-3 pr-3">
        {groups.map((group) => (
          <section key={group.severity} className="space-y-1">
            <h3
              className={cn(
                'select-none text-xs font-semibold uppercase',
                severityTextClass(group.severity),
              )}
            >
              {t(`severity.${group.severity}`)} ({group.diagnostics.length})
            </h3>
            <ul className="space-y-1">
              {group.diagnostics.map((diagnostic, index) => (
                <li
                  key={`${diagnostic.code}-${index}`}
                  className="border border-border px-2 py-1.5 text-xs"
                >
                  <p>{formatDiagnosticMessage(diagnostic, t, modByPackageId)}</p>
                  {formatDiagnosticLocation(diagnostic) ? (
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {formatDiagnosticLocation(diagnostic)}
                    </p>
                  ) : null}
                  {diagnostic.relatedPackages.length > 0 ? (
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {diagnostic.relatedPackages
                        .map((pkg) => formatPackageLabel(pkg, modByPackageId))
                        .join(', ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ScrollArea>
  );
}

function groupBySeverity(diagnostics: DiagnosticDto[]): DiagnosticGroup[] {
  const errors: DiagnosticDto[] = [];
  const warnings: DiagnosticDto[] = [];
  const infos: DiagnosticDto[] = [];
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === 'error') {
      errors.push(diagnostic);
    } else if (diagnostic.severity === 'warning') {
      warnings.push(diagnostic);
    } else {
      infos.push(diagnostic);
    }
  }
  const groups: DiagnosticGroup[] = [];
  if (errors.length > 0) groups.push({ severity: 'error', diagnostics: errors });
  if (warnings.length > 0) groups.push({ severity: 'warning', diagnostics: warnings });
  if (infos.length > 0) groups.push({ severity: 'info', diagnostics: infos });
  return groups;
}

function severityTextClass(severity: DiagnosticDto['severity']): string {
  switch (severity) {
    case 'error':
      return 'text-destructive';
    case 'warning':
      return 'text-yellow-700 dark:text-yellow-400';
    case 'info':
      return 'text-muted-foreground';
  }
}
