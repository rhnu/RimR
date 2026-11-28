import { useCallback, useMemo, useRef, useState, type ComponentProps } from 'react';
import { useDiagnosticSuppressionActions } from '@/features/library/hooks/use-diagnostic-suppression';
import type { OrderValidation } from '../hooks/use-order-validation';
import { createDiagnosticTargets, type OrderDiagnosticScope } from '../model/diagnostic-targets';
import { ValidationReportDialog, type ValidationSummaryBadge } from '../ui/validation-summary';
import type { OrderDerived } from './workspace-types';

type DiagnosticReportSession = {
  scope: OrderDiagnosticScope | null;
  trigger: HTMLElement | null;
  open: boolean;
};

/** Connect the toolbar and row menus to one report that projects the current diagnostics. */
export function useOrderDiagnosticReport(
  { diagnostics, modByPackageId }: Pick<OrderDerived, 'diagnostics' | 'modByPackageId'>,
  phase: OrderValidation['phase'],
) {
  const actions = useDiagnosticSuppressionActions(true);
  const targets = useMemo(
    () => createDiagnosticTargets(diagnostics, modByPackageId),
    [diagnostics, modByPackageId],
  );
  const [report, setReport] = useState<DiagnosticReportSession | null>(null);
  const summaryTrigger = useRef<HTMLButtonElement>(null);
  const open = useCallback((scope: OrderDiagnosticScope | null, trigger: HTMLElement | null) => {
    setReport({ scope, trigger, open: true });
  }, []);
  const summaryProps: ComponentProps<typeof ValidationSummaryBadge> = {
    phase,
    summary: diagnostics.validationSummary,
    ref: summaryTrigger,
    onOpen: (trigger) => open(null, trigger),
  };
  return {
    targets,
    actions,
    summaryProps,
    open,
    dialog: report && (
      <ValidationReportDialog
        scope={report.scope}
        phase={phase}
        open={report.open}
        diagnostics={report.scope ? targets.forScope(report.scope) : diagnostics.diagnostics}
        modByPackageId={modByPackageId}
        commands={actions}
        onOpenChange={(open) => setReport({ ...report, open })}
        onClosed={() => {
          const trigger = report.trigger?.isConnected ? report.trigger : summaryTrigger.current;
          trigger?.focus({ preventScroll: true });
          setReport(null);
        }}
      />
    ),
  };
}
