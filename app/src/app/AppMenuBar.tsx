import type { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
} from '@/components/ui/menu';
import { ModListMenu } from '@/features/order/ModListMenu';
import { SUPPORTED_LOCALES_LIST, useLocaleStore, type Locale } from '@/stores/locale';
import { useThemeStore } from '@/stores/theme';
import { cn } from '@/lib/utils';
import { TOOL_CLEANUP_ITEMS } from './toolsMenuModel';
import type { useFileMenuActions } from './useFileMenuActions';
import type { useToolsMenuActions } from './useToolsMenuActions';
import type { useAppOrderDialogActions } from '@/features/order/hooks/useAppOrderDialogActions';

export type MenuId = 'file' | 'modList' | 'tools' | 'view' | 'settings' | 'help';

type AppMenuBarProps = {
  openMenu: MenuId | null;
  setOpenMenu: (menu: MenuId | null) => void;
  fileActions: ReturnType<typeof useFileMenuActions>;
  toolsActions: ReturnType<typeof useToolsMenuActions>;
  modListMenu: ReturnType<typeof useAppOrderDialogActions>;
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
  return (
    <DesktopMenu label={t('menu.file')} id="file" openMenu={openMenu} setOpenMenu={setOpenMenu}>
      <MenuItem onSelect={() => void fileActions.exportCurrentModList()}>
        {t('file.exportModList')}
      </MenuItem>
      <MenuItem onSelect={() => void fileActions.exportLibrary()}>
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
    </DesktopMenu>
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
  return (
    <DesktopMenu label={t('menu.tools')} id="tools" openMenu={openMenu} setOpenMenu={setOpenMenu}>
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
  return (
    <DesktopMenu label={t('menu.help')} id="help" openMenu={openMenu} setOpenMenu={setOpenMenu}>
      <MenuItem onSelect={() => toast.info(t('toast.about', { version: '0.1.0' }))}>
        {t('menu.aboutRimr')}
      </MenuItem>
    </DesktopMenu>
  );
}

function DesktopMenu({
  label,
  id,
  openMenu,
  setOpenMenu,
  children,
}: {
  label: string;
  id: MenuId;
  openMenu: MenuId | null;
  setOpenMenu: (menu: MenuId | null) => void;
  children: ReactNode;
}) {
  const open = openMenu === id;
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) setOpenMenu(id);
        else if (openMenu === id) setOpenMenu(null);
      }}
      modal={false}
    >
      <div className="relative h-full">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'h-full px-3 text-xs text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              open && 'bg-accent',
            )}
            onMouseEnter={() => {
              if (openMenu) setOpenMenu(id);
            }}
          >
            {label}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={0}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="min-w-48 rounded-slight border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {children}
        </DropdownMenuContent>
      </div>
    </DropdownMenu>
  );
}
