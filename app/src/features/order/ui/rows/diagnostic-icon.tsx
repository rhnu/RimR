import { useTranslation } from 'react-i18next';
import type { DiagnosticDto } from '@/commands';
import type { DiagnosticItem } from '@/domain/diagnostics/suppression';
import { formatDiagnosticMessage } from '@/domain/diagnostics/messages';
import { SeverityIcon } from '../severity-icon';

export function DiagnosticIcon({ items }: { items: DiagnosticItem[] }) {
  const diagnostics = items.flatMap((item) => (item.ignored ? [] : [item.diagnostic]));
  const { t } = useTranslation();
  if (diagnostics.length === 0) {
    return null;
  }
  const severity = highestSeverity(diagnostics);
  const title = diagnostics.map((diagnostic) => formatDiagnosticMessage(diagnostic, t)).join('\n');
  return (
    <span title={title}>
      <SeverityIcon severity={severity} />
      <span className="sr-only">
        {t(`severity.${severity}`)}: {title}
      </span>
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
