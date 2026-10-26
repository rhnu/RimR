import { useEffect, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Loader2, ScanLine } from 'lucide-react';
import { pickDirectory } from '@/commands';
import type { DiagnosticDto, CatalogSnapshotDto, ModMetadataDto, SeverityDto } from '@/commands';
import { Splash } from '@/components/Splash';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useAppConfig,
  useAutodetectPaths,
  useSaveAppConfig,
  useCatalogSnapshot,
} from '@/hooks/commands';
import {
  formatDiagnosticLocation,
  formatDiagnosticMessage,
  formatPackageLabel,
} from '@/lib/diagnosticMessages';
import { needsSetup } from '@/lib/appConfig';
import { PathSettingsForm } from '@/features/settings/PathSettingsForm';
import { useSettingsDraft } from '@/features/settings/hooks/useSettingsDraft';
import { canScanConfig, type PathFieldKey } from '@/features/settings/pathSettingsModel';

export function SetupPage() {
  const { t } = useTranslation();
  const configQuery = useAppConfig();
  const save = useSaveAppConfig();
  const autodetect = useAutodetectPaths();
  const scan = useCatalogSnapshot();
  const navigate = useNavigate();
  const settings = useSettingsDraft(configQuery.data);

  useEffect(() => {
    if (configQuery.data && !needsSetup(configQuery.data)) {
      void navigate({ to: '/settings', replace: true });
    }
  }, [configQuery.data, navigate]);

  async function choosePath(field: PathFieldKey, label: string): Promise<void> {
    const picked = await pickDirectory({
      title: t('dialog.selectField', { label }),
      defaultPath: settings.draft?.paths[field] ?? undefined,
    }).match(
      (path) => path,
      () => null,
    );
    if (picked !== null) settings.updatePath(field, picked);
  }

  if (configQuery.isLoading) {
    return <Splash message={t('setup.loadingConfig')} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t('setup.pathsTitle')}</CardTitle>
        </CardHeader>
        <PathSettingsForm
          draft={settings.draft}
          dirty={settings.isDirty}
          allowClear={false}
          saveLabel={t('setup.saveConfig')}
          savePending={save.isPending}
          autodetectPending={autodetect.isPending}
          onBrowse={(field, label) => void choosePath(field, label)}
          onReset={settings.reset}
          onSave={() => {
            if (settings.draft) save.mutate(settings.draft);
          }}
          onAutodetect={() => autodetect.mutate()}
        />
      </Card>

      <SetupScanCard
        report={scan.data}
        loading={scan.isFetching || scan.fetchStatus === 'fetching'}
        canScan={canScanConfig(configQuery.data)}
        onScan={() => void scan.refetch()}
      />
    </div>
  );
}

function SetupScanCard({
  report,
  loading,
  canScan,
  onScan,
}: {
  report: CatalogSnapshotDto | undefined;
  loading: boolean;
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
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onScan} disabled={!canScan || loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ScanLine className="size-4" />
            )}
            {t('setup.scan')}
          </Button>
          {!canScan ? (
            <span className="text-xs text-muted-foreground">{t('setup.scanHint')}</span>
          ) : null}
        </div>
        <ScanResult report={report} loading={loading} />
      </CardContent>
    </Card>
  );
}

function ScanResult({
  report,
  loading,
}: {
  report: CatalogSnapshotDto | undefined;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const modByPackageId = useMemo(
    () => new Map((report?.catalog.mods ?? []).map((mod) => [mod.packageId, mod])),
    [report],
  );
  if (report) {
    return (
      <div className="space-y-3">
        <ScanSummary report={report} />
        {report.diagnostics.length > 0 ? (
          <ScrollArea className="h-80 rounded-slight border border-border">
            <div className="space-y-2 p-3">
              {report.diagnostics.map((diagnostic, index) => (
                <DiagnosticRow
                  key={`${diagnostic.code}-${index}`}
                  diagnostic={diagnostic}
                  modByPackageId={modByPackageId}
                />
              ))}
            </div>
          </ScrollArea>
        ) : null}
      </div>
    );
  }
  return loading ? null : <p className="text-sm text-muted-foreground">{t('setup.noScanYet')}</p>;
}

function ScanSummary({ report }: { report: CatalogSnapshotDto }) {
  const { t } = useTranslation();
  const errors = report.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warnings = report.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'warning',
  ).length;
  const infos = report.diagnostics.filter((diagnostic) => diagnostic.severity === 'info').length;
  const duplicates = report.catalog.duplicatePackageIds.length;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="secondary">{report.catalog.mods.length}</Badge>
      {duplicates > 0 ? <WarningBadge>{duplicates}</WarningBadge> : null}
      {errors > 0 ? <Badge variant="destructive">{errors}</Badge> : null}
      {warnings > 0 ? <WarningBadge>{warnings}</WarningBadge> : null}
      {infos > 0 ? <Badge variant="secondary">{infos}</Badge> : null}
      {report.diagnostics.length === 0 ? <span>{t('setup.noDiagnostics')}</span> : null}
    </div>
  );
}

function DiagnosticRow({
  diagnostic,
  modByPackageId,
}: {
  diagnostic: DiagnosticDto;
  modByPackageId: Map<string, ModMetadataDto>;
}) {
  const { t } = useTranslation();
  const { variant, className } = severityStyle(diagnostic.severity);
  const location = formatDiagnosticLocation(diagnostic);
  return (
    <div className="flex flex-col gap-1 border border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={variant} className={className}>
          {t(`severity.${diagnostic.severity}`)}
        </Badge>
        <span className="font-mono text-xs text-muted-foreground">{diagnostic.code}</span>
        {location ? (
          <span className="font-mono text-xs text-muted-foreground">{location}</span>
        ) : null}
      </div>
      <p className="text-sm">{formatDiagnosticMessage(diagnostic, t, modByPackageId)}</p>
      {diagnostic.relatedPackages.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {diagnostic.relatedPackages
            .map((pkg) => formatPackageLabel(pkg, modByPackageId))
            .join(', ')}
        </p>
      ) : null}
    </div>
  );
}

function WarningBadge({ children }: { children: number }) {
  return (
    <Badge
      variant="outline"
      className="border-yellow-500/30 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
    >
      {children}
    </Badge>
  );
}

function severityStyle(severity: SeverityDto): {
  variant: 'destructive' | 'outline' | 'secondary';
  className?: string;
} {
  switch (severity) {
    case 'error':
      return { variant: 'destructive' };
    case 'warning':
      return {
        variant: 'outline',
        className: 'border-yellow-500/30 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
      };
    case 'info':
      return { variant: 'secondary' };
  }
}
