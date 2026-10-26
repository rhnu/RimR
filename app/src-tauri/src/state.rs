use crate::app_config::{
    AppConfig, ConfigFileError, default_config_path, default_data_dir, load_config_from_file,
    save_config_to_file,
};
use crate::dto::{
    self, ActiveListLoadDto, ActiveListWriteDto, ApplyModListDto, ApplyModListRequest,
    CatalogSnapshotDto, CleanModsRequest, CreateModListRequest, DeleteModListRequest,
    ExportGameConfigBackupDto, ExportGameConfigBackupRequest, ExportLibrarySettingsFileDto,
    ExportLibrarySettingsFileRequest, ExportModListFileDto, ExportModListFileRequest,
    ImportGameConfigBackupDto, ImportGameConfigBackupRequest, ImportLibrarySettingsFileRequest,
    ImportModListFileRequest, LibraryDto, LibrarySettingsDto, LoadModFolderSizeRequest,
    LoadModPreviewRequest, LoadPlayerLogRequest, LogEntryDto, LogLevelDto, LogSourceDto,
    ModCleanupCandidateDto, ModCleanupKindDto, ModCleanupPreviewDto, ModCleanupPreviewRequest,
    ModCleanupReasonDto, ModCleanupResultDto, ModCleanupSkippedDto, ModFolderSizeDto, ModListDto,
    ModListIndexDto, ModPreviewDto, OpenSteamWorkshopPageRequest, PlayerLogDto,
    SaveLibrarySettingsRequest, SaveModListRequest, SetCurrentModListRequest, SteamWorkshopLogDto,
    SteamWorkshopLogEntryDto, SteamWorkshopOpenTarget, ValidateActiveOrderRequest,
    ValidateOrderDto,
};
use crate::error::{self, CommandError, CommandErrorCode, CommandResult};
use crate::library_store::JsonLibraryStore;
use crate::mod_file_info::{self, CachedModFolderSize, CachedModPreview};
use crate::paths;
use crate::source::{FsModSource, SourceRoots};
use rimr_core::{
    ActiveModList, AppClock, LibraryStore, ModCatalog, ModMetadata, ModSourceKey, PackageId,
    RimrFileSerializer, SourceKind, WorkspaceSession, create_mod_list, delete_mod_list,
    import_mod_list, load_library, merge_library_settings as core_merge_library_settings,
    save_mod_list, set_current_mod_list,
};
use rimr_steam::{
    WorkshopLinks, appworkshop_acf_path, parse_appworkshop_acf, workshop_file_id_from_mod_path,
};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::RwLock;

#[derive(Debug)]
pub struct AppState {
    config_path: PathBuf,
    inner: RwLock<SessionState>,
}

#[derive(Debug, Clone)]
struct SessionState {
    config: AppConfig,
    workspace: WorkspaceSession,
    canonical_source_roots: Option<CanonicalSourceRoots>,
    mod_previews: HashMap<String, CachedModPreview>,
    mod_folder_sizes: HashMap<String, CachedModFolderSize>,
}

#[derive(Debug, Clone)]
struct SourceMetadataIndexEntry {
    mod_path: PathBuf,
    source_kind: SourceKind,
    mod_icon_path: Option<String>,
}

#[derive(Debug, Clone)]
struct CanonicalSourceRoots {
    roots: Vec<PathBuf>,
}

impl AppState {
    pub fn from_default_config_path() -> Self {
        let config_path =
            default_config_path().unwrap_or_else(|| PathBuf::from("rimr-config.json"));
        Self::new(config_path).unwrap_or_else(|_| Self::empty(PathBuf::from("rimr-config.json")))
    }

    pub fn new(config_path: PathBuf) -> Result<Self, ConfigFileError> {
        let config = load_config_from_file(&config_path)?;
        Ok(Self::with_config(config_path, config))
    }

    pub fn empty(config_path: PathBuf) -> Self {
        Self::with_config(config_path, AppConfig::default())
    }

    pub fn replace_config(&self, config: AppConfig) -> CommandResult<AppConfig> {
        tracing::info!(config_path = ?self.config_path, "replacing app config");
        save_config_to_file(&self.config_path, &config).map_err(command_config_write_error)?;
        let mut state = self.write_state()?;
        let paths_changed = state.config.paths_changed(&config);
        state.config = config.clone();
        // Only invalidate session caches when path-related fields actually
        // changed. UI preference updates (theme/locale) must not wipe the
        // in-memory catalog or active mod list.
        if paths_changed {
            tracing::info!("paths changed, invalidating session caches");
            state.workspace.clear();
            state.canonical_source_roots = None;
            state.mod_previews.clear();
            state.mod_folder_sizes.clear();
        }
        Ok(config)
    }

    pub fn get_config(&self) -> CommandResult<AppConfig> {
        tracing::debug!("reading app config");
        Ok(self.read_state()?.config.clone())
    }

    pub fn clear_session_cache(&self) -> CommandResult<()> {
        tracing::info!("clearing session cache");
        let mut state = self.write_state()?;
        state.workspace.clear();
        state.canonical_source_roots = None;
        state.mod_previews.clear();
        state.mod_folder_sizes.clear();
        Ok(())
    }

    pub fn apply_detected_paths(&self) -> CommandResult<paths::DetectedPaths> {
        tracing::info!("autodetecting RimWorld paths");
        let detected = paths::autodetect_paths().map_err(|error| {
            CommandError::new(CommandErrorCode::PathAutodetectFailed, error.to_string())
        })?;
        let mut config = self.get_config()?;
        config.paths.game_dir = Some(detected.game_dir.clone());
        config.paths.game_data_dir = Some(detected.game_data_dir.clone());
        config.paths.local_mods_dir = Some(detected.local_mods_dir.clone());
        config.paths.workshop_mods_dir = Some(detected.workshop_mods_dir.clone());
        self.replace_config(config)?;
        tracing::info!(
            game_dir = ?detected.game_dir,
            game_data_dir = ?detected.game_data_dir,
            warnings = detected.warnings.len(),
            "detected RimWorld paths"
        );
        Ok(detected)
    }

