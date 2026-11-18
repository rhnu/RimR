import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { ModCleanupKindDto, ModCleanupPreviewDto } from '@/commands';
import { useCleanMods, usePreviewModCleanup } from '@/queries/cleanup';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { cleanupSourceKeys, shouldOpenModCleanupDialog } from './tools-menu-model';

export function useToolsMenuActions() {
  const { t } = useTranslation();
  const previewCleanup = usePreviewModCleanup();
  const cleanMods = useCleanMods();
  const workspaceEpoch = useWorkspaceStore((state) => state.epoch);
  const [review, setReview] = useState<{ epoch: number; preview: ModCleanupPreviewDto } | null>(
    null,
  );
  const cleanupPreview = review?.epoch === workspaceEpoch ? review.preview : null;
  const isPending = previewCleanup.isPending || cleanMods.isPending;

  function preview(kind: ModCleanupKindDto): void {
    if (isPending) return;
    const epoch = useWorkspaceStore.getState().epoch;
    previewCleanup.mutate(
      { kind },
      {
        onSuccess: (result) => {
          if (useWorkspaceStore.getState().epoch !== epoch) return;
          if (shouldOpenModCleanupDialog(result)) setReview({ epoch, preview: result });
          else toast.info(t('tools.toast.noCandidates'));
        },
      },
    );
  }

  function confirmCleanup(): void {
    if (!review || isPending || review.epoch !== useWorkspaceStore.getState().epoch) return;
    const { preview } = review;
    cleanMods.mutate(
      { kind: preview.kind, sourceKeys: cleanupSourceKeys(preview) },
      {
        onSuccess: (result) => {
          setReview(null);
          const toastFn = result.skipped.length > 0 ? toast.warning : toast.success;
          toastFn(
            t('tools.toast.cleaned', {
              cleaned: result.cleaned.length,
              skipped: result.skipped.length,
            }),
          );
        },
      },
    );
  }

  return {
    cleanupPreview,
    isPending,
    preview,
    confirmCleanup,
    closeCleanupDialog: () => setReview(null),
  };
}
