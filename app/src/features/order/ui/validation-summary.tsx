import { CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiagnosticDto, ModMetadataDto, SeverityDto } from '@/commands';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Row } from '@/components/ui/layout';
import type { ValidationSummary } from '@/domain/diagnostics/suppression';
import type { OrderValidation } from '../hooks/use-order-validation';
import { DiagnosticReport } from './diagnostic-report';
import { SeverityIcon } from './severity-icon';

interface ValidationSummaryProps {
  summary: ValidationSummary;
  diagnostics: DiagnosticDto[];
  modByPackageId: Map<string, ModMetadataDto>;
}

export function ValidationSummaryBadge({
  phase,
  ...props
}: ValidationSummaryProps & { phase: OrderValidation['phase'] }) {
  const { t } = useTranslation();
  if (phase === 'validating') {
    return (
      <Badge variant="secondary">
        <Loader2 className="size-3 animate-spin" />
        {t('order.validation.checking')}
      </Badge>
    );
  }
  if (phase !== 'ready') {
    return (
      <Badge variant={phase === 'error' ? 'destructive' : 'secondary'}>
        {t(phase === 'error' ? 'order.validation.failed' : 'order.validation.unchecked')}
      </Badge>
    );
  }
  return <ReadyValidationSummary {...props} />;
}

function ReadyValidationSummary({ summary, diagnostics, modByPackageId }: ValidationSummaryProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (summary.isClean && summary.suppressed === 0 && !open) {
    return (
      <Badge variant="outline">
        <CheckCircle2 className="size-3 text-emerald-700 dark:text-emerald-400" />
        {t('order.validation.clean')}
      </Badge>
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-0 divide-x px-0"
          title={t('order.validation.summaryTitle')}
        >
          <span className="sr-only">{t('order.validation.summaryTitle')} </span>
          {summary.isClean && (
            <span className="px-2">
              {summary.suppressed
                ? t('suppression.ignoredCount', { count: summary.suppressed })
                : t('order.validation.clean')}
            </span>
          )}
          <SeverityCount
            severity="error"
            count={summary.errors}
            label={t('order.validation.errors', { count: summary.errors })}
          />
          <SeverityCount
            severity="warning"
            count={summary.warnings}
            label={t('order.validation.warnings', { count: summary.warnings })}
          />
          <SeverityCount
            severity="info"
            count={summary.infos}
            label={t('order.validation.infos', { count: summary.infos })}
          />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-[46rem] gap-3 overflow-hidden p-4"
        aria-describedby={undefined}
      >
        <DialogHeader className="min-h-7 justify-center pr-9">
          <DialogTitle>{t('order.validation.summaryTitle')}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 max-h-[70vh] overflow-y-auto">
          <DiagnosticReport diagnostics={diagnostics} modByPackageId={modByPackageId} showClean />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SeverityCount({
  severity,
  count,
  label,
}: {
  severity: SeverityDto;
  count: number;
  label: string;
}) {
  if (count === 0) return null;
  return (
    <Row asChild gap={1} className="px-2 tabular-nums">
      <span>
        <SeverityIcon severity={severity} />
        {label}
      </span>
    </Row>
  );
}