    pub async fn rebuild_mod_catalog(&self) -> CommandResult<CatalogSnapshotDto> {
        tracing::info!("rebuilding mod catalog");
        let roots = self.source_roots()?;
        let canonical_source_roots = canonical_source_roots(&roots);
        let source = FsModSource::new(roots);
        let mut workspace = self.read_state()?.workspace.clone();
        let report = workspace
            .scan_mods(&source, &rimr_core::ScanOpts::default())
            .await
            .inspect_err(|e| tracing::error!(error = ?e, "mod metadata scan failed"))
            .map_err(error::core_error)?;

        let dto = dto::catalog_snapshot(&report.catalog, &report.diagnostics);
        tracing::info!(
            mods_found = dto.catalog.mods.len(),
            diagnostics = dto.diagnostics.len(),
            "mod catalog rebuild complete"
        );
        let mut state = self.write_state()?;
        state.workspace = workspace;
        state.canonical_source_roots = Some(canonical_source_roots);
        state.mod_previews.clear();
        state.mod_folder_sizes.clear();
        Ok(dto)
    }

    pub async fn load_mod_preview(
        &self,
        request: LoadModPreviewRequest,
    ) -> CommandResult<ModPreviewDto> {
        tracing::info!(source_key = %request.source_key, "loading mod preview");
        let (source_key, mod_path, mod_icon_path, cached, canonical_source_roots) = {
            let state = self.read_state()?;
            let metadata = source_metadata_for_source_key(&state, &request.source_key)?;
            (
                request.source_key.clone(),
                metadata.mod_path.clone(),
                metadata.mod_icon_path.clone(),
                state.mod_previews.get(request.source_key.as_str()).cloned(),
                canonical_source_roots_for_state(&state)?,
            )
        };

        ensure_mod_path_in_roots(&mod_path, &canonical_source_roots)?;
        let cache_hit = cached.is_some();
        let loaded = tokio::task::spawn_blocking(move || {
            mod_file_info::load_mod_preview(source_key, mod_path, mod_icon_path, cached)
        })
        .await
        .map_err(|error| CommandError::new(CommandErrorCode::Internal, error.to_string()))??;

        tracing::info!(
            source_key = %loaded.dto.source_key,
            cache_hit,
            "mod preview loaded"
        );
        let mut state = self.write_state()?;
        state
            .mod_previews
            .insert(loaded.dto.source_key.clone(), loaded.cache);
        Ok(loaded.dto)
    }

    pub async fn load_mod_folder_size(
        &self,
        request: LoadModFolderSizeRequest,
    ) -> CommandResult<ModFolderSizeDto> {
        tracing::info!(source_key = %request.source_key, "loading mod folder size");
        let (source_key, mod_path, cached, canonical_source_roots) = {
            let state = self.read_state()?;
            let metadata = source_metadata_for_source_key(&state, &request.source_key)?;
            (
                request.source_key.clone(),
                metadata.mod_path.clone(),
                state
                    .mod_folder_sizes
                    .get(request.source_key.as_str())
                    .cloned(),
                canonical_source_roots_for_state(&state)?,
            )
        };

        ensure_mod_path_in_roots(&mod_path, &canonical_source_roots)?;
        let cache_hit = cached.is_some();
        let loaded = tokio::task::spawn_blocking(move || {
            mod_file_info::load_mod_folder_size(source_key, mod_path, cached)
        })
        .await
        .map_err(|error| CommandError::new(CommandErrorCode::Internal, error.to_string()))??;

        tracing::info!(
            source_key = %loaded.dto.source_key,
            folder_size_bytes = loaded.dto.folder_size_bytes,
            cache_hit,
            "mod folder size loaded"
        );
        let mut state = self.write_state()?;
        state
            .mod_folder_sizes
            .insert(loaded.dto.source_key.clone(), loaded.cache);
        Ok(loaded.dto)
    }

    pub async fn preview_mod_cleanup(
        &self,
        request: ModCleanupPreviewRequest,
    ) -> CommandResult<ModCleanupPreviewDto> {
        tracing::info!(kind = ?request.kind, "previewing mod cleanup");
        self.rebuild_mod_catalog().await?;
        let (catalog, roots) = {
            let state = self.read_state()?;
            (
                state.workspace.catalog().cloned().ok_or_else(|| {
                    CommandError::new(CommandErrorCode::StateMissing, "catalog is not loaded")
                })?,
                canonical_source_roots_for_state(&state)?,
            )
        };
        let candidates = cleanup_candidates(&catalog, request.kind, &roots).await?;
        tracing::info!(
            kind = ?request.kind,
            candidates = candidates.len(),
            "mod cleanup preview complete"
        );
        Ok(ModCleanupPreviewDto {
            kind: request.kind,
            candidates,
        })
    }

