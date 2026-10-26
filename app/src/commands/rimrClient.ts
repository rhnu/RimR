import { invoke } from '@tauri-apps/api/core';
import { ResultAsync } from 'neverthrow';
import type {
  ActiveListLoadDto,
  ApplyModListDto,
  ApplyModListRequest,
  AppConfig,
  CommandError,
  CreateModListRequest,
  DeleteModListRequest,
  DetectedPaths,
  ExportGameConfigBackupDto,
  ExportGameConfigBackupRequest,
  ExportLibrarySettingsFileDto,
  ExportLibrarySettingsFileRequest,
  ExportModListFileDto,
  ExportModListFileRequest,
  ImportGameConfigBackupDto,
  ImportGameConfigBackupRequest,
  ImportLibrarySettingsFileRequest,
  ImportModListFileRequest,
  LibrarySettingsDto,
  CleanModsRequest,
  LoadModFolderSizeRequest,
  LoadModPreviewRequest,
  LoadPlayerLogRequest,
  LibraryDto,
  ModCleanupPreviewDto,
  ModCleanupPreviewRequest,
  ModCleanupResultDto,
  ModFolderSizeDto,
  ModListDto,
  ModListIndexDto,
  ModPreviewDto,
  OpenConfiguredDirectoryRequest,
  OpenModFolderRequest,
  OpenSteamWorkshopPageRequest,
  PlayerLogDto,
  ReadSaveModIdsDto,
  ReadSaveModIdsRequest,
  SaveLibrarySettingsRequest,
  SaveModListRequest,
  SetCurrentModListRequest,
  CatalogSnapshotDto,
  SteamWorkshopLogDto,
  ValidateActiveOrderRequest,
  ValidateOrderDto,
} from './generated/types';

type InvokeArgs = Record<string, unknown>;

type CommandContracts = {
  get_app_config: {
    args: undefined;
    result: AppConfig;
  };
  save_app_config: {
    args: { request: { config: AppConfig } };
    result: AppConfig;
  };
  autodetect_paths: {
    args: undefined;
    result: DetectedPaths;
  };
  clear_session_cache: {
    args: undefined;
    result: void;
  };
  rebuild_mod_catalog: {
    args: undefined;
    result: CatalogSnapshotDto;
  };
  load_mod_preview: {
    args: { request: LoadModPreviewRequest };
    result: ModPreviewDto;
  };
  load_mod_folder_size: {
    args: { request: LoadModFolderSizeRequest };
    result: ModFolderSizeDto;
  };
  preview_mod_cleanup: {
    args: { request: ModCleanupPreviewRequest };
    result: ModCleanupPreviewDto;
  };
  clean_mods: {
    args: { request: CleanModsRequest };
    result: ModCleanupResultDto;
  };
  open_mod_folder: {
    args: { request: OpenModFolderRequest };
    result: void;
  };
  open_configured_directory: {
    args: { request: OpenConfiguredDirectoryRequest };
    result: void;
  };
  open_steam_workshop_page: {
    args: { request: OpenSteamWorkshopPageRequest };
    result: void;
  };
  launch_game: {
    args: undefined;
    result: void;
  };
  load_active_list: {
    args: undefined;
    result: ActiveListLoadDto;
  };
  validate_active_order: {
    args: { request: ValidateActiveOrderRequest };
    result: ValidateOrderDto;
  };
  load_library: {
    args: undefined;
    result: LibraryDto;
  };
  save_library_settings: {
    args: { request: SaveLibrarySettingsRequest };
    result: LibrarySettingsDto;
  };
  create_mod_list: {
    args: { request: CreateModListRequest };
    result: ModListDto;
  };
  save_mod_list: {
    args: { request: SaveModListRequest };
    result: ModListDto;
  };
  delete_mod_list: {
    args: { request: DeleteModListRequest };
    result: ModListIndexDto;
  };
  set_current_mod_list: {
    args: { request: SetCurrentModListRequest };
    result: ModListDto;
  };
  apply_mod_list_to_game: {
    args: { request: ApplyModListRequest };
    result: ApplyModListDto;
  };
  export_game_config_backup: {
    args: { request: ExportGameConfigBackupRequest };
    result: ExportGameConfigBackupDto;
  };
  import_game_config_backup: {
    args: { request: ImportGameConfigBackupRequest };
    result: ImportGameConfigBackupDto;
  };
  export_mod_list_file: {
    args: { request: ExportModListFileRequest };
    result: ExportModListFileDto;
  };
  import_mod_list_file: {
    args: { request: ImportModListFileRequest };
    result: ModListDto;
  };
  read_save_mod_ids: {
    args: { request: ReadSaveModIdsRequest };
    result: ReadSaveModIdsDto;
  };
  export_library_settings_file: {
    args: { request: ExportLibrarySettingsFileRequest };
    result: ExportLibrarySettingsFileDto;
  };
  import_library_settings_file: {
    args: { request: ImportLibrarySettingsFileRequest };
    result: LibrarySettingsDto;
  };
  load_steam_workshop_log: {
    args: undefined;
    result: SteamWorkshopLogDto;
  };
  load_player_log: {
    args: { request: LoadPlayerLogRequest };
    result: PlayerLogDto;
  };
};

