import { AlertTriangle, CircleAlert, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DiagnosticDto } from '@/commands';
import { formatDiagnosticMessage } from '@/lib/diagnosticMessages';

export function DiagnosticIcon({ diagnostics }: { diagnostics: DiagnosticDto[] }) {
  const { t } = useTranslation();
  if (diagnostics.length === 0) {
    return null;
  }
  const severity = highestSeverity(diagnostics);
  const title = diagnostics.map((diagnostic) => formatDiagnosticMessage(diagnostic, t)).join('\n');
  if (severity === 'error') {
    return (
      <span title={title}>
        <CircleAlert className="size-4 shrink-0 text-destructive" />
      </span>
    );
  }
  if (severity === 'warning') {
    return (
      <span title={title}>
        <AlertTriangle className="size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
      </span>
    );
  }
  return (
    <span title={title}>
      <Info className="size-4 shrink-0 text-muted-foreground" />
    </span>
  );
}

function highestSeverity(diagnostics: DiagnosticDto[]): DiagnosticDto['severity'] {
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    return 'error';
  }
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'warning')) {
    return 'warning';
  }
  return 'info';
}
