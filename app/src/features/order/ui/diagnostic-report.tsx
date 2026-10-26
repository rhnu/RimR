import { useTranslation } from 'react-i18next';
import type { DiagnosticDto, ModMetadataDto } from '@/commands';
import { Button } from '@/components/ui/button';
import { isSuppressed, uniqueDiagnostics } from '@/domain/diagnostics/suppression';
import {
  formatDiagnosticLocation,
  formatDiagnosticMessage,
  formatPackageLabel,
} from '@/domain/diagnostics/messages';
import { useDiagnosticSuppression } from '@/features/library/hooks/use-diagnostic-suppression';

/** Both report views consume the same raw diagnostics and shared settings. */
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
  const unique = uniqueDiagnostics(diagnostics);
  const active = unique.filter((item) => !isSuppressed(item, commands.rules));
  const suppressed = unique.filter((item) => isSuppressed(item, commands.rules));
  return (
    <div className="space-y-2">
      {showClean && active.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">
          {suppressed.length > 0
            ? t('suppression.noActionable', { count: suppressed.length })
            : t('order.validation.clean')}
        </p>
      ) : null}
      {(['error', 'warning', 'info'] as const).map((severity) => {
        const group = active.filter((item) => item.severity === severity);
        if (group.length === 0) return null;
        return (
          <section key={severity} className="space-y-1">
            <h3 className="text-xs font-semibold">
              {t(`severity.${severity}`)} ({group.length})
            </h3>
            <ul className="space-y-1">
              {group.map((diagnostic, index) => (
                <DiagnosticRow
                  key={diagnostic.suppression?.key ?? index}
                  diagnostic={diagnostic}
                  modByPackageId={modByPackageId}
                  suppressed={false}
                  disabled={commands.pending || !commands.ready}
                  onAction={() =>
                    diagnostic.suppression && commands.suppress([diagnostic.suppression])
                  }
                />
              ))}
            </ul>
          </section>
        );
      })}
      {suppressed.length > 0 ? (
        <details className="border border-border p-2">
          <summary className="cursor-pointer text-xs font-medium">
            {t('suppression.ignoredCount', { count: suppressed.length })}
          </summary>
          <ul className="mt-2 space-y-1">
            {suppressed.map((diagnostic, index) => (
              <DiagnosticRow
                key={diagnostic.suppression?.key ?? index}
                diagnostic={diagnostic}
                modByPackageId={modByPackageId}
                suppressed
                disabled={commands.pending || !commands.ready}
                onAction={() =>
                  diagnostic.suppression && commands.restore([diagnostic.suppression])
                }
              />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function DiagnosticRow({
  diagnostic,
  modByPackageId,
  suppressed,
  disabled,
  onAction,
}: {
  diagnostic: DiagnosticDto;
  modByPackageId: Map<string, ModMetadataDto>;
  suppressed: boolean;
  disabled: boolean;
  onAction: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li className="space-y-1 border border-border px-2 py-1.5 text-xs">
      <p>{formatDiagnosticMessage(diagnostic, t, modByPackageId)}</p>
      {formatDiagnosticLocation(diagnostic) ? (
        <p className="break-all font-mono text-[10px] text-muted-foreground">
          {formatDiagnosticLocation(diagnostic)}
        </p>
      ) : null}
      {diagnostic.relatedPackages.length > 0 ? (
        <p className="break-words text-[10px] text-muted-foreground">
          {diagnostic.relatedPackages
            .map((pkg) => formatPackageLabel(pkg, modByPackageId))
            .join(', ')}
        </p>
      ) : null}
      {diagnostic.suppression ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2"
            disabled={disabled}
            onClick={onAction}
          >
            {t(suppressed ? 'suppression.restore' : 'suppression.suppress')}
          </Button>
          <span className="text-[10px] text-muted-foreground">
            {t('suppression.sharedScope')}
            {diagnostic.suppression.gameVersion ? ` · ${diagnostic.suppression.gameVersion}` : ''}
          </span>
        </div>
      ) : null}
    </li>
  );
}
