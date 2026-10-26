import { toast } from 'sonner';
import { reportError } from '@/queries/client';
import { useTranslation } from 'react-i18next';
import { chooseRimrSavePath, pickRimrFile, pickSaveGameFile } from '@/commands';
import type { ConfiguredDirectoryKind, ModListDto } from '@/commands';
import { useOpenConfiguredDirectory } from '@/queries/native';
import { useAppConfig } from '@/queries/config';
import {
  useExportLibrarySettingsFile,
  useExportModListFile,
  useImportLibrarySettingsFile,
  useImportModListFile,
} from '@/queries/files';
import { useReadSaveModIds } from '@/queries/native';
import { useOrderDraftStore } from '@/stores/order-draft-store';
import { useOrderCommandStore } from '@/stores/order-command-store';
import { isConfiguredDirectoryAvailable } from './file-menu-directory-model';

export function useFileMenuActions() {
  const { t } = useTranslation();
  const appConfig = useAppConfig();
  const exportModListMutation = useExportModListFile();
  const importModListMutation = useImportModListFile();
  const exportLibraryMutation = useExportLibrarySettingsFile();
  const importLibraryMutation = useImportLibrarySettingsFile();
  const openDirectoryMutation = useOpenConfiguredDirectory();
  const draft = useOrderDraftStore((state) => state.draft);
  const importFromSave = useImportFromSave(draft, appConfig.data?.paths.gameDataDir ?? undefined);

  const paths = appConfig.data?.paths;

  const openDirectory = (kind: ConfiguredDirectoryKind): void => {
    openDirectoryMutation.mutate({ kind });
  };

  async function exportCurrentModList(): Promise<void> {
    const outputPath = await chooseFilePath(t('dialog.exportModList'), paths?.rimrDataDir, 'save');
    if (!outputPath) return;
    exportModListMutation.mutate(
      { outputPath },
      { onSuccess: () => toast.success(t('toast.modListExported')) },
    );
  }

  async function exportLibrary(includeDiagnosticSuppressions = false): Promise<void> {
    const outputPath = await chooseFilePath(
      t('dialog.exportLibrarySettings'),
      paths?.rimrDataDir,
      'save',
    );
    if (!outputPath) return;
    exportLibraryMutation.mutate(
      { outputPath, includeDiagnosticSuppressions },
      { onSuccess: () => toast.success(t('toast.librarySettingsExported')) },
    );
  }

  async function importModList(): Promise<void> {
    const inputPath = await chooseFilePath(t('dialog.importModList'), paths?.rimrDataDir, 'open');
    if (!inputPath) return;
    importModListMutation.mutate(
      { inputPath },
      { onSuccess: (modList) => toast.success(t('toast.modListImported', { name: modList.name })) },
    );
  }

  async function importLibrary(): Promise<void> {
    const inputPath = await chooseFilePath(
      t('dialog.importLibrarySettings'),
      paths?.rimrDataDir,
      'open',
    );
    if (!inputPath) return;
    importLibraryMutation.mutate(
      { inputPath },
      { onSuccess: () => toast.success(t('toast.librarySettingsImported')) },
    );
  }

  return {
    exportCurrentModList,
    exportLibrary,
    importModList,
    importLibrary,
    importFromSave,
    canImportFromSave: draft != null,
    openDirectory,
    isDirectoryAvailable: (kind: ConfiguredDirectoryKind) =>
      isConfiguredDirectoryAvailable(paths, kind),
  };
}

function useImportFromSave(draft: ModListDto | null, gameDataDir: string | undefined) {
  const { t } = useTranslation();
  const readSaveModIdsMutation = useReadSaveModIds();
  const commandStore = useOrderCommandStore();

  async function importFromSave(): Promise<void> {
    if (!draft) return;
    const defaultPath = gameDataDir ? `${gameDataDir}/Saves` : undefined;
    const inputPath = await pickSaveGameFile({
      title: t('dialog.importFromSave'),
      defaultPath,
      extensions: ['rws'],
    }).match(
      (path) => path,
      (error) => {
        reportError(error);
        return null;
      },
    );
    if (!inputPath) return;
    readSaveModIdsMutation.mutate(
      { path: inputPath },
      {
        onSuccess: (dto) => {
          if (dto.modIds.length === 0) {
            toast.info(t('toast.saveOrderEmpty'));
            return;
          }
          commandStore.request({ kind: 'syncFromSave', modIds: dto.modIds });
        },
      },
    );
  }

  return importFromSave;
}

function chooseFilePath(
  title: string,
  defaultPath: string | null | undefined,
  mode: 'open' | 'save',
): Promise<string | null> {
  const choose = mode === 'save' ? chooseRimrSavePath : pickRimrFile;
  return choose({ title, defaultPath: defaultPath ?? undefined, extensions: ['json'] }).match(
    (path) => path,
    (error) => {
      reportError(error);
      return null;
    },
  );
}
