import { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
} from '@/components/ui/menu';
import { DiagnosticSuppressionDialog } from '@/features/library/diagnostic-suppression-dialog';
import { ExportSettingsDialog } from '@/features/library/export-settings-dialog';
import { ModListMenu } from '@/features/library/mod-list-menu';
import { SUPPORTED_LOCALES_LIST, useLocaleStore, type Locale } from '@/stores/locale';
import { useThemeStore } from '@/stores/theme';
import { AboutDialog } from './about-dialog';
import { TOOL_CLEANUP_ITEMS } from './tools-menu-model';
import type { useFileMenuActions } from './use-file-menu-actions';
import type { useToolsMenuActions } from './use-tools-menu-actions';
import type { useLibraryDialogActions } from '@/features/library/hooks/use-library-dialog-actions';

import { DesktopMenu, type MenuId } from './desktop-menu';
export type { MenuId } from './desktop-menu';

type AppMenuBarProps = {
  openMenu: MenuId | null;
  setOpenMenu: (menu: MenuId | null) => void;
  fileActions: ReturnType<typeof useFileMenuActions>;
  toolsActions: ReturnType<typeof useToolsMenuActions>;
  modListMenu: ReturnType<typeof useLibraryDialogActions>;
};

export function AppMenuBar(props: AppMenuBarProps) {
  return (
    <nav className="flex h-full items-center">
      <FileMenu {...props} />
      <ModListDesktopMenu {...props} />
      <ToolsMenu {...props} />
      <ViewMenu {...props} />
      <SettingsMenu {...props} />
      <HelpMenu {...props} />
    </nav>
  );
}

function FileMenu({ openMenu, setOpenMenu, fileActions }: AppMenuBarProps) {
  const { t } = useTranslation();
  const [exportOpen, setExportOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <DesktopMenu
        triggerRef={triggerRef}
        label={t('menu.file')}
        id="file"
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
      >
        <MenuItem onSelect={() => void fileActions.exportCurrentModList()}>
          {t('file.exportModList')}
        </MenuItem>
        <MenuItem
          onSelect={() => {
            setOpenMenu(null);
            setExportOpen(true);
          }}
        >
          {t('file.exportLibrarySettings')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => void fileActions.importModList()}>
          {t('file.importModList')}
        </MenuItem>
        <MenuItem onSelect={() => void fileActions.importLibrary()}>
          {t('file.importLibrarySettings')}
        </MenuItem>
        <MenuItem
          disabled={!fileActions.canImportFromSave}
          onSelect={() => void fileActions.importFromSave()}
        >
          {t('file.importFromSave')}
        </MenuItem>
        <MenuSeparator />
        <FileDirectoryMenu fileActions={fileActions} />
      </DesktopMenu>
      <ExportSettingsDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        onExport={fileActions.exportLibrary}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      />
    </>
  );
}

function ModListDesktopMenu({ openMenu, setOpenMenu, modListMenu }: AppMenuBarProps) {
  const { t } = useTranslation();
  return (
    <DesktopMenu
      label={t('menu.modList')}
      id="modList"
      openMenu={openMenu}
      setOpenMenu={setOpenMenu}
    >
      {modListMenu.currentModList ? (
        <ModListMenu canDelete={modListMenu.canDelete} onAction={modListMenu.onAction} />
      ) : (
        <MenuItem disabled onSelect={() => undefined}>
          {t('order.state.modListNotLoaded')}
        </MenuItem>
      )}
    </DesktopMenu>
  );
}

