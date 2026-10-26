import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { DiagnosticSuppressionDto } from '@/commands';
import { addSuppressions, removeSuppressions } from '@/domain/diagnostics/suppression';
import { useLibrary, useUpdateLibrarySettings } from '@/queries/library';

export function useDiagnosticSuppression() {
  const { t } = useTranslation();
  const library = useLibrary();
  const mutation = useUpdateLibrarySettings();
  const rules = library.data?.settings.diagnosticSuppressions ?? [];
  async function change(items: DiagnosticSuppressionDto[], restore: boolean): Promise<void> {
    if (items.length === 0) return;
    await mutation.mutateAsync((current) => ({
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
  }
  return {
    rules,
    pending: mutation.isPending,
    ready: Boolean(library.data),
    suppress: (items: DiagnosticSuppressionDto[]) =>
      void change(items, false).catch(() => undefined),
    restore: (items: DiagnosticSuppressionDto[]) => void change(items, true).catch(() => undefined),
  };
}
