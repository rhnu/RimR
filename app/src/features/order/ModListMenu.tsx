import { useTranslation } from 'react-i18next';
import { MenuItem } from '@/components/ui/menu';

export type ModListMenuAction =
  | { kind: 'new' }
  | { kind: 'rename' }
  | { kind: 'saveAs' }
  | { kind: 'delete' };

export interface ModListMenuProps {
  canDelete: boolean;
  onAction: (action: ModListMenuAction) => void;
}

export function ModListMenu({ canDelete, onAction }: ModListMenuProps) {
  const { t } = useTranslation();
  return (
    <>
      <MenuItem onSelect={() => onAction({ kind: 'new' })}>{t('menu.newModList')}</MenuItem>
      <MenuItem onSelect={() => onAction({ kind: 'rename' })}>{t('menu.renameModList')}</MenuItem>
      <MenuItem onSelect={() => onAction({ kind: 'saveAs' })}>{t('menu.saveAsModList')}</MenuItem>
      <MenuItem disabled={!canDelete} onSelect={() => onAction({ kind: 'delete' })}>
        {t('menu.deleteModList')}
      </MenuItem>
    </>
  );
}