function ToolsMenu({ openMenu, setOpenMenu, toolsActions }: AppMenuBarProps) {
  const { t } = useTranslation();
  const [suppressionOpen, setSuppressionOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <DesktopMenu
        triggerRef={triggerRef}
        label={t('menu.tools')}
        id="tools"
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
      >
        <MenuItem
          onSelect={() => {
            setOpenMenu(null);
            setSuppressionOpen(true);
          }}
        >
          {t('suppression.manage')}
        </MenuItem>
        <MenuSeparator />
        {TOOL_CLEANUP_ITEMS.map((item) => (
          <MenuItem
            key={item.kind}
            disabled={toolsActions.isPending}
            onSelect={() => void toolsActions.preview(item.kind)}
          >
            {t(item.labelKey)}
          </MenuItem>
        ))}
      </DesktopMenu>
      <DiagnosticSuppressionDialog
        open={suppressionOpen}
        onOpenChange={setSuppressionOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      />
    </>
  );
}

function ViewMenu({ openMenu, setOpenMenu }: AppMenuBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  return (
    <DesktopMenu label={t('menu.view')} id="view" openMenu={openMenu} setOpenMenu={setOpenMenu}>
      <MenuItem onSelect={() => void navigate({ to: '/order' })}>{t('order.title')}</MenuItem>
      <MenuItem onSelect={() => void navigate({ to: '/logs' })}>{t('logs.title')}</MenuItem>
      <MenuSeparator />
      <MenuLabel>{t('menu.theme')}</MenuLabel>
      {(['light', 'dark', 'system'] as const).map((value) => (
        <MenuItem key={value} active={theme === value} onSelect={() => setTheme(value)}>
          {t(`theme.${value}`)}
        </MenuItem>
      ))}
      <MenuSeparator />
      <MenuLabel>{t('menu.language')}</MenuLabel>
      {SUPPORTED_LOCALES_LIST.map((value) => (
        <MenuItem key={value} active={locale === value} onSelect={() => setLocale(value as Locale)}>
          {t(`language.${value}`)}
        </MenuItem>
      ))}
    </DesktopMenu>
  );
}

function SettingsMenu({ openMenu, setOpenMenu }: AppMenuBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <DesktopMenu
      label={t('menu.settings')}
      id="settings"
      openMenu={openMenu}
      setOpenMenu={setOpenMenu}
    >
      <MenuItem onSelect={() => void navigate({ to: '/settings' })}>
        {t('menu.preferences')}
      </MenuItem>
    </DesktopMenu>
  );
}

function HelpMenu({ openMenu, setOpenMenu }: AppMenuBarProps) {
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
          onSelect={() => {
            setOpenMenu(null);
            setAboutOpen(true);
          }}
        >
          {t('menu.aboutRimr')}
        </MenuItem>
      </DesktopMenu>
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

function FileDirectoryMenu({ fileActions }: Pick<AppMenuBarProps, 'fileActions'>) {
  const { t } = useTranslation();
  return (
    <MenuSub>
      <MenuSubTrigger>{t('file.openDirectory.title')}</MenuSubTrigger>
      <MenuSubContent>
        <MenuLabel>{t('file.openDirectory.groupGame')}</MenuLabel>
        <MenuItem
          disabled={!fileActions.isDirectoryAvailable('gameDir')}
          onSelect={() => fileActions.openDirectory('gameDir')}
        >
          {t('file.openDirectory.gameDir')}
        </MenuItem>
        <MenuItem
          disabled={!fileActions.isDirectoryAvailable('gameDataDir')}
          onSelect={() => fileActions.openDirectory('gameDataDir')}
        >
          {t('file.openDirectory.gameDataDir')}
        </MenuItem>
        <MenuItem
          disabled={!fileActions.isDirectoryAvailable('localModsDir')}
          onSelect={() => fileActions.openDirectory('localModsDir')}
        >
          {t('file.openDirectory.localModsDir')}
        </MenuItem>
        <MenuItem
          disabled={!fileActions.isDirectoryAvailable('workshopModsDir')}
          onSelect={() => fileActions.openDirectory('workshopModsDir')}
        >
          {t('file.openDirectory.workshopModsDir')}
        </MenuItem>
        <MenuSeparator />
        <MenuLabel>{t('file.openDirectory.groupRimr')}</MenuLabel>
        <MenuItem
          disabled={!fileActions.isDirectoryAvailable('rimrDataDir')}
          onSelect={() => fileActions.openDirectory('rimrDataDir')}
        >
          {t('file.openDirectory.rimrDataDir')}
        </MenuItem>
        <MenuItem
          disabled={!fileActions.isDirectoryAvailable('rimrModListsDir')}
          onSelect={() => fileActions.openDirectory('rimrModListsDir')}
        >
          {t('file.openDirectory.rimrModListsDir')}
        </MenuItem>
        <MenuItem
          disabled={!fileActions.isDirectoryAvailable('rimrLogsDir')}
          onSelect={() => fileActions.openDirectory('rimrLogsDir')}
        >
          {t('file.openDirectory.rimrLogsDir')}
        </MenuItem>
      </MenuSubContent>
    </MenuSub>
  );
}