    pub async fn clean_mods(
        &self,
        request: CleanModsRequest,
    ) -> CommandResult<ModCleanupResultDto> {
        tracing::info!(
            kind = ?request.kind,
            requested = request.source_keys.len(),
            "cleaning mods"
        );
        let requested: Vec<String> = request.source_keys.into_iter().collect();
        let requested_set: HashSet<String> = requested.iter().cloned().collect();
        let (catalog, roots) = {
            let state = self.read_state()?;
            (
                state.workspace.catalog().cloned().ok_or_else(|| {
                    CommandError::new(CommandErrorCode::StateMissing, "catalog is not loaded")
                })?,
                canonical_source_roots_for_state(&state)?,
            )
        };

        let eligible = cleanup_candidates(&catalog, request.kind, &roots)
            .await?
            .into_iter()
            .filter(|candidate| requested_set.contains(&candidate.source_key))
            .map(|candidate| (candidate.source_key.clone(), candidate))
            .collect::<HashMap<_, _>>();

        let mut cleaned = Vec::new();
        let mut skipped = Vec::new();
        for source_key in requested {
            let Some(candidate) = eligible.get(&source_key).cloned() else {
                let path = catalog
                    .get_by_source_key(&ModSourceKey::new(source_key.as_str()))
                    .map(|metadata| metadata.source_key.as_str().to_string());
                skipped.push(ModCleanupSkippedDto {
                    source_key,
                    path,
                    message: "mod is no longer eligible for cleanup".to_string(),
                });
                continue;
            };

            let path = PathBuf::from(&candidate.path);
            match trash_mod_folder(path.clone()).await {
                Ok(()) => cleaned.push(candidate),
                Err(message) => skipped.push(ModCleanupSkippedDto {
                    source_key,
                    path: Some(path.to_string_lossy().into_owned()),
                    message,
                }),
            }
        }

        if !cleaned.is_empty() {
            self.clear_session_cache()?;
        }

        tracing::info!(
            kind = ?request.kind,
            cleaned = cleaned.len(),
            skipped = skipped.len(),
            "mod cleanup complete"
        );
        Ok(ModCleanupResultDto {
            kind: request.kind,
            cleaned,
            skipped,
        })
    }

    pub async fn load_active_list(&self) -> CommandResult<ActiveListLoadDto> {
        tracing::info!("loading active mod list");
        let roots = self.source_roots()?;
        let source = FsModSource::new(roots);
        let mut workspace = self.read_state()?.workspace.clone();
        let result = workspace
            .load_game_config(&source)
            .await
            .inspect_err(|e| tracing::error!(error = ?e, "active list load failed"))
            .map_err(error::core_error)?;
        let dto = dto::game_config_load(&result);
        tracing::info!(
            active_mods = dto.active_mods.len(),
            "active mod list loaded"
        );
        let mut state = self.write_state()?;
        state.workspace = workspace;
        Ok(dto)
    }

    pub fn resolve_mod_folder_path(&self, source_key: &str) -> CommandResult<PathBuf> {
        let state = self.read_state()?;
        let metadata = source_metadata_for_source_key(&state, source_key)?;
        let roots = canonical_source_roots_for_state(&state)?;
        ensure_mod_path_in_roots(&metadata.mod_path, &roots)?;
        Ok(metadata.mod_path)
    }

    pub fn resolve_steam_workshop_url(
        &self,
        request: OpenSteamWorkshopPageRequest,
    ) -> CommandResult<String> {
        tracing::debug!(source_key = %request.source_key, target = ?request.target, "resolving Steam Workshop URL");
        let state = self.read_state()?;
        let metadata = source_metadata_for_source_key(&state, &request.source_key)?;
        if metadata.source_kind != SourceKind::Workshop {
            return Err(CommandError::new(
                CommandErrorCode::PathInvalid,
                "sourceKey does not refer to a Steam Workshop mod",
            )
            .with_source_key(request.source_key));
        }
        let roots = canonical_source_roots_for_state(&state)?;
        ensure_mod_path_in_roots(&metadata.mod_path, &roots)?;
        let file_id = workshop_file_id_from_mod_path(&metadata.mod_path).ok_or_else(|| {
            CommandError::new(
                CommandErrorCode::PathInvalid,
                "Steam Workshop mod path does not end with a numeric Workshop file id",
            )
            .with_path(metadata.mod_path.clone())
        })?;
        let links = WorkshopLinks::new(file_id);
        Ok(match request.target {
            SteamWorkshopOpenTarget::SteamClient => links.steam_client_url(),
            SteamWorkshopOpenTarget::Web => links.web_url(),
        })
    }

    pub fn validate_active_order(
        &self,
        request: ValidateActiveOrderRequest,
    ) -> CommandResult<ValidateOrderDto> {
        tracing::info!(
            active_mods = request.active_mods.len(),
            "validating active order"
        );
        let result = self
            .read_state()?
            .workspace
            .validate_active_order(request.active_mods)
            .map_err(error::core_error)?;
        tracing::info!(
            errors = result.report.errors.len(),
            warnings = result.report.warnings.len(),
            infos = result.report.infos.len(),
            "active order validation complete"
        );
        Ok(dto::validate_order(&result))
    }

    pub async fn load_library(&self) -> CommandResult<LibraryDto> {
        tracing::info!("loading library");
        let data_dir = self.rimr_data_dir()?;
        let (active_mods, catalog) = {
            let state = self.read_state()?;
            (
                state
                    .workspace
                    .active_mods()
                    .as_ref()
                    .map(|list| dto::packages(list.as_slice())),
                state.workspace.catalog().cloned(),
            )
        };
        let store = JsonLibraryStore::new(data_dir.clone());
        let library = load_library(&store, active_mods.as_deref(), catalog.as_ref())
            .await
            .inspect_err(|e| tracing::error!(error = ?e, "library load failed"))
            .map_err(error::library_error)?;
        tracing::info!(
            mod_lists = library.mod_lists_index.mod_lists.len(),
            "library loaded"
        );
        Ok(dto::library_from_core(
            &library,
            &data_dir.display().to_string(),
        ))
    }

    pub async fn save_library_settings(
        &self,
        request: SaveLibrarySettingsRequest,
    ) -> CommandResult<LibrarySettingsDto> {
        tracing::info!("saving library settings");
        let data_dir = self.rimr_data_dir()?;
        let store = JsonLibraryStore::new(data_dir);
        let settings = dto::library_settings_to_core(&request.settings);
        store
            .save_settings(&settings)
            .await
            .inspect_err(|e| tracing::error!(error = ?e, "library settings save failed"))
            .map_err(error::library_error)?;
        Ok(request.settings)
    }

