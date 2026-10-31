import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuItem, MenuSeparator } from '@/components/ui/menu';
import { AboutDialog } from './about-dialog';
import { UpdateDialog } from './update-dialog';
import { useAppUpdater } from './use-app-updater';
import { DesktopMenu, type MenuId } from './desktop-menu';

type HelpMenuProps = {
  openMenu: MenuId | null;
  setOpenMenu: (menu: MenuId | null) => void;
};
export function HelpMenu({ openMenu, setOpenMenu }: HelpMenuProps) {
  const { t } = useTranslation();
  const [aboutOpen, setAboutOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const updater = useAppUpdater();
  return (
    <>
      <DesktopMenu
        label={t('menu.help')}
        id="help"
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        triggerRef={triggerRef}
      >
        <MenuItem
          disabled={updater.busy}
          onSelect={() => {
            setOpenMenu(null);
            void updater.check();
          }}
        >
          {t('updates.check')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          onSelect={() => {
            setOpenMenu(null);
            setAboutOpen(true);
          }}
        >
          {t('menu.aboutRimr')}
        </MenuItem>
      </DesktopMenu>
      <UpdateDialog
        updater={updater}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      />
      <AboutDialog
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      />
    </>
  );
}
