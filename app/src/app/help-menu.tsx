import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuItem, MenuSeparator } from '@/components/ui/menu';
import { AboutDialog } from './about-dialog';
import { UpdateDialog } from './update-dialog';
import type { AppUpdater } from './use-app-updater';
import { DesktopMenu, type MenuId } from './desktop-menu';

type HelpMenuProps = {
  openMenu: MenuId | null;
  setOpenMenu: (menu: MenuId | null) => void;
  updater: AppUpdater;
};

export function HelpMenu({ openMenu, setOpenMenu, updater }: HelpMenuProps) {
  const { t } = useTranslation();
  const [aboutOpen, setAboutOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
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
          disabled={updater.state.busy}
          onSelect={() => {
            setOpenMenu(null);
            updater.check();
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