    pub async fn create_mod_list(
        &self,
        request: CreateModListRequest,
    ) -> CommandResult<ModListDto> {
        tracing::info!(name = %request.name, "creating mod list");
        let data_dir = self.rimr_data_dir()?;
        let catalog = self.read_state()?.workspace.catalog().cloned();
        let store = JsonLibraryStore::new(data_dir);
        let mod_list = create_mod_list(
            &store,
            request.name,
            request.base_mod_list.map(|dto| dto::mod_list_to_core(&dto)),
            catalog.as_ref(),
        )
        .await
        .inspect_err(|e| tracing::error!(error = ?e, "mod list creation failed"))
        .map_err(error::library_error)?;
        tracing::info!(mod_list_id = %mod_list.id, "mod list created");
        Ok(dto::mod_list_from_core(&mod_list))
    }

    pub async fn save_mod_list(&self, request: SaveModListRequest) -> CommandResult<ModListDto> {
        tracing::info!(mod_list_id = %request.mod_list.id, "saving mod list");
        let data_dir = self.rimr_data_dir()?;
        let store = JsonLibraryStore::new(data_dir);
        let mod_list = dto::mod_list_to_core(&request.mod_list);
        let saved = save_mod_list(&store, mod_list)
            .await
            .inspect_err(|e| tracing::error!(error = ?e, "mod list save failed"))
            .map_err(error::library_error)?;
        Ok(dto::mod_list_from_core(&saved))
    }

    pub async fn delete_mod_list(
        &self,
        request: DeleteModListRequest,
    ) -> CommandResult<ModListIndexDto> {
        tracing::info!(mod_list_id = %request.mod_list_id, "deleting mod list");
        let data_dir = self.rimr_data_dir()?;
        let store = JsonLibraryStore::new(data_dir);
        let index = delete_mod_list(&store, &request.mod_list_id)
            .await
            .inspect_err(|e| tracing::error!(error = ?e, "mod list deletion failed"))
            .map_err(error::library_error)?;
        Ok(dto::mod_list_index_from_core(&index))
    }

    pub async fn set_current_mod_list(
        &self,
        request: SetCurrentModListRequest,
    ) -> CommandResult<ModListDto> {
        tracing::info!(mod_list_id = %request.mod_list_id, "setting current mod list");
        let data_dir = self.rimr_data_dir()?;
        let store = JsonLibraryStore::new(data_dir);
        let mod_list = set_current_mod_list(&store, &request.mod_list_id)
            .await
            .inspect_err(|e| tracing::error!(error = ?e, "set current mod list failed"))
            .map_err(error::library_error)?;
        Ok(dto::mod_list_from_core(&mod_list))
    }

    pub async fn apply_mod_list_to_game(
        &self,
        request: ApplyModListRequest,
    ) -> CommandResult<ApplyModListDto> {
        tracing::info!(mod_list_id = %request.mod_list.id, "applying mod list to game");
        let mod_list = rimr_core::normalize_mod_list(dto::mod_list_to_core(&request.mod_list));
        let catalog = self.read_state()?.workspace.catalog().cloned();
        let projection = apply_projection(&mod_list.active_mods, catalog.as_ref());
        let saved = self
            .write_active_list_to_game(dto::active_list_from_strings(
                projection.active_mods.clone(),
            ))
            .await?;
        tracing::info!(
            mod_list_id = %mod_list.id,
            active_mods = saved.active_mods.len(),
            "mod list applied to game"
        );
        Ok(ApplyModListDto {
            mod_list_id: mod_list.id,
            active_mods: saved.active_mods,
            skipped_missing_packages: projection.skipped_missing_packages,
            config: saved.config,
        })
    }

    pub async fn export_game_config_backup(
        &self,
        request: ExportGameConfigBackupRequest,
    ) -> CommandResult<ExportGameConfigBackupDto> {
        tracing::info!(
            has_output_path = request.output_path.is_some(),
            "exporting game config backup"
        );
        let (list, config) = {
            let state = self.read_state()?;
            let list = state.workspace.active_mods().cloned().ok_or_else(|| {
                CommandError::new(
                    CommandErrorCode::StateMissing,
                    "active mod list is not loaded",
                )
            })?;
            let config = state.workspace.mods_config().cloned().ok_or_else(|| {
                CommandError::new(
                    CommandErrorCode::StateMissing,
                    "ModsConfig.xml is not loaded",
                )
            })?;
            (list, config)
        };
        let serializer = RimrFileSerializer::new(&AppClock);
        let result = serializer
            .export_game_config_backup(&list, &config, request.note)
            .inspect_err(|e| tracing::error!(error = ?e, "game config backup export failed"))
            .map_err(error::core_error)?;
        if let Some(path) = &request.output_path {
            write_text(path, &result.json).await?;
            tracing::info!(path = ?path, "game config backup written");
        }
        Ok(dto::export_game_config_backup(&result, request.output_path))
    }

    pub async fn import_game_config_backup(
        &self,
        request: ImportGameConfigBackupRequest,
    ) -> CommandResult<ImportGameConfigBackupDto> {
        tracing::info!(
            has_input_path = request.input_path.is_some(),
            has_json = request.json.is_some(),
            "importing game config backup"
        );
        let bytes = if let Some(json) = request.json {
            json.into_bytes()
        } else if let Some(path) = request.input_path {
            tokio::fs::read(&path).await.map_err(|error| {
                CommandError::new(CommandErrorCode::BackupInvalid, error.to_string())
                    .with_path(path)
            })?
        } else {
            return Err(CommandError::new(
                CommandErrorCode::BackupInvalid,
                "inputPath or json is required",
            ));
        };
        let serializer = RimrFileSerializer::new(&AppClock);
        let file = serializer
            .import_game_config_backup(&bytes)
            .inspect_err(|e| tracing::error!(error = ?e, "game config backup import failed"))
            .map_err(error::core_error)?;
        tracing::info!("game config backup imported");
        Ok(ImportGameConfigBackupDto {
            file: dto::game_config_backup(&file),
        })
    }

