import { ChevronRight, EyeOff, RotateCcw } from 'lucide-react';
import { useId, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiagnosticDto, DiagnosticSuppressionDto, ModMetadataDto } from '@/commands';
import { Button } from '@/components/ui/button';
import { Col, Row } from '@/components/ui/layout';
import { presentDiagnostic } from '@/domain/diagnostics/messages';
import type { DiagnosticItem } from '@/domain/diagnostics/suppression';
import { normalizePackageId } from '@/domain/mods/identity';
import { DiagnosticDetails } from '@/features/diagnostics/diagnostic-details';
import { SeverityIcon } from '@/features/diagnostics/severity-icon';
import { DiagnosticBatchControls, useDiagnosticBatch } from './diagnostic-report-batch';

const severities = ['error', 'warning', 'info'] as const;

export type DiagnosticActions = {
  pending: boolean;
  ready: boolean;
  suppress: (items: DiagnosticSuppressionDto[]) => Promise<boolean>;
  restore: (items: DiagnosticSuppressionDto[]) => Promise<boolean>;
};

/** Shares compact report rows and per-diagnostic actions across report views. */
export function DiagnosticReport({
  diagnostics,
  modByPackageId,
  commands,
  subjectPackageId,
  allowSelection = false,
  showClean = false,
}: {
  diagnostics: DiagnosticItem[];
  modByPackageId: Map<string, ModMetadataDto>;
  commands: DiagnosticActions;
  subjectPackageId?: string;
  allowSelection?: boolean;
  showClean?: boolean;
}) {
  const { t } = useTranslation();
  const { reportRef, rememberAction } = useDiagnosticActionFocus(commands.pending);
  const active: DiagnosticDto[] = [];
  const ignored: DiagnosticDto[] = [];
  for (const { diagnostic, ignored: isIgnored } of diagnostics) {
    (isIgnored ? ignored : active).push(diagnostic);
  }
  const batch = useDiagnosticBatch(allowSelection ? active : [], commands);
  const groupProps = { modByPackageId, subjectPackageId, commands, rememberAction };

  return (
    <Col ref={reportRef} className="min-w-0" tabIndex={-1}>
      {allowSelection && batch.available ? <DiagnosticBatchControls batch={batch} /> : null}
      {showClean && !batch.editing && active.length === 0 && ignored.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">{t('order.validation.clean')}</p>
      ) : null}
      {batch.editing && batch.items.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">{t('suppression.noIgnorable')}</p>
      ) : null}
      <DiagnosticGroups
        {...groupProps}
        items={batch.editing ? batch.items : active}
        selection={batch.editing ? batch : undefined}
      />
      {ignored.length > 0 ? (
        <details className="group">
          <Row
            asChild
            gap={1.5}
            className="min-h-7 cursor-pointer border-y border-border bg-muted px-2 text-xs font-semibold hover:bg-accent focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"
          >
            <summary>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 group-open:rotate-90" />
              <EyeOff aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              {t('suppression.ignoredCount', { count: ignored.length })}
            </summary>
          </Row>
          <DiagnosticGroups {...groupProps} items={ignored} suppressed />
        </details>
      ) : null}
    </Col>
  );
}

function DiagnosticGroups({
  items,
  modByPackageId,
  subjectPackageId,
  commands,
  rememberAction,
  selection,
  suppressed = false,
}: {
  items: DiagnosticDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  subjectPackageId?: string;
  commands: DiagnosticActions;
  rememberAction: (button: HTMLButtonElement) => void;
  selection?: Pick<ReturnType<typeof useDiagnosticBatch>, 'selected' | 'toggleSelected'>;
  suppressed?: boolean;
}) {
  const { t } = useTranslation();
  function handleAction(descriptor: DiagnosticSuppressionDto, button: HTMLButtonElement) {
    if (commands.pending || !commands.ready) return;
    rememberAction(button);
    void (suppressed ? commands.restore : commands.suppress)([descriptor]);
  }

  return severities.map((severity) => {
    const group = items.filter((item) => item.severity === severity);
    if (group.length === 0) return null;

    return (
      <section key={severity}>
        <Row
          asChild
          gap={1.5}
          className="min-h-7 border-b border-border bg-muted px-2 text-xs font-semibold"
        >
          <h3>
            <SeverityIcon severity={severity} />
            <span>{t(`severity.${severity}`)}</span>
            <span className="tabular-nums">{group.length}</span>
          </h3>
        </Row>
        <ul className="divide-y divide-border border-b border-border">
          {group.map((diagnostic, index) => {
            const rule = diagnostic.suppression;
            return (
              <DiagnosticRow
                key={rule?.key ?? `${diagnostic.code}-${index}`}
                diagnostic={diagnostic}
                modByPackageId={modByPackageId}
                subjectPackageId={subjectPackageId}
                suppressed={suppressed}
                pending={commands.pending}
                ready={commands.ready}
                select={
                  selection && rule
                    ? {
                        checked: selection.selected.has(rule.key),
                        onToggle: () => selection.toggleSelected(rule.key),
                      }
                    : undefined
                }
                onAction={handleAction}
              />
            );
          })}
        </ul>
      </section>
    );
  });
}

