import { useState, type ReactNode } from 'react';
import { LibraryDialogs } from '@/features/library/library-dialogs';
import { useLibraryDialogActions } from '@/features/library/hooks/use-library-dialog-actions';
import { useOrderDraftStore } from '@/stores/order-draft-store';
import { windowClient } from '@/commands';
import { AppMenuBar, type MenuId } from './app-menu-bar';
import { ModCleanupDialog } from './mod-cleanup-dialog';
import { TitleDragRegion, WindowControls } from './window-controls';
import { useFileMenuActions } from './use-file-menu-actions';
import { useToolsMenuActions } from './use-tools-menu-actions';

export function AppShell({ children }: { children: ReactNode }) {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const fileActions = useFileMenuActions();
  const toolsActions = useToolsMenuActions();
  const draft = useOrderDraftStore((state) => state.draft);
  const modListMenu = useLibraryDialogActions(draft ?? undefined);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-9 shrink-0 select-none items-center border-b border-border bg-card text-sm">
        <div
          className="flex h-full flex-1 items-center"
          data-tauri-drag-region
          onDoubleClick={(e) => {
            if (e.target === e.currentTarget) void windowClient.toggleMaximize();
          }}
        >
          <AppMenuBar
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            fileActions={fileActions}
            toolsActions={toolsActions}
            modListMenu={modListMenu}
          />
        </div>
        <TitleDragRegion />
        <div
          className="flex h-full flex-1 items-center justify-end"
          data-tauri-drag-region
          onDoubleClick={(e) => {
            if (e.target === e.currentTarget) void windowClient.toggleMaximize();
          }}
        >
          <WindowControls />
        </div>
      </header>
      <LibraryDialogs />
      <ModCleanupDialog
        preview={toolsActions.cleanupPreview}
        pending={toolsActions.isPending}
        onConfirm={() => void toolsActions.confirmCleanup()}
        onClose={toolsActions.closeCleanupDialog}
      />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
