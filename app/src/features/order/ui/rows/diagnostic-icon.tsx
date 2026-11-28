import { useTranslation } from 'react-i18next';
import type { DiagnosticItem } from '@/domain/diagnostics/suppression';
import { SeverityIcon } from '@/features/diagnostics/severity-icon';

export function DiagnosticIcon({ items }: { items: DiagnosticItem[] }) {
  const { t } = useTranslation();
  const counts = { error: 0, warning: 0, info: 0 };
  for (const { diagnostic, ignored } of items) {
    if (!ignored) counts[diagnostic.severity] += 1;
  }
  const total = counts.error + counts.warning + counts.info;
  if (!total) return null;

  const severity = counts.error ? 'error' : counts.warning ? 'warning' : 'info';
  const title = [
    counts.error ? t('order.validation.errors', { count: counts.error }) : null,
    counts.warning ? t('order.validation.warnings', { count: counts.warning }) : null,
    counts.info ? t('order.validation.infos', { count: counts.info }) : null,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <span title={title} className="inline-flex shrink-0 items-center gap-0.5">
      <SeverityIcon severity={severity} />
      {total > 1 ? (
        <span aria-hidden="true" className="text-xs text-muted-foreground tabular-nums">
          {total}
        </span>
      ) : null}
      <span className="sr-only">{title}</span>
    </span>
  );
}