    pub async fn export_mod_list_file(
        &self,
        request: ExportModListFileRequest,
    ) -> CommandResult<ExportModListFileDto> {
        tracing::info!(
            mod_list_id = ?request.mod_list_id,
            has_output_path = request.output_path.is_some(),
            "exporting mod list file"
        );
        let data_dir = self.rimr_data_dir()?;
        let store = JsonLibraryStore::new(data_dir);
        let index = store
            .load_mod_list_index()
            .await
            .map_err(error::library_error)?;
        let mod_list_id = request
            .mod_list_id
            .or(index.current_mod_list_id)
            .or_else(|| index.mod_lists.first().map(|s| s.id.clone()))
            .ok_or_else(|| {
                CommandError::new(CommandErrorCode::StateMissing, "no mod list exists")
            })?;
        let mod_list = store
            .read_mod_list(&mod_list_id)
            .await
            .map_err(error::library_error)?;
        let game_version = self
            .read_state()?
            .workspace
            .mods_config()
            .map(|config| config.version.to_string());
        let serializer = RimrFileSerializer::new(&AppClock);
        let exported = serializer
            .export_mod_list(&mod_list, game_version)
            .map_err(error::core_error)?;
        let file = dto::mod_list_file_from_core(&exported.file);
        let json = exported.json;
        if let Some(path) = &request.output_path {
            write_text(path, &json).await?;
            tracing::info!(path = ?path, "mod list file written");
        }
        Ok(ExportModListFileDto {
            file,
            json,
            output_path: request.output_path,
        })
    }

    pub async fn import_mod_list_file(
        &self,
        request: ImportModListFileRequest,
    ) -> CommandResult<ModListDto> {
        tracing::info!(
            has_input_path = request.input_path.is_some(),
            has_json = request.json.is_some(),
            "importing mod list file"
        );
        let bytes = read_import_input(request.input_path, request.json).await?;
        let serializer = RimrFileSerializer::new(&AppClock);
        let file = serializer
            .import_mod_list(&bytes)
            .map_err(error::core_error)?;
        let data_dir = self.rimr_data_dir()?;
        let store = JsonLibraryStore::new(data_dir);
        let imported = import_mod_list(&store, file.mod_list)
            .await
            .inspect_err(|e| tracing::error!(error = ?e, "mod list import failed"))
            .map_err(error::library_error)?;
        tracing::info!(mod_list_id = %imported.id, "mod list imported");
        Ok(dto::mod_list_from_core(&imported))
    }

    pub async fn export_library_settings_file(
        &self,
        request: ExportLibrarySettingsFileRequest,
    ) -> CommandResult<ExportLibrarySettingsFileDto> {
        tracing::info!(
            has_output_path = request.output_path.is_some(),
            "exporting library settings file"
        );
        let data_dir = self.rimr_data_dir()?;
        let store = JsonLibraryStore::new(data_dir);
        let settings = store.load_settings().await.map_err(error::library_error)?;
        let serializer = RimrFileSerializer::new(&AppClock);
        let exported = serializer
            .export_library_settings(&settings)
            .map_err(error::core_error)?;
        let file = dto::library_settings_file_from_core(&exported.file);
        let json = exported.json;
        if let Some(path) = &request.output_path {
            write_text(path, &json).await?;
            tracing::info!(path = ?path, "library settings file written");
        }
        Ok(ExportLibrarySettingsFileDto {
            file,
            json,
            output_path: request.output_path,
        })
    }

    pub async fn import_library_settings_file(
        &self,
        request: ImportLibrarySettingsFileRequest,
    ) -> CommandResult<LibrarySettingsDto> {
        tracing::info!(
            has_input_path = request.input_path.is_some(),
            has_json = request.json.is_some(),
            "importing library settings file"
        );
        let bytes = read_import_input(request.input_path, request.json).await?;
        let serializer = RimrFileSerializer::new(&AppClock);
        let file = serializer
            .import_library_settings(&bytes)
            .map_err(error::core_error)?;
        let data_dir = self.rimr_data_dir()?;
        let store = JsonLibraryStore::new(data_dir);
        let current = store.load_settings().await.map_err(error::library_error)?;
        let merged = core_merge_library_settings(current, file.settings);
        store
            .save_settings(&merged)
            .await
            .inspect_err(|e| tracing::error!(error = ?e, "library settings import save failed"))
            .map_err(error::library_error)?;
        tracing::info!(aliases = merged.aliases.len(), "library settings imported");
        Ok(dto::library_settings_from_core(&merged))
    }

