import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { windowClient } from '@/commands';
import { cn } from '@/lib/utils';

export function TitleDragRegion() {
  return (
    <div
      data-tauri-drag-region
      className="flex h-full items-center justify-center px-3 text-xs font-bold text-muted-foreground"
      onDoubleClick={() => void windowClient.toggleMaximize()}
    >
      RimR
    </div>
  );
}

export function WindowControls() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center">
      <WindowButton label={t('window.minimize')} onClick={() => void windowClient.minimize()}>
        <Minus />
      </WindowButton>
      <WindowButton label={t('window.maximize')} onClick={() => void windowClient.toggleMaximize()}>
        <Square />
      </WindowButton>
      <WindowButton label={t('window.close')} danger onClick={() => void windowClient.close()}>
        <X />
      </WindowButton>
    </div>
  );
}

function WindowButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      className={cn(
        'h-9 w-11 rounded-none shadow-none',
        danger && 'hover:bg-destructive hover:text-destructive-foreground',
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
