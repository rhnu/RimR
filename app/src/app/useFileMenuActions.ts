import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  chooseRimrGameConfigBackupSavePath,
  pickRimrGameConfigBackupFile,
  pickSaveGameFile,
} from '@/commands';
import type { ConfiguredDirectoryKind, ModListDto } from '@/commands';
import { useOpenConfiguredDirectory } from '@/hooks/useOpenConfiguredDirectory';
import {
  useAppConfig,
  useExportLibrarySettingsFile,
  useExportModListFile,
  useImportLibrarySettingsFile,
  useImportModListFile,
} from '@/hooks/commands';
import { useReadSaveModIds } from '@/hooks/useReadSaveModIds';
import { useOrderDraftStore } from '@/stores/orderDraftStore';
import { useOrderCommandStore } from '@/stores/orderCommandStore';
import { isConfiguredDirectoryAvailable } from './fileMenuDirectoryModel';

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

  async function chooseExportPath(title: string): Promise<string | null> {
    return chooseRimrGameConfigBackupSavePath({
      title,
      defaultPath: appConfig.data?.paths.rimrDataDir ?? undefined,
      extensions: ['json'],
    }).match(
      (path) => path,
      () => null,
    );
  }

  async function chooseImportPath(title: string): Promise<string | null> {
    return pickRimrGameConfigBackupFile({
      title,
      defaultPath: appConfig.data?.paths.rimrDataDir ?? undefined,
      extensions: ['json'],
    }).match(
      (path) => path,
      () => null,
    );
  }

  async function exportCurrentModList(): Promise<void> {
    const outputPath = await chooseExportPath(t('dialog.exportModList'));
    if (!outputPath) return;
    exportModListMutation.mutate(
      { outputPath },
      { onSuccess: () => toast.success(t('toast.modListExported')) },
    );
  }

  async function exportLibrary(): Promise<void> {
    const outputPath = await chooseExportPath(t('dialog.exportLibrarySettings'));
    if (!outputPath) return;
    exportLibraryMutation.mutate(
      { outputPath },
      { onSuccess: () => toast.success(t('toast.librarySettingsExported')) },
    );
  }

  async function importModList(): Promise<void> {
    const inputPath = await chooseImportPath(t('dialog.importModList'));
    if (!inputPath) return;
    importModListMutation.mutate(
      { inputPath },
      { onSuccess: (modList) => toast.success(t('toast.modListImported', { name: modList.name })) },
    );
  }

  async function importLibrary(): Promise<void> {
    const inputPath = await chooseImportPath(t('dialog.importLibrarySettings'));
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
      () => null,
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
