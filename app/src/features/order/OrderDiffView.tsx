import { useTranslation } from 'react-i18next';
import type { ModMetadataDto } from '@/commands';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  buildUnifiedDiff,
  buildUnifiedDiffHunks,
  type OrderDiff,
  type OrderDiffItem,
  type UnifiedDiffRow,
  type UnifiedDiffSegment,
} from '@/features/order/model';
import { displayModName } from '@/lib/officialContent';
import { formatPackageLabel } from '@/lib/diagnosticMessages';

const DIFF_CONTEXT = 3;

type ModByPackageId = Map<string, ModMetadataDto>;

export function OrderDiffBody({
  diff,
  modByPackageId,
}: {
  diff: OrderDiff;
  modByPackageId: ModByPackageId;
}) {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="unified">
      <TabsList className="mb-2">
        <TabsTrigger value="unified">{t('order.diff.viewUnified')}</TabsTrigger>
        <TabsTrigger value="byChange">{t('order.diff.viewByChange')}</TabsTrigger>
      </TabsList>
      <TabsContent value="unified">
        <UnifiedDiffView diff={diff} modByPackageId={modByPackageId} />
      </TabsContent>
      <TabsContent value="byChange">
        <DiffList items={diff.items} modByPackageId={modByPackageId} />
      </TabsContent>
    </Tabs>
  );
}

function DiffList({
  items,
  modByPackageId,
}: {
  items: OrderDiffItem[];
  modByPackageId: ModByPackageId;
}) {
  const { t } = useTranslation();
  return (
    <div className="max-h-[60vh] overflow-auto border border-border text-xs">
      {items.map((item, index) => (
        <div
          key={`${item.kind}:${index}`}
          className="border-b border-border px-2 py-1 last:border-b-0"
        >
          {formatDiffItem(item, t, modByPackageId)}
        </div>
      ))}
    </div>
  );
}

const STRUCTURAL_KINDS = new Set<OrderDiffItem['kind']>([
  'groupSplit',
  'separatorMoved',
  'missingSkipped',
]);

function isStructuralEvent(item: OrderDiffItem): boolean {
  return STRUCTURAL_KINDS.has(item.kind);
}

