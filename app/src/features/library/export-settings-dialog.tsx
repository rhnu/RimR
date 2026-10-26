import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ExportSettingsDialog({
  open,
  onOpenChange,
  onExport,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>['onCloseAutoFocus'];
  onExport: (includeDiagnosticSuppressions: boolean) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [include, setInclude] = useState(false);
  function close() {
    setInclude(false);
    onOpenChange(false);
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setInclude(false);
      }}
    >
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{t('file.exportLibrarySettings')}</DialogTitle>
          <DialogDescription>{t('suppression.exportDescription')}</DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={include}
            onChange={(event) => setInclude(event.target.checked)}
          />
          {t('suppression.includeExport')}
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              const requested = include;
              setInclude(false);
              onOpenChange(false);
              void onExport(requested);
            }}
          >
            {t('suppression.export')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
