import { useTranslation } from 'react-i18next';
import type { DiagnosticDto, ModIdentityDto, ModMetadataDto, TagDefDto } from '@/commands';
import { Collapsible } from '@/components/ui/collapsible';
import { SteamBbcode } from '@/components/ui/steam-bbcode';
import { Skeleton } from '@/components/ui/skeleton';
import { Col } from '@/components/ui/layout';
import { formatFileSize } from '@/features/order/model';
import { DiagnosticReport } from '@/features/order/ui/diagnostic-report';
import { Meta } from '@/features/order/ui/meta-row';
import { TagsMeta } from '@/features/order/ui/tags-meta';

export function EmptyMetadata() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center p-2 text-xs text-muted-foreground">
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
    <Col gap={0} className="divide-y">
      <Col gap={1.5} className="p-2">
        <PreviewImage loading={previewLoading} dataUrl={previewDataUrl} />
        <ModIdentityMeta identity={identity} mod={mod} />
        {tags.length > 0 && <TagsMeta label={t('order.context.tags')} tags={tags} />}
      </Col>
      <Collapsible title={t('modDetails.sections.fileInfo')}>
        <Meta label={t('order.metadata.folderSize')} value={formatFileSize(folderSizeBytes)} />
        <Meta label={t('order.metadata.modifiedAt')} value={formatTimestamp(mod?.modifiedAtMs)} />
        <Meta label={t('order.inspector.sourceKey')} value={identity.sourceKey ?? '-'} mono />
      </Collapsible>
      {mod ? <RulesMetadata mod={mod} /> : null}
      {diagnostics.length > 0 ? (
        <DiagnosticList diagnostics={diagnostics} modByPackageId={modByPackageId} />
      ) : null}
      {mod?.description && (
        <Collapsible title={t('modDetails.sections.description')}>
          <SteamBbcode>{mod.description}</SteamBbcode>
        </Collapsible>
      )}
    </Col>
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
    <section className="space-y-1">
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
    <Collapsible title={t('modDetails.sections.rules')}>
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
    <Col gap={0} className="divide-y">
      <div className="p-2">
        <Meta label={t('order.inspector.groupEntries')} value={String(entryCount)} />
      </div>
      {diagnostics.length > 0 ? (
        <DiagnosticList diagnostics={diagnostics} modByPackageId={modByPackageId} />
      ) : null}
    </Col>
  );
}

export function SelectedSeparatorMetadata({ id, note }: { id: string; note: string | null }) {
  const { t } = useTranslation();
  return (
    <Col gap={1} className="p-2">
      <Meta label={t('order.inspector.separatorId')} value={id} mono />
      {note ? <Meta label={t('order.inspector.note')} value={note} /> : null}
    </Col>
  );
}

function DiagnosticList({
  diagnostics,
  modByPackageId,
}: {
  diagnostics: DiagnosticDto[];
  modByPackageId: Map<string, ModMetadataDto>;
}) {
  const { t } = useTranslation();
  return (
    <Collapsible title={t('order.metadata.diagnostics')} defaultOpen contentClassName="p-0">
      <DiagnosticReport diagnostics={diagnostics} modByPackageId={modByPackageId} />
    </Collapsible>
  );
}

function RuleMeta({ label, values }: { label: string; values: string[] }) {
  return <Meta label={label} value={values.length ? values.join(', ') : '-'} mono />;
}

function formatTimestamp(value: number | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}
