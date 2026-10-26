import { useTranslation } from 'react-i18next';
import type { ModCleanupCandidateDto, ModCleanupPreviewDto } from '@/commands';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ModCleanupDialogProps = {
  preview: ModCleanupPreviewDto | null;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ModCleanupDialog({ preview, pending, onConfirm, onClose }: ModCleanupDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={preview !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {preview ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('tools.dialog.title')}</DialogTitle>
              <DialogDescription>
                {t('tools.dialog.description', { count: preview.candidates.length })}
              </DialogDescription>
            </DialogHeader>
            <CandidateList candidates={preview.candidates} />
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
                {t('tools.dialog.confirm')}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CandidateList({ candidates }: { candidates: ModCleanupCandidateDto[] }) {
  return (
    <div className="max-h-80 overflow-auto border border-border text-xs">
      {candidates.map((candidate) => (
        <CandidateRow key={candidate.sourceKey} candidate={candidate} />
      ))}
    </div>
  );
}

function CandidateRow({ candidate }: { candidate: ModCleanupCandidateDto }) {
  const { t } = useTranslation();
  return (
    <div className="border-b border-border px-2 py-1.5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-medium">{candidate.name ?? candidate.packageId}</span>
        <span className="shrink-0 text-muted-foreground">
          {t('tools.dialog.fileCount', { count: candidate.fileCount })}
        </span>
      </div>
      <div className="mt-0.5 truncate font-mono text-muted-foreground">{candidate.path}</div>
      <div className="mt-0.5 text-muted-foreground">{t(`tools.reason.${candidate.reason}`)}</div>
    </div>
  );
}
