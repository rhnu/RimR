import { useTranslation } from 'react-i18next';
import { MenuItem } from '@/components/ui/menu';

export type ModListMenuAction =
  | { kind: 'new' }
  | { kind: 'rename' }
  | { kind: 'saveAs' }
  | { kind: 'delete' };

export interface ModListMenuProps {
  canDelete: boolean;
  pending: boolean;
  onAction: (action: ModListMenuAction) => void;
}

export function ModListMenu({ canDelete, pending, onAction }: ModListMenuProps) {
  const { t } = useTranslation();
  return (
    <>
      <MenuItem disabled={pending} onSelect={() => onAction({ kind: 'new' })}>
        {t('menu.newModList')}
      </MenuItem>
      <MenuItem disabled={pending} onSelect={() => onAction({ kind: 'rename' })}>
        {t('menu.renameModList')}
      </MenuItem>
      <MenuItem disabled={pending} onSelect={() => onAction({ kind: 'saveAs' })}>
        {t('menu.saveAsModList')}
      </MenuItem>
      <MenuItem disabled={pending || !canDelete} onSelect={() => onAction({ kind: 'delete' })}>
        {t('menu.deleteModList')}
      </MenuItem>
    </>
  );
}