    pub async fn load_steam_workshop_log(&self) -> CommandResult<SteamWorkshopLogDto> {
        tracing::info!("loading Steam workshop log");

        let steam_dirs = steamlocate::locate_all().unwrap_or_default();
        let mut acf_path: Option<PathBuf> = None;

        for steam_dir in &steam_dirs {
            if let Ok(Some((_, library))) = steam_dir.find_app(rimr_steam::RIMWORLD_APP_ID) {
                acf_path = Some(appworkshop_acf_path(library.path()));
                break;
            }
        }

        if acf_path.is_none()
            && let Some(workshop_dir) = self.get_config()?.paths.workshop_mods_dir.as_ref()
        {
            let steamapps = workshop_dir
                .ancestors()
                .find(|p| p.file_name().is_some_and(|n| n == "steamapps"));
            if let Some(steamapps) = steamapps
                && let Some(library_root) = steamapps.parent()
            {
                acf_path = Some(appworkshop_acf_path(library_root));
            }
        }

        let acf_path = match acf_path {
            Some(p) => p,
            None => {
                tracing::info!("no Steam library with RimWorld found");
                return Ok(SteamWorkshopLogDto {
                    entries: Vec::new(),
                    acf_path: String::new(),
                    total_installed: 0,
                    found: false,
                });
            }
        };

        tracing::info!(path = ?acf_path, "reading ACF file");
        let content = match tokio::fs::read_to_string(&acf_path).await {
            Ok(content) => content,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                tracing::info!(path = ?acf_path, "ACF file not found");
                return Ok(SteamWorkshopLogDto {
                    entries: Vec::new(),
                    acf_path: acf_path.to_string_lossy().into_owned(),
                    total_installed: 0,
                    found: false,
                });
            }
            Err(e) => {
                return Err(CommandError::new(
                    CommandErrorCode::SourceIo,
                    format!("failed to read ACF file: {e}"),
                )
                .with_path(acf_path));
            }
        };

        let entries = parse_appworkshop_acf(&content).map_err(|e| {
            CommandError::new(
                CommandErrorCode::Internal,
                format!("failed to parse ACF: {e}"),
            )
        })?;

        let catalog = self.read_state()?.workspace.catalog().cloned();
        let pfid_lookup: HashMap<String, (Option<String>, Option<String>)> =
            if let Some(catalog) = catalog.as_ref() {
                catalog
                    .iter()
                    .filter(|(_, m)| m.source_kind == SourceKind::Workshop)
                    .filter_map(|(_, m)| {
                        let pfid = workshop_file_id_from_mod_path(m.source_key.as_str())?;
                        Some((
                            pfid.as_str().to_string(),
                            (
                                m.name.as_deref().map(str::to_string),
                                Some(m.package_id.as_str().to_string()),
                            ),
                        ))
                    })
                    .collect()
            } else {
                HashMap::new()
            };

        let total_installed = entries.len() as u32;
        let dto_entries: Vec<SteamWorkshopLogEntryDto> = entries
            .into_iter()
            .map(|e| {
                let (mod_name, package_id) = pfid_lookup
                    .get(&e.published_file_id)
                    .cloned()
                    .unwrap_or((None, None));
                SteamWorkshopLogEntryDto {
                    published_file_id: e.published_file_id,
                    mod_name,
                    package_id,
                    time_updated_ms: e.time_updated * 1000,
                    time_touched_ms: e.time_touched * 1000,
                    has_manifest: e.has_manifest,
                }
            })
            .collect();

        tracing::info!(
            entries = dto_entries.len(),
            found = true,
            "Steam workshop log loaded"
        );

        Ok(SteamWorkshopLogDto {
            entries: dto_entries,
            acf_path: acf_path.to_string_lossy().into_owned(),
            total_installed,
            found: true,
        })
    }

    pub async fn load_player_log(
        &self,
        request: LoadPlayerLogRequest,
    ) -> CommandResult<PlayerLogDto> {
        use crate::player_log::{self, LogSource};

        let source = match request.source {
            LogSourceDto::PlayerLog => LogSource::PlayerLog,
            LogSourceDto::PlayerPrevLog => LogSource::PlayerPrevLog,
        };

        tracing::info!(source = source.file_name(), "loading player log");

        let game_data_dir = self.get_config()?.paths.game_data_dir.ok_or_else(|| {
            CommandError::new(
                CommandErrorCode::PathNotConfigured,
                "gameDataDir is not configured",
            )
        })?;

        let log_path = game_data_dir.join(source.file_name());

        let (content, metadata) = tokio::task::spawn_blocking({
            let log_path = log_path.clone();
            move || -> std::io::Result<(String, std::fs::Metadata)> {
                let content = std::fs::read_to_string(&log_path)?;
                let metadata = std::fs::metadata(&log_path)?;
                Ok((content, metadata))
            }
        })
        .await
        .map_err(|e| CommandError::new(CommandErrorCode::Internal, e.to_string()))?
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                CommandError::new(
                    CommandErrorCode::PathInvalid,
                    format!("{} not found", source.file_name()),
                )
                .with_path(log_path.clone())
            } else {
                CommandError::new(CommandErrorCode::SourceIo, e.to_string())
                    .with_path(log_path.clone())
            }
        })?;

        let file_size_bytes = metadata.len();
        let modified_at_ms = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis().min(u128::from(u64::MAX)) as u64)
            .unwrap_or(0);

        let result = player_log::parse_player_log(&content, source);

        let dto = PlayerLogDto {
            entries: result
                .entries
                .into_iter()
                .map(|e| LogEntryDto {
                    line_number: e.line_number,
                    level: match e.level {
                        player_log::LogLevel::Info => LogLevelDto::Info,
                        player_log::LogLevel::Warning => LogLevelDto::Warning,
                        player_log::LogLevel::Error => LogLevelDto::Error,
                        player_log::LogLevel::Exception => LogLevelDto::Exception,
                    },
                    text: e.text,
                    is_stack_trace: e.is_stack_trace,
                    ref_id: e.ref_id,
                    duplicate_ref: e.duplicate_ref,
                })
                .collect(),
            total_lines: result.total_lines,
            error_count: result.error_count,
            warning_count: result.warning_count,
            exception_count: result.exception_count,
            source: request.source,
            file_path: log_path.to_string_lossy().into_owned(),
            file_size_bytes,
            modified_at_ms,
        };

        tracing::info!(
            total_lines = dto.total_lines,
            errors = dto.error_count,
            warnings = dto.warning_count,
            exceptions = dto.exception_count,
            "player log loaded"
        );

        Ok(dto)
    }

    fn with_config(config_path: PathBuf, config: AppConfig) -> Self {
        Self {
            config_path,
            inner: RwLock::new(SessionState {
                config,
                workspace: WorkspaceSession::default(),
                canonical_source_roots: None,
                mod_previews: HashMap::new(),
                mod_folder_sizes: HashMap::new(),
            }),
        }
    }

    fn source_roots(&self) -> CommandResult<SourceRoots> {
        let config = self.get_config()?;
        Ok(SourceRoots {
            game_dir: required_path(config.paths.game_dir, "gameDir")?,
            data_dir: required_path(config.paths.game_data_dir, "gameDataDir")?,
            local_mods_dir: config.paths.local_mods_dir,
            workshop_mods_dir: config.paths.workshop_mods_dir,
        })
    }

    fn rimr_data_dir(&self) -> CommandResult<PathBuf> {
        let config = self.get_config()?;
        config
            .paths
            .rimr_data_dir
            .or_else(default_data_dir)
            .ok_or_else(|| {
                CommandError::new(
                    CommandErrorCode::PathNotConfigured,
                    "rimrDataDir is not configured",
                )
            })
    }

    async fn write_active_list_to_game(
        &self,
        list: ActiveModList,
    ) -> CommandResult<ActiveListWriteDto> {
        tracing::info!(
            active_mods = list.as_slice().len(),
            "writing active list to game"
        );
        let roots = self.source_roots()?;
        let source = FsModSource::new(roots);
        let active_mods = dto::packages(list.as_slice());
        let mut workspace = self.read_state()?.workspace.clone();
        let written = workspace
            .write_game_config(&source, active_mods)
            .await
            .inspect_err(|e| tracing::error!(error = ?e, "mods config write failed"))
            .map_err(error::core_error)?;
        tracing::info!("mods config written");

        let dto = ActiveListWriteDto {
            active_mods: written.active_mods,
            config: dto::mods_config(&written.config),
        };
        let mut state = self.write_state()?;
        state.workspace = workspace;
        Ok(dto)
    }

    fn read_state(&self) -> CommandResult<std::sync::RwLockReadGuard<'_, SessionState>> {
        self.inner.read().map_err(|_| {
            CommandError::new(
                CommandErrorCode::Internal,
                "application state lock is poisoned",
            )
        })
    }

    fn write_state(&self) -> CommandResult<std::sync::RwLockWriteGuard<'_, SessionState>> {
        self.inner.write().map_err(|_| {
            CommandError::new(
                CommandErrorCode::Internal,
                "application state lock is poisoned",
            )
        })
    }
}

