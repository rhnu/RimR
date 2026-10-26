import { useTranslation } from 'react-i18next';
import type {
  DiagnosticDto,
  ModIdentityDto,
  ModMetadataDto,
  ModListDto,
  TagDefDto,
} from '@/commands';
import { Collapsible } from '@/components/ui/collapsible';
import { SteamBbcode } from '@/components/ui/steam-bbcode';
import { Skeleton } from '@/components/ui/skeleton';
import { formatFileSize } from '@/features/order/model';
import {
  formatDiagnosticLocation,
  formatDiagnosticMessage,
  formatPackageLabel,
} from '@/lib/diagnosticMessages';
import { Meta } from './MetaRow';
import { TagsMeta } from './TagsMeta';

export function EmptyMetadata() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
      {t('order.metadata.empty')}
    </div>
  );
}

export function SelectedModMetadata({
  identity,
  mod,
  previewLoading,
  previewDataUrl,
  folderSizeBytes,
  diagnostics,
  modByPackageId,
  tags,
}: {
  identity: ModIdentityDto;
  mod: ModMetadataDto | null | undefined;
  previewLoading: boolean;
  previewDataUrl: string | undefined;
  folderSizeBytes: number | null | undefined;
  diagnostics: DiagnosticDto[];
  modByPackageId: Map<string, ModMetadataDto>;
  tags: TagDefDto[];
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <PreviewImage loading={previewLoading} dataUrl={previewDataUrl} />
      <ModIdentityMeta identity={identity} mod={mod} />
      <TagsMeta label={t('order.context.tags')} tags={tags} />
      {mod?.description ? <SteamBbcode>{mod.description}</SteamBbcode> : null}
      <Collapsible title={t('modDetails.sections.fileInfo')} defaultOpen={false}>
        <Meta label={t('order.metadata.folderSize')} value={formatFileSize(folderSizeBytes)} />
        <Meta label={t('order.metadata.modifiedAt')} value={formatTimestamp(mod?.modifiedAtMs)} />
        <Meta label={t('order.inspector.sourceKey')} value={identity.sourceKey ?? '-'} mono />
      </Collapsible>
      {mod ? <RulesMetadata mod={mod} /> : null}
      {diagnostics.length > 0 ? (
        <DiagnosticList diagnostics={diagnostics} modByPackageId={modByPackageId} />
      ) : null}
    </div>
  );
}

function PreviewImage({ loading, dataUrl }: { loading: boolean; dataUrl: string | undefined }) {
  if (loading) return <Skeleton className="aspect-video w-full border" />;
  return dataUrl ? (
    <img src={dataUrl} alt="" className="aspect-video w-full border object-cover" />
  ) : null;
}

function ModIdentityMeta({
  identity,
  mod,
}: {
  identity: ModIdentityDto;
  mod: ModMetadataDto | null | undefined;
}) {
  const { t } = useTranslation();
  return (
    <section className="space-y-2">
      <Meta label={t('order.inspector.packageId')} value={identity.packageId} mono />
      <Meta label={t('modDetails.sections.authors')} value={mod?.authors.join(', ') || '-'} />
      <Meta label={t('modDetails.fields.modVersion')} value={mod?.modVersion ?? '-'} />
      <Meta
        label={t('modDetails.sections.supportedVersions')}
        value={mod?.supportedVersions.join(', ') || '-'}
      />
      <Meta label={t('order.metadata.path')} value={mod?.path ?? identity.sourceKey ?? '-'} mono />
    </section>
  );
}

function RulesMetadata({ mod }: { mod: ModMetadataDto }) {
  const { t } = useTranslation();
  return (
    <Collapsible title={t('modDetails.sections.rules')} defaultOpen={false}>
      <RuleMeta label={t('modDetails.rules.loadAfter')} values={mod.rules.loadAfter} />
      <RuleMeta label={t('modDetails.rules.loadBefore')} values={mod.rules.loadBefore} />
      <RuleMeta label={t('modDetails.rules.forceLoadAfter')} values={mod.rules.forceLoadAfter} />
      <RuleMeta label={t('modDetails.rules.forceLoadBefore')} values={mod.rules.forceLoadBefore} />
      <RuleMeta
        label={t('modDetails.rules.incompatibleWith')}
        values={mod.rules.incompatibleWith}
      />
      <RuleMeta
        label={t('modDetails.rules.dependencies')}
        values={mod.rules.modDependencies.map((dependency) => dependency.packageId)}
      />
    </Collapsible>
  );
}

export function SelectedGroupMetadata({
  entryCount,
  diagnostics,
  modByPackageId,
}: {
  entryCount: number;
  diagnostics: DiagnosticDto[];
  modByPackageId: Map<string, ModMetadataDto>;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <Meta label={t('order.inspector.groupEntries')} value={String(entryCount)} />
      {diagnostics.length > 0 ? (
        <DiagnosticList diagnostics={diagnostics} modByPackageId={modByPackageId} />
      ) : null}
    </div>
  );
}

export function SelectedSeparatorMetadata({ id, note }: { id: string; note: string | null }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <Meta label={t('order.inspector.separatorId')} value={id} mono />
      {note ? <Meta label={t('order.inspector.note')} value={note} /> : null}
    </div>
  );
}

export function DiagnosticList({
  diagnostics,
  modByPackageId,
}: {
  diagnostics: DiagnosticDto[];
  modByPackageId: Map<string, ModMetadataDto>;
}) {
  const { t } = useTranslation();
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground select-none">
        {t('order.metadata.diagnostics')}
      </h3>
      <ul className="space-y-1">
        {diagnostics.map((diagnostic, index) => (
          <li key={`${diagnostic.code}-${index}`} className="border px-2 py-1.5 text-xs">
            <span className="font-medium">{t(`severity.${diagnostic.severity}`)}: </span>
            {formatDiagnosticMessage(diagnostic, t, modByPackageId)}
            {formatDiagnosticLocation(diagnostic) ? (
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {formatDiagnosticLocation(diagnostic)}
              </p>
            ) : null}
            {diagnostic.relatedPackages.length > 0 ? (
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {diagnostic.relatedPackages
                  .map((pkg) => formatPackageLabel(pkg, modByPackageId))
                  .join(', ')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RuleMeta({ label, values }: { label: string; values: string[] }) {
  return <Meta label={label} value={values.length ? values.join(', ') : '-'} mono />;
}

function formatTimestamp(value: number | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

export function selectionDiagnostics(
  identity: ModIdentityDto | null,
  entry: ModListDto['entries'][number] | null | undefined,
  diagnosticsByPackage: Map<string, DiagnosticDto[]>,
): DiagnosticDto[] {
  if (identity) return diagnosticsByPackage.get(identity.packageId) ?? [];
  if (entry?.kind !== 'group') return [];
  return entry.entries.flatMap((child) => diagnosticsByPackage.get(child.identity.packageId) ?? []);
}
