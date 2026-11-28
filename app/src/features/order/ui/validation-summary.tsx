import { CheckCircle2, Loader2 } from 'lucide-react';
import { useRef, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModMetadataDto, SeverityDto } from '@/commands';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Row } from '@/components/ui/layout';
import type { DiagnosticItem, ValidationSummary } from '@/domain/diagnostics/suppression';
import { SeverityIcon } from '@/features/diagnostics/severity-icon';
import { cn } from '@/lib/utils';
import type { OrderValidation } from '../hooks/use-order-validation';
import type { OrderDiagnosticScope } from '../model/diagnostic-targets';
import { DiagnosticReport, type DiagnosticActions } from './diagnostic-report';

const PHASE_MESSAGES = {
  idle: 'order.validation.unchecked',
  validating: 'order.validation.checking',
  error: 'order.validation.failed',
} as const;

export function ValidationSummaryBadge({
  phase,
  summary,
  onOpen,
  ref,
}: {
  phase: OrderValidation['phase'];
  summary: ValidationSummary;
  onOpen: (trigger: HTMLButtonElement) => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  const { t } = useTranslation();
  const ready = phase === 'ready';
  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      size="sm"
      aria-haspopup={ready ? 'dialog' : undefined}
      aria-disabled={!ready || undefined}
      tabIndex={ready ? undefined : -1}
      title={t(ready ? 'order.validation.summaryTitle' : PHASE_MESSAGES[phase])}
      onClick={(event) => ready && onOpen(event.currentTarget)}
      className={cn(
        'h-7 gap-0 divide-x divide-border px-0',
        !ready && 'pointer-events-none border-0 shadow-none',
      )}
    >
      {ready ? (
        <>
          <span className="sr-only">{t('order.validation.summaryTitle')} </span>
          {summary.isClean && (
            <Row asChild gap={1} className="px-2">
              <span>
                {summary.suppressed ? (
                  t('suppression.ignoredCount', { count: summary.suppressed })
                ) : (
                  <>
                    <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
                    {t('order.validation.clean')}
                  </>
                )}
              </span>
            </Row>
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
        </>
      ) : (
        <ValidationPhaseBadge phase={phase} />
      )}
    </Button>
  );
}

function ValidationPhaseBadge({ phase }: { phase: Exclude<OrderValidation['phase'], 'ready'> }) {
  const { t } = useTranslation();
  return (
    <Badge variant={phase === 'error' ? 'destructive' : 'secondary'}>
      {phase === 'validating' && <Loader2 aria-hidden="true" className="size-3 animate-spin" />}
      {t(PHASE_MESSAGES[phase])}
    </Badge>
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
        <span aria-hidden="true">{count}</span>
        <span className="sr-only">{label}</span>
      </span>
    </Row>
  );
}

export function ValidationReportDialog({
  scope,
  phase,
  open,
  diagnostics,
  modByPackageId,
  commands,
  onOpenChange,
  onClosed,
}: {
  scope: OrderDiagnosticScope | null;
  phase: OrderValidation['phase'];
  open: boolean;
  diagnostics: DiagnosticItem[];
  modByPackageId: Map<string, ModMetadataDto>;
  commands: DiagnosticActions;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
}) {
  const { t } = useTranslation();
  const titleRef = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[46rem] gap-3 overflow-hidden p-4"
        {...(scope ? {} : { 'aria-describedby': undefined })}
        onOpenAutoFocus={(event) => {
          if (!titleRef.current) return;
          event.preventDefault();
          titleRef.current.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
      >
        <DialogHeader className="min-h-7 justify-center pr-9">
          <DialogTitle ref={titleRef} tabIndex={-1} className="outline-hidden">
            {t('order.validation.summaryTitle')}
          </DialogTitle>
          {scope && <DiagnosticScopeDescription scope={scope} />}
        </DialogHeader>
        {phase !== 'ready' && <ValidationPhaseBadge phase={phase} />}
        <div className="max-h-[70vh] min-h-0 overflow-y-auto">
          <DiagnosticReport
            diagnostics={diagnostics}
            modByPackageId={modByPackageId}
            commands={commands}
            subjectPackageId={scope?.kind === 'mod' ? scope.identities[0].packageId : undefined}
            showClean={phase === 'ready'}
            allowSelection
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DiagnosticScopeDescription({ scope }: { scope: OrderDiagnosticScope }) {
  const { t } = useTranslation();
  let label: string;
  switch (scope.kind) {
    case 'mod':
      label = t('order.validation.scopeMod', { name: scope.name });
      break;
    case 'selection':
      label = t('order.validation.scopeMods', { count: scope.identities.length });
      break;
    case 'group':
      label = t('order.validation.scopeGroup', {
        name: scope.name,
        count: scope.identities.length,
      });
      break;
  }
  return <DialogDescription className="break-words">{label}</DialogDescription>;
}
