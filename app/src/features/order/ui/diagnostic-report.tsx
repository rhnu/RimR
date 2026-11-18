import { ChevronRight } from 'lucide-react';
import { useId, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiagnosticDto, DiagnosticSuppressionDto, ModMetadataDto } from '@/commands';
import { Button } from '@/components/ui/button';
import { Col, Grid, Row } from '@/components/ui/layout';
import { isSuppressed, uniqueDiagnostics } from '@/domain/diagnostics/suppression';
import {
  formatDiagnosticLocation,
  formatDiagnosticMessage,
  formatPackageLabel,
} from '@/domain/diagnostics/messages';
import { normalizePackageId } from '@/domain/mods/identity';
import { useDiagnosticSuppression } from '@/features/library/hooks/use-diagnostic-suppression';
import { SeverityIcon } from './severity-icon';

const severities = ['error', 'warning', 'info'] as const;

/** Shows the same diagnostic groups and suppression actions in either report view. */
export function DiagnosticReport({
  diagnostics,
  modByPackageId,
  showClean = false,
}: {
  diagnostics: DiagnosticDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  showClean?: boolean;
}) {
  const { t } = useTranslation();
  const commands = useDiagnosticSuppression();
  const { reportRef, rememberAction } = useDiagnosticActionFocus(commands.pending);
  const active: DiagnosticDto[] = [];
  const ignored: DiagnosticDto[] = [];
  for (const diagnostic of uniqueDiagnostics(diagnostics)) {
    (isSuppressed(diagnostic, commands.rules) ? ignored : active).push(diagnostic);
  }

  function renderGroups(items: DiagnosticDto[], suppressed: boolean) {
    return severities.map((severity) => {
      const group = items.filter((item) => item.severity === severity);
      if (group.length === 0) return null;
      return (
        <section key={severity}>
          <Row
            asChild
            gap={1.5}
            className="min-h-8 border-b border-border bg-muted px-2 text-xs font-semibold"
          >
            <h3>
              <SeverityIcon severity={severity} />
              <span className="capitalize">{t(`severity.${severity}`)}</span>
              <span className="tabular-nums">{group.length}</span>
            </h3>
          </Row>
          <ul className="divide-y divide-border border-b border-border">
            {group.map((diagnostic, index) => (
              <DiagnosticRow
                key={diagnostic.suppression?.key ?? index}
                diagnostic={diagnostic}
                modByPackageId={modByPackageId}
                suppressed={suppressed}
                pending={commands.pending}
                ready={commands.ready}
                onAction={(descriptor, button) => {
                  if (commands.pending || !commands.ready) return;
                  rememberAction(button);
                  const update = suppressed ? commands.restore : commands.suppress;
                  update([descriptor]);
                }}
              />
            ))}
          </ul>
        </section>
      );
    });
  }

  return (
    <Col ref={reportRef} className="min-w-0" tabIndex={-1}>
      {showClean && active.length === 0 && ignored.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">{t('order.validation.clean')}</p>
      ) : null}
      {renderGroups(active, false)}
      {ignored.length > 0 ? (
        <details className="group">
          <Row
            asChild
            gap={1.5}
            className="min-h-8 cursor-pointer border-y border-border bg-muted px-2 text-xs font-semibold hover:bg-accent focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"
          >
            <summary>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 group-open:rotate-90" />
              {t('suppression.ignoredCount', { count: ignored.length })}
            </summary>
          </Row>
          <Col className="mt-2">{renderGroups(ignored, true)}</Col>
        </details>
      ) : null}
    </Col>
  );
}

function DiagnosticRow({
  diagnostic,
  modByPackageId,
  suppressed,
  pending,
  ready,
  onAction,
}: {
  diagnostic: DiagnosticDto;
  modByPackageId: Map<string, ModMetadataDto>;
  suppressed: boolean;
  pending: boolean;
  ready: boolean;
  onAction: (descriptor: DiagnosticSuppressionDto, button: HTMLButtonElement) => void;
}) {
  const { t, i18n } = useTranslation();
  const messageId = useId();
  const message = formatDiagnosticMessage(diagnostic, t, modByPackageId);
  const location = formatDiagnosticLocation(diagnostic);
  const descriptor = diagnostic.suppression;
  const translated = i18n.exists(`diagnostics.${diagnostic.code}`);
  const ruleVersion = translated && diagnostic.params.gameVersion ? null : descriptor?.gameVersion;
  const displayedPackages = translated ? messagePackageIds(diagnostic.params) : new Set<string>();
  const otherPackages = [...new Set(diagnostic.relatedPackages)]
    .filter((id) => !displayedPackages.has(normalizePackageId(id)))
    .map((id) => formatPackageLabel(id, modByPackageId));

  return (
    <Grid
      asChild
      gap={1}
      className="grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-2 py-2 text-sm wrap-anywhere"
    >
      <li>
        <h4 className="font-semibold">
          {t(`suppression.types.${diagnostic.code}`, { defaultValue: diagnostic.code })}
        </h4>
        {descriptor ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 aria-disabled:opacity-50"
            disabled={!ready}
            aria-disabled={pending || undefined}
            aria-describedby={messageId}
            data-diagnostic-key={descriptor.key}
            data-ignored={suppressed || undefined}
            onClick={(event) => onAction(descriptor, event.currentTarget)}
          >
            {t(suppressed ? 'suppression.restore' : 'suppression.suppress')}
          </Button>
        ) : null}
        <Col gap={1} className="col-span-2">
          <p id={messageId}>{message}</p>
          {location && !message.includes(location) ? (
            <p className="font-mono text-xs text-muted-foreground">{location}</p>
          ) : null}
          {otherPackages.length > 0 ? (
            <p className="text-xs text-muted-foreground">{otherPackages.join(', ')}</p>
          ) : null}
          {ruleVersion ? (
            <p className="text-xs text-muted-foreground">
              {t('suppression.gameVersion', { version: ruleVersion })}
            </p>
          ) : null}
        </Col>
      </li>
    </Grid>
  );
}

/** Identifies packages already interpolated into the translated diagnostic message. */
function messagePackageIds(params: DiagnosticDto['params']): Set<string> {
  const packages = params.cycle?.split(' -> ') ?? [];
  for (const [key, value] of Object.entries(params)) {
    if (key.toLowerCase().endsWith('packageid')) packages.push(value);
  }
  return new Set(packages.map(normalizePackageId));
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
    const nextRestoreTarget = action.hasAttribute('data-ignored')
      ? (report.querySelector<HTMLButtonElement>('details[open] button:enabled') ??
        [...activeActions].find(
          (button) => button.dataset.diagnosticKey === action.dataset.diagnosticKey,
        ))
      : null;
    const target =
      nextRestoreTarget ?? activeActions[0] ?? report.querySelector('summary') ?? report;
    target.focus();
  });

  function rememberAction(button: HTMLButtonElement) {
    focusedAction.current = button.ownerDocument.activeElement === button ? button : null;
  }

  return { reportRef, rememberAction };
}
