import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { ModCleanupKindDto, ModCleanupPreviewDto } from '@/commands';
import { useCleanMods, usePreviewModCleanup } from '@/hooks/modCleanupCommands';
import { cleanupSourceKeys, shouldOpenModCleanupDialog } from './toolsMenuModel';

export function useToolsMenuActions() {
  const { t } = useTranslation();
  const previewCleanup = usePreviewModCleanup();
  const cleanMods = useCleanMods();
  const [cleanupPreview, setCleanupPreview] = useState<ModCleanupPreviewDto | null>(null);

  async function preview(kind: ModCleanupKindDto): Promise<void> {
    const result = await previewCleanup.mutateAsync({ kind });
    if (!shouldOpenModCleanupDialog(result)) {
      toast.info(t('tools.toast.noCandidates'));
      return;
    }
    setCleanupPreview(result);
  }

  async function confirmCleanup(): Promise<void> {
    if (!cleanupPreview) return;
    const result = await cleanMods.mutateAsync({
      kind: cleanupPreview.kind,
      sourceKeys: cleanupSourceKeys(cleanupPreview),
    });
    setCleanupPreview(null);
    const toastFn = result.skipped.length > 0 ? toast.warning : toast.success;
    toastFn(
      t('tools.toast.cleaned', {
        cleaned: result.cleaned.length,
        skipped: result.skipped.length,
      }),
    );
  }

  return {
    cleanupPreview,
    isPending: previewCleanup.isPending || cleanMods.isPending,
    preview,
    confirmCleanup,
    closeCleanupDialog: () => setCleanupPreview(null),
  };
}