async fn cleanup_candidates(
    catalog: &ModCatalog,
    kind: ModCleanupKindDto,
    roots: &CanonicalSourceRoots,
) -> CommandResult<Vec<ModCleanupCandidateDto>> {
    let mut candidates = Vec::new();
    for (_, metadata) in catalog.iter() {
        if let Some(candidate) = cleanup_candidate(metadata, kind, roots).await? {
            candidates.push(candidate);
        }
    }
    candidates.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(candidates)
}

async fn cleanup_candidate(
    metadata: &ModMetadata,
    kind: ModCleanupKindDto,
    roots: &CanonicalSourceRoots,
) -> CommandResult<Option<ModCleanupCandidateDto>> {
    if metadata.valid {
        return Ok(None);
    }
    if !matches!(
        metadata.source_kind,
        SourceKind::Local | SourceKind::Workshop
    ) {
        return Ok(None);
    }

    let mod_path = PathBuf::from(metadata.source_key.as_str());
    ensure_mod_path_in_roots(&mod_path, roots)?;
    let file_count = match kind {
        ModCleanupKindDto::Invalid => count_regular_files(mod_path.clone()).await?,
        ModCleanupKindDto::TextureOnlyInvalid => {
            let Some(file_count) = texture_only_file_count(mod_path.clone()).await? else {
                return Ok(None);
            };
            file_count
        }
    };

    Ok(Some(ModCleanupCandidateDto {
        source_key: metadata.source_key.as_str().to_string(),
        source_kind: dto::source_kind(metadata.source_kind),
        path: mod_path.to_string_lossy().into_owned(),
        package_id: metadata.package_id.as_str().to_string(),
        name: metadata.name.as_deref().map(str::to_string),
        reason: match kind {
            ModCleanupKindDto::TextureOnlyInvalid => ModCleanupReasonDto::TextureOnlyInvalid,
            ModCleanupKindDto::Invalid => ModCleanupReasonDto::InvalidMetadata,
        },
        file_count,
    }))
}

async fn count_regular_files(path: PathBuf) -> CommandResult<u64> {
    tokio::task::spawn_blocking(move || count_regular_files_blocking(&path))
        .await
        .map_err(|error| CommandError::new(CommandErrorCode::Internal, error.to_string()))?
        .map_err(command_source_io)
}

async fn texture_only_file_count(path: PathBuf) -> CommandResult<Option<u64>> {
    tokio::task::spawn_blocking(move || texture_only_file_count_blocking(&path))
        .await
        .map_err(|error| CommandError::new(CommandErrorCode::Internal, error.to_string()))?
        .map_err(command_source_io)
}

fn count_regular_files_blocking(path: &Path) -> std::io::Result<u64> {
    let mut count = 0;
    let mut stack = vec![path.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            let file_type = entry.file_type()?;
            if file_type.is_dir() {
                stack.push(entry.path());
            } else if file_type.is_file() {
                count += 1;
            }
        }
    }
    Ok(count)
}

fn texture_only_file_count_blocking(path: &Path) -> std::io::Result<Option<u64>> {
    let mut count = 0;
    let mut stack = vec![path.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            let file_type = entry.file_type()?;
            if file_type.is_symlink() {
                return Ok(None);
            }
            if file_type.is_dir() {
                stack.push(entry.path());
            } else if file_type.is_file() {
                if !is_texture_residue_file(&entry.path()) {
                    return Ok(None);
                }
                count += 1;
            } else {
                return Ok(None);
            }
        }
    }
    Ok((count > 0).then_some(count))
}