function UnifiedDiffView({
  diff,
  modByPackageId,
}: {
  diff: OrderDiff;
  modByPackageId: ModByPackageId;
}) {
  const { t } = useTranslation();

  if (diff.items.length === 1 && diff.items[0].kind === 'noChange') {
    return (
      <div className="max-h-[60vh] overflow-auto border border-border px-2 py-1 text-xs text-muted-foreground">
        {t('order.diff.noChange')}
      </div>
    );
  }

  const rows = buildUnifiedDiff(diff.before, diff.after);
  const segments = buildUnifiedDiffHunks(rows, DIFF_CONTEXT);
  const structuralEvents = diff.items.filter(isStructuralEvent);

  return (
    <div className="space-y-2">
      <div className="max-h-[60vh] overflow-auto border border-border font-mono text-xs">
        {segments.map((segment, index) => (
          <UnifiedDiffSegmentView
            key={index}
            segment={segment}
            modByPackageId={modByPackageId}
            t={t}
          />
        ))}
      </div>
      {structuralEvents.length > 0 ? (
        <div className="border border-border p-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            {t('order.diff.structuralEvents')}
          </div>
          <ul className="space-y-1 text-xs">
            {structuralEvents.map((item, index) => (
              <li key={`${item.kind}:${index}`}>{formatDiffItem(item, t, modByPackageId)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function UnifiedDiffSegmentView({
  segment,
  modByPackageId,
  t,
}: {
  segment: UnifiedDiffSegment;
  modByPackageId: ModByPackageId;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  if (segment.type === 'skip') {
    return (
      <div className="border-b border-border bg-muted/40 px-2 py-0.5 text-center text-[10px] italic text-muted-foreground last:border-b-0">
        {t('order.diff.hiddenLines', { count: segment.hiddenCount })}
      </div>
    );
  }
  return (
    <>
      {segment.rows.map((row, index) => (
        <UnifiedDiffRowView key={index} row={row} modByPackageId={modByPackageId} t={t} />
      ))}
    </>
  );
}

function UnifiedDiffRowView({
  row,
  modByPackageId,
  t,
}: {
  row: UnifiedDiffRow;
  modByPackageId: ModByPackageId;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const mod = modByPackageId.get(row.packageId);
  const name = displayModName({ packageId: row.packageId, name: mod?.name ?? null });
  const showId = name !== row.packageId;
  const title = showId ? formatPackageLabel(row.packageId, modByPackageId) : undefined;

  switch (row.type) {
    case 'context':
      return (
        <div
          className="border-b border-border px-2 py-0.5 leading-5 text-muted-foreground last:border-b-0"
          title={title}
        >
          <span className="inline-block w-4 select-none"> </span>
          <span>{name}</span>
          {showId ? <PackageIdMuted packageId={row.packageId} /> : null}
        </div>
      );
    case 'added':
      return (
        <div
          className="border-b border-border bg-green-600/10 px-2 py-0.5 leading-5 text-green-700 last:border-b-0 dark:text-green-400"
          title={title}
        >
          <span className="inline-block w-4 select-none">+</span>
          <span>{name}</span>
          {showId ? <PackageIdMuted packageId={row.packageId} /> : null}
        </div>
      );
    case 'removed':
      return (
        <div
          className="border-b border-border bg-destructive/10 px-2 py-0.5 leading-5 text-destructive last:border-b-0"
          title={title}
        >
          <span className="inline-block w-4 select-none">-</span>
          <span>{name}</span>
          {showId ? <PackageIdMuted packageId={row.packageId} /> : null}
        </div>
      );
    case 'moved':
      return (
        <div
          className="border-b border-border bg-amber-600/10 px-2 py-0.5 leading-5 text-amber-600 last:border-b-0 dark:text-amber-400"
          title={
            title ??
            t('order.diff.movedInline', {
              packageId: row.packageId,
              from: row.fromIndex + 1,
              to: row.toIndex + 1,
            })
          }
        >
          <span className="inline-block w-4 select-none">~</span>
          <span>{name}</span>
          {showId ? <PackageIdMuted packageId={row.packageId} /> : null}
          <span className="ml-2 text-muted-foreground">
            #{row.fromIndex + 1} → #{row.toIndex + 1}
          </span>
        </div>
      );
  }
}

function PackageIdMuted({ packageId }: { packageId: string }) {
  return <span className="ml-2 text-muted-foreground/70">{packageId}</span>;
}

function formatDiffItem(
  item: OrderDiffItem,
  t: ReturnType<typeof useTranslation>['t'],
  modByPackageId: ModByPackageId,
): string {
  const labelFor = (packageId: string): string => formatPackageLabel(packageId, modByPackageId);
  switch (item.kind) {
    case 'added':
      return t('order.diff.added', {
        packageId: labelFor(item.packageId),
        index: item.toIndex + 1,
      });
    case 'removed':
      return t('order.diff.removed', {
        packageId: labelFor(item.packageId),
        index: item.fromIndex + 1,
      });
    case 'moved':
      return t('order.diff.moved', {
        packageId: labelFor(item.packageId),
        from: item.fromIndex + 1,
        to: item.toIndex + 1,
      });
    case 'groupSplit':
      return t('order.diff.groupSplit', {
        groupName: item.groupName,
        packageIds: item.packageIds.map(labelFor).join(', '),
      });
    case 'separatorMoved':
      return t('order.diff.separatorMoved', { title: item.title });
    case 'missingSkipped':
      return t('order.diff.missingSkipped', {
        packageId: labelFor(item.packageId),
        label: item.label,
      });
    case 'noChange':
      return t('order.diff.noChange');
  }
}
