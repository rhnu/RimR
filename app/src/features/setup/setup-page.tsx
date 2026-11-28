import { useEffect, useId, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Loader2, ScanLine } from 'lucide-react';
import type { CatalogSnapshotDto, DiagnosticDto, ModMetadataDto } from '@/commands';
import { Splash } from '@/components/splash';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Col, Row } from '@/components/ui/layout';
import { presentDiagnostic } from '@/domain/diagnostics/messages';
import { primaryModsByPackageId } from '@/domain/mods/catalog';
import { needsSetup } from '@/domain/workspace/config';
import { canScanConfig } from '@/domain/workspace/path-settings';
import { DiagnosticDetails } from '@/features/diagnostics/diagnostic-details';
import { SeverityIcon } from '@/features/diagnostics/severity-icon';
import { PathSettingsForm } from '@/features/settings/path-settings-form';
import { usePathSettings } from '@/features/settings/path-settings-provider';
import { useCatalogSnapshot } from '@/queries/catalog';

const scanCountLabels = {
  error: 'setup.errors',
  warning: 'setup.warnings',
  info: 'setup.info',
} as const;

export function SetupPage() {
  const { t } = useTranslation();
  const { config: configQuery } = usePathSettings();
  const scan = useCatalogSnapshot();
  const navigate = useNavigate();

  useEffect(() => {
    if (configQuery.data && !needsSetup(configQuery.data)) {
      void navigate({ to: '/settings', replace: true });
    }
  }, [configQuery.data, navigate]);

  if (configQuery.isLoading) {
    return <Splash message={t('setup.loadingConfig')} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t('setup.pathsTitle')}</CardTitle>
        </CardHeader>
        <PathSettingsForm allowClear={false} saveLabel={t('setup.saveConfig')} />
      </Card>

      <SetupScanCard
        report={scan.data}
        loading={scan.isFetching}
        failed={scan.isError}
        canScan={canScanConfig(configQuery.data)}
        onScan={() => void scan.refetch()}
      />
    </div>
  );
}

function SetupScanCard({
  report,
  loading,
  failed,
  canScan,
  onScan,
}: {
  report: CatalogSnapshotDto | undefined;
  loading: boolean;
  failed: boolean;
  canScan: boolean;
  onScan: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{t('setup.scanTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row wrap>
          <Button
            type="button"
            size="sm"
            onClick={onScan}
            disabled={!canScan || loading}
            aria-busy={loading}
          >
            {loading ? (
              <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />
            ) : (
              <ScanLine aria-hidden="true" className="size-4" />
            )}
            {t(loading ? 'catalog.loading' : 'setup.scan')}
          </Button>
          {!canScan ? (
            <span className="text-xs text-muted-foreground">{t('setup.scanHint')}</span>
          ) : null}
        </Row>
        <ScanResult report={report} loading={loading} failed={failed} />
      </CardContent>
    </Card>
  );
}

function ScanResult({
  report,
  loading,
  failed,
}: {
  report: CatalogSnapshotDto | undefined;
  loading: boolean;
  failed: boolean;
}) {
  const { t } = useTranslation();
  const modByPackageId = useMemo(
    () => primaryModsByPackageId(report?.catalog.mods ?? []),
    [report],
  );
  if (failed && !loading) {
    return (
      <Row gap={1.5} role="alert" className="text-xs text-destructive">
        <SeverityIcon severity="error" />
        {t('setup.scanFailed')}
      </Row>
    );
  }
  if (report) {
    return (
      <Col aria-busy={loading}>
        <ScanSummary report={report} />
        {report.diagnostics.length > 0 ? (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto border border-border">
            {report.diagnostics.map((diagnostic, index) => (
              <DiagnosticRow
                key={`${diagnostic.code}-${index}`}
                diagnostic={diagnostic}
                modByPackageId={modByPackageId}
              />
            ))}
          </ul>
        ) : null}
      </Col>
    );
  }
  return loading ? null : <p className="text-sm text-muted-foreground">{t('setup.noScanYet')}</p>;
}

function ScanSummary({ report }: { report: CatalogSnapshotDto }) {
  const { t } = useTranslation();
  const counts = { error: 0, warning: 0, info: 0 };
  for (const diagnostic of report.diagnostics) counts[diagnostic.severity] += 1;
  const duplicates = report.catalog.duplicatePackageIds.length;
  return (
    <Row asChild wrap className="text-xs text-muted-foreground">
      <output>
        <span>{t('setup.scanned', { count: report.catalog.mods.length })}</span>
        {duplicates > 0 ? <span>{t('setup.duplicates', { count: duplicates })}</span> : null}
        {(['error', 'warning', 'info'] as const).map((severity) =>
          counts[severity] > 0 ? (
            <Row asChild gap={1} key={severity}>
              <span>
                <SeverityIcon severity={severity} />
                {t(scanCountLabels[severity], { count: counts[severity] })}
              </span>
            </Row>
          ) : null,
        )}
        {report.diagnostics.length === 0 ? <span>{t('setup.noDiagnostics')}</span> : null}
      </output>
    </Row>
  );
}

function DiagnosticRow({
  diagnostic,
  modByPackageId,
}: {
  diagnostic: DiagnosticDto;
  modByPackageId: ReadonlyMap<string, ModMetadataDto>;
}) {
  const { t } = useTranslation();
  const messageId = useId();
  const { subject, summary, details } = presentDiagnostic(diagnostic, t, modByPackageId);
  return (
    <Row asChild className="min-h-8 px-2 py-0.5 text-xs">
      <li>
        <SeverityIcon severity={diagnostic.severity} />
        <span className="sr-only">{t(`severity.${diagnostic.severity}`)}</span>
        <p id={messageId} className="min-w-0 flex-1 wrap-anywhere">
          {subject ? <strong className="mr-1 font-medium">{subject.label} </strong> : null}
          {summary}
        </p>
        <DiagnosticDetails details={details} describedBy={messageId} />
      </li>
    </Row>
  );
}