type CommandName = keyof CommandContracts;

export type RimrClientError =
  | { kind: 'command'; error: CommandError }
  | { kind: 'transport'; message: string; cause: unknown };

export type RimrResult<T> = ResultAsync<T, RimrClientError>;

function invokeCommand<Name extends CommandName>(
  name: Name,
  args?: CommandContracts[Name]['args'],
): RimrResult<CommandContracts[Name]['result']> {
  return ResultAsync.fromPromise(
    invoke<CommandContracts[Name]['result']>(name, args as InvokeArgs | undefined),
    toRimrClientError,
  );
}

function toRimrClientError(error: unknown): RimrClientError {
  if (isCommandError(error)) {
    return { kind: 'command', error };
  }

  return {
    kind: 'transport',
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  };
}

function isCommandError(value: unknown): value is CommandError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<CommandError>;
  return typeof candidate.code === 'string' && typeof candidate.message === 'string';
}

export const rimrClient = {
  getAppConfig: () => invokeCommand('get_app_config'),
  saveAppConfig: (config: AppConfig) => invokeCommand('save_app_config', { request: { config } }),
  autodetectPaths: () => invokeCommand('autodetect_paths'),
  clearSessionCache: () => invokeCommand('clear_session_cache'),
  rebuildCatalog: () => invokeCommand('rebuild_mod_catalog'),
  loadModPreview: (request: LoadModPreviewRequest) =>
    invokeCommand('load_mod_preview', { request }),
  loadModFolderSize: (request: LoadModFolderSizeRequest) =>
    invokeCommand('load_mod_folder_size', { request }),
  previewModCleanup: (request: ModCleanupPreviewRequest) =>
    invokeCommand('preview_mod_cleanup', { request }),
  cleanMods: (request: CleanModsRequest) => invokeCommand('clean_mods', { request }),
  openModFolder: (request: OpenModFolderRequest) => invokeCommand('open_mod_folder', { request }),
  openConfiguredDirectory: (request: OpenConfiguredDirectoryRequest) =>
    invokeCommand('open_configured_directory', { request }),
  openSteamWorkshopPage: (request: OpenSteamWorkshopPageRequest) =>
    invokeCommand('open_steam_workshop_page', { request }),
  launchGame: () => invokeCommand('launch_game'),
  loadActiveList: () => invokeCommand('load_active_list'),
  validateActiveOrder: (request: ValidateActiveOrderRequest) =>
    invokeCommand('validate_active_order', { request }),
  loadLibrary: () => invokeCommand('load_library'),
  saveLibrarySettings: (request: SaveLibrarySettingsRequest) =>
    invokeCommand('save_library_settings', { request }),
  createModList: (request: CreateModListRequest) => invokeCommand('create_mod_list', { request }),
  saveModList: (request: SaveModListRequest) => invokeCommand('save_mod_list', { request }),
  deleteModList: (request: DeleteModListRequest) => invokeCommand('delete_mod_list', { request }),
  setCurrentModList: (request: SetCurrentModListRequest) =>
    invokeCommand('set_current_mod_list', { request }),
  applyModListToGame: (request: ApplyModListRequest) =>
    invokeCommand('apply_mod_list_to_game', { request }),
  exportGameConfigBackup: (request: ExportGameConfigBackupRequest) =>
    invokeCommand('export_game_config_backup', { request }),
  importGameConfigBackup: (request: ImportGameConfigBackupRequest) =>
    invokeCommand('import_game_config_backup', { request }),
  exportModListFile: (request: ExportModListFileRequest) =>
    invokeCommand('export_mod_list_file', { request }),
  importModListFile: (request: ImportModListFileRequest) =>
    invokeCommand('import_mod_list_file', { request }),
  readSaveModIds: (request: ReadSaveModIdsRequest) =>
    invokeCommand('read_save_mod_ids', { request }),
  exportLibrarySettingsFile: (request: ExportLibrarySettingsFileRequest) =>
    invokeCommand('export_library_settings_file', { request }),
  importLibrarySettingsFile: (request: ImportLibrarySettingsFileRequest) =>
    invokeCommand('import_library_settings_file', { request }),
  loadSteamWorkshopLog: () => invokeCommand('load_steam_workshop_log'),
  loadPlayerLog: (request: LoadPlayerLogRequest) => invokeCommand('load_player_log', { request }),
} as const;
