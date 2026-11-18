import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type DialogFormProps = {
  children?: ReactNode;
  className?: string;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitVariant?: 'default' | 'destructive';
  submitDisabled?: boolean;
};

export function DialogForm({
  children,
  className,
  onCancel,
  onSubmit,
  submitLabel,
  submitVariant = 'default',
  submitDisabled,
}: DialogFormProps) {
  const { t } = useTranslation();
  return (
    <form
      className={cn('flex min-h-0 flex-col gap-4', className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant={submitVariant} disabled={submitDisabled}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
