use std::path::{Path, PathBuf};

use rimr_core::{
    ActiveModList, AppClock, LibraryStore, ModCatalog, PackageId, RimrFileSerializer,
    create_mod_list, delete_mod_list, import_mod_list, load_library,
    merge_library_settings as core_merge_library_settings, save_mod_list, set_current_mod_list,
};

use super::AppState;
use crate::{
    dto::{
        self, ActiveListLoadDto, ActiveListWriteDto, ApplyModListDto, ApplyModListRequest,
        CreateModListRequest, DeleteModListRequest, ExportGameConfigBackupDto,
        ExportGameConfigBackupRequest, ExportLibrarySettingsFileDto,
        ExportLibrarySettingsFileRequest, ExportModListFileDto, ExportModListFileRequest,
        ImportGameConfigBackupDto, ImportGameConfigBackupRequest, ImportLibrarySettingsFileRequest,
        ImportModListFileRequest, LibraryDto, LibrarySettingsDto, ModListDto, ModListIndexDto,
        SaveLibrarySettingsRequest, SaveModListRequest, SetCurrentModListRequest,
        ValidateActiveOrderRequest, ValidateOrderDto,
    },
    error::{self, CommandError, CommandErrorCode, CommandResult},
    library_store::JsonLibraryStore,
    source::FsModSource,
};

impl AppState {
    /// Loads the game configuration into the current session.
    ///
    /// # Errors
    /// Returns an error if paths are missing, the configuration cannot be loaded, or session access fails.
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

    /// Validates the requested order against the current catalog.
    ///
    /// # Errors
    /// Returns an error if session access fails or the catalog is unavailable.
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

    /// Loads the local library, creating its initial mod list when needed.
    ///
    /// # Errors
    /// Returns an error if paths or initial active mods are missing, storage fails, or session access fails.
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

    /// Saves local library preferences.
    ///
    /// # Errors
    /// Returns an error if the data directory is unavailable or settings cannot be written.
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

    /// Creates a stored mod list from the requested base.
    ///
    /// # Errors
    /// Returns an error if the data directory, catalog access, or library storage fails.
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

    /// Saves changes to a stored mod list.
    ///
    /// # Errors
    /// Returns an error if the data directory is unavailable or saving fails.
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

    /// Deletes a stored mod list and updates the index.
    ///
    /// # Errors
    /// Returns an error if the data directory is unavailable or the list cannot be deleted.
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

    /// Selects a stored mod list as current.
    ///
    /// # Errors
    /// Returns an error if the data directory, requested list, or library index is unavailable.
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

    /// Applies the requested draft order, skipping packages absent from the catalog.
    ///
    /// # Errors
    /// Returns an error if session access, path resolution, or writing the game configuration fails.
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

    /// Serializes the loaded game configuration and optionally writes a backup file.
    ///
    /// # Errors
    /// Returns an error if configuration is not loaded, session access fails, or export or file writing fails.
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

    /// Reads and validates an imported game configuration backup.
    ///
    /// # Errors
    /// Returns an error if input is missing, unreadable, or not a valid backup.
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

    /// Serializes a stored mod list and optionally writes its portable file.
    ///
    /// # Errors
    /// Returns an error if the data directory, stored list, serialization, or output file is unavailable.
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

    /// Imports a portable mod list into local storage.
    ///
    /// # Errors
    /// Returns an error if input is missing or invalid, the data directory is unavailable, or storage fails.
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

    /// Serializes local settings and optionally writes their portable file.
    ///
    /// # Errors
    /// Returns an error if the data directory, settings, serialization, or output file is unavailable.
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

    /// Merges imported settings into the local library.
    ///
    /// # Errors
    /// Returns an error if input is missing or invalid, the data directory is unavailable, or storage fails.
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