fn is_texture_residue_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("dds") || extension.eq_ignore_ascii_case("zstd")
        })
}

async fn trash_mod_folder(path: PathBuf) -> Result<(), String> {
    tokio::task::spawn_blocking(move || trash::delete(&path))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}

fn command_source_io(error: std::io::Error) -> CommandError {
    CommandError::new(CommandErrorCode::SourceIo, error.to_string())
}

#[derive(Debug, Clone)]
struct ApplyProjection {
    active_mods: Vec<String>,
    skipped_missing_packages: Vec<String>,
}

fn apply_projection(active_mods: &[String], catalog: Option<&ModCatalog>) -> ApplyProjection {
    let Some(catalog) = catalog else {
        return ApplyProjection {
            active_mods: active_mods.to_vec(),
            skipped_missing_packages: Vec::new(),
        };
    };
    let mut writeable = Vec::new();
    let mut skipped = Vec::new();
    for package_id in active_mods {
        if catalog.contains(&PackageId::new(package_id)) {
            writeable.push(package_id.clone());
        } else {
            skipped.push(package_id.clone());
        }
    }
    ApplyProjection {
        active_mods: writeable,
        skipped_missing_packages: skipped,
    }
}

fn source_metadata_for_source_key(
    state: &SessionState,
    source_key: &str,
) -> CommandResult<SourceMetadataIndexEntry> {
    let catalog = state.workspace.catalog().ok_or_else(|| {
        CommandError::new(CommandErrorCode::StateMissing, "catalog is not loaded")
    })?;
    catalog
        .get_by_source_key(&ModSourceKey::new(source_key))
        .map(|metadata| SourceMetadataIndexEntry {
            mod_path: PathBuf::from(metadata.source_key.as_str()),
            source_kind: metadata.source_kind,
            mod_icon_path: metadata.mod_icon_path.as_deref().map(str::to_string),
        })
        .ok_or_else(|| {
            CommandError::new(
                CommandErrorCode::PathInvalid,
                "sourceKey is not in the current catalog",
            )
            .with_source_key(source_key.to_string())
        })
}

fn canonical_source_roots_for_state(state: &SessionState) -> CommandResult<CanonicalSourceRoots> {
    state
        .canonical_source_roots
        .clone()
        .ok_or_else(|| CommandError::new(CommandErrorCode::StateMissing, "catalog is not loaded"))
}

fn canonical_source_roots(roots: &SourceRoots) -> CanonicalSourceRoots {
    let roots = [
        Some(roots.game_dir.join("Data")),
        roots.local_mods_dir.clone(),
        roots.workshop_mods_dir.clone(),
    ]
    .into_iter()
    .flatten()
    .filter_map(|root| std::fs::canonicalize(root).ok())
    .collect();
    CanonicalSourceRoots { roots }
}

fn ensure_mod_path_in_roots(mod_path: &Path, roots: &CanonicalSourceRoots) -> CommandResult<()> {
    let mod_path = canonicalize_for_check(mod_path)?;
    for root in &roots.roots {
        if mod_path.starts_with(root) {
            return Ok(());
        }
    }
    Err(CommandError::new(
        CommandErrorCode::PathInvalid,
        "sourceKey is outside configured mod roots",
    )
    .with_path(mod_path))
}

fn canonicalize_for_check(path: &Path) -> CommandResult<PathBuf> {
    std::fs::canonicalize(path).map_err(|error| {
        CommandError::new(CommandErrorCode::PathInvalid, error.to_string())
            .with_path(path.to_path_buf())
    })
}

async fn read_import_input(
    input_path: Option<PathBuf>,
    json: Option<String>,
) -> CommandResult<Vec<u8>> {
    if let Some(json) = json {
        return Ok(json.into_bytes());
    }
    if let Some(path) = input_path {
        return tokio::fs::read(&path).await.map_err(|error| {
            CommandError::new(CommandErrorCode::Json, error.to_string()).with_path(path)
        });
    }
    Err(CommandError::new(
        CommandErrorCode::Json,
        "inputPath or json is required",
    ))
}

fn required_path(path: Option<PathBuf>, field: &str) -> CommandResult<PathBuf> {
    path.ok_or_else(|| {
        CommandError::new(
            CommandErrorCode::PathNotConfigured,
            format!("{field} is not configured"),
        )
    })
}

fn command_config_write_error(error: ConfigFileError) -> CommandError {
    match error {
        ConfigFileError::Read { path, source } => {
            CommandError::new(CommandErrorCode::ConfigReadFailed, source.to_string())
                .with_path(path)
        }
        ConfigFileError::Parse { path, source } => {
            CommandError::new(CommandErrorCode::ConfigReadFailed, source.to_string())
                .with_path(path)
        }
        ConfigFileError::Write { path, source } => {
            CommandError::new(CommandErrorCode::ConfigWriteFailed, source.to_string())
                .with_path(path)
        }
        ConfigFileError::Serialize(error) => {
            CommandError::new(CommandErrorCode::ConfigWriteFailed, error.to_string())
        }
        ConfigFileError::Migrate { path, source } => {
            CommandError::new(CommandErrorCode::ConfigReadFailed, source.to_string())
                .with_path(path)
        }
    }
}

async fn write_text(path: &Path, text: &str) -> CommandResult<()> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|error| {
            CommandError::new(CommandErrorCode::BackupInvalid, error.to_string())
                .with_path(parent.to_path_buf())
        })?;
    }
    tokio::fs::write(path, text).await.map_err(|error| {
        CommandError::new(CommandErrorCode::BackupInvalid, error.to_string())
            .with_path(path.to_path_buf())
    })
}
