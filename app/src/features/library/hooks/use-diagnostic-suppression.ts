import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { DiagnosticSuppressionDto } from '@/commands';
import { addSuppressions, removeSuppressions } from '@/domain/diagnostics/suppression';
import { useLibrary, useUpdateLibrarySettings } from '@/queries/library';

const EMPTY_RULES: DiagnosticSuppressionDto[] = [];

export function useDiagnosticSuppression() {
  const { data } = useLibrary();
  const actions = useDiagnosticSuppressionActions(data != null);
  return { ...actions, rules: data?.settings.diagnosticSuppressions ?? EMPTY_RULES };
}

export function useDiagnosticSuppressionActions(ready: boolean) {
  const { t } = useTranslation();
  const { mutateAsync, isPending } = useUpdateLibrarySettings();
  const change = useCallback(
    async (items: DiagnosticSuppressionDto[], restore: boolean) => {
      if (items.length === 0) return;
      await mutateAsync((current) => ({
        ...current,
        diagnosticSuppressions: restore
          ? removeSuppressions(
              current.diagnosticSuppressions ?? [],
              items.map((item) => item.key),
            )
          : addSuppressions(current.diagnosticSuppressions ?? [], items),
      }));
      toast.success(
        t(restore ? 'suppression.restored' : 'suppression.saved', { count: items.length }),
      );
    },
    [mutateAsync, t],
  );
  return useMemo(
    () => ({
      pending: isPending,
      ready,
      suppress: (items: DiagnosticSuppressionDto[]) =>
        change(items, false).then(
          () => true,
          () => false,
        ),
      restore: (items: DiagnosticSuppressionDto[]) =>
        change(items, true).then(
          () => true,
          () => false,
        ),
    }),
    [change, isPending, ready],
  );
}