function DiagnosticRow({
  diagnostic,
  modByPackageId,
  subjectPackageId,
  suppressed,
  pending,
  ready,
  select,
  onAction,
}: {
  diagnostic: DiagnosticDto;
  modByPackageId: Map<string, ModMetadataDto>;
  subjectPackageId?: string;
  suppressed: boolean;
  pending: boolean;
  ready: boolean;
  select?: { checked: boolean; onToggle: () => void };
  onAction: (descriptor: DiagnosticSuppressionDto, button: HTMLButtonElement) => void;
}) {
  const { t } = useTranslation();
  const messageId = useId();
  const { summary, subject, details } = presentDiagnostic(diagnostic, t, modByPackageId);
  const rule = diagnostic.suppression;
  const actionLabel = t(suppressed ? 'suppression.restoreOne' : 'suppression.ignoreOne');
  const ActionIcon = suppressed ? RotateCcw : EyeOff;
  const showSubject =
    subject && normalizePackageId(subject.packageId) !== normalizePackageId(subjectPackageId ?? '');

  return (
    <Row asChild gap={1.5} className="min-h-8 items-center px-2 py-0.5">
      <li>
        {select ? (
          <input
            type="checkbox"
            className="shrink-0 accent-primary"
            aria-label={t('suppression.selectDiagnostic')}
            aria-describedby={messageId}
            checked={select.checked}
            disabled={pending || !ready}
            onChange={select.onToggle}
          />
        ) : null}
        <p id={messageId} className="min-w-0 flex-1 text-xs leading-snug wrap-anywhere">
          {showSubject ? (
            <>
              <span className="mr-1 font-semibold">{subject.label}</span>{' '}
            </>
          ) : null}
          {summary}
        </p>
        <DiagnosticDetails details={details} describedBy={messageId} />
        {rule && !select ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 shrink-0 text-muted-foreground aria-disabled:opacity-50"
            disabled={!ready}
            aria-disabled={pending || undefined}
            aria-label={actionLabel}
            aria-describedby={messageId}
            title={actionLabel}
            data-diagnostic-key={rule.key}
            data-ignored={suppressed || undefined}
            onClick={(event) => onAction(rule, event.currentTarget)}
          >
            <ActionIcon aria-hidden="true" />
          </Button>
        ) : null}
      </li>
    </Row>
  );
}

/** Restores keyboard focus after an action moves its row to the other section. */
function useDiagnosticActionFocus(pending: boolean) {
  const reportRef = useRef<HTMLDivElement>(null);
  const focusedAction = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    const action = focusedAction.current;
    const report = reportRef.current;
    if (!action || !report || action.isConnected || pending) return;
    focusedAction.current = null;
    if (report.ownerDocument.activeElement !== report.ownerDocument.body) return;

    const activeActions = report.querySelectorAll<HTMLButtonElement>(
      'button[data-diagnostic-key]:not([data-ignored]):enabled',
    );
    const restored = action.hasAttribute('data-ignored')
      ? (report.querySelector<HTMLButtonElement>('details[open] button[data-ignored]:enabled') ??
        [...activeActions].find(
          (button) => button.dataset.diagnosticKey === action.dataset.diagnosticKey,
        ))
      : null;
    const target = restored ?? activeActions[0] ?? report.querySelector('summary') ?? report;
    target.focus();
  });

  function rememberAction(button: HTMLButtonElement) {
    focusedAction.current = button.ownerDocument.activeElement === button ? button : null;
  }

  return { reportRef, rememberAction };
}
