import { useState, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { DiagnosticDto, ModMetadataDto } from '@/commands';
import { ValidationDiagnosticList } from '@/features/order/ValidationDiagnosticList';

export function PageMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function DroppablePanel({
  id,
  title,
  count,
  actions,
  children,
}: {
  id: string;
  title: string;
  count: number;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex min-h-0 flex-col rounded-slight border border-border bg-background',
        isOver && 'border-primary',
      )}
    >
      <div className="flex h-9 select-none items-center gap-2 border-b border-border px-2">
        <h2 className="text-xs font-semibold text-muted-foreground">{title}</h2>
        <Badge variant="secondary" className="text-xs">
          {count}
        </Badge>
        <div className="flex-1" />
        {actions}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
    </section>
  );
}

export function ValidationSummaryBadge({
  summary,
  validating,
  diagnostics = [],
  modByPackageId,
}: {
  summary: { errors: number; warnings: number; infos: number; isClean: boolean };
  validating: boolean;
  diagnostics?: DiagnosticDto[];
  modByPackageId: Map<string, ModMetadataDto>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (validating) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="size-3 animate-spin" />
        {t('order.validation.checking')}
      </Badge>
    );
  }
  if (summary.isClean) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
      >
        <CheckCircle2 className="size-3" />
        {t('order.validation.clean')}
      </Badge>
    );
  }
  const badgeContent = (
    <>
      {summary.errors > 0 ? (
        <Badge variant="destructive">
          {t('order.validation.errors', { count: summary.errors })}
        </Badge>
      ) : null}
      {summary.warnings > 0 ? (
        <Badge
          variant="outline"
          className="border-yellow-500/30 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
        >
          {t('order.validation.warnings', { count: summary.warnings })}
        </Badge>
      ) : null}
      {summary.infos > 0 ? (
        <Badge variant="secondary">{t('order.validation.infos', { count: summary.infos })}</Badge>
      ) : null}
    </>
  );
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto gap-1 p-0 hover:bg-transparent"
        onClick={() => setOpen(true)}
        aria-label={t('order.validation.summaryTitle')}
        title={t('order.validation.summaryTitle')}
      >
        {badgeContent}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('order.validation.summaryTitle')}</DialogTitle>
          </DialogHeader>
          <ValidationDiagnosticList diagnostics={diagnostics} modByPackageId={modByPackageId} />
        </DialogContent>
      </Dialog>
    </>
  );
}
