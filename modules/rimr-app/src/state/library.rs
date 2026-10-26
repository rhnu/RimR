use std::path::{Path, PathBuf};

use rimr_core::{
    ActiveModList, ModCatalog, PackageId, flatten_active_mods,
    merge_library_settings as core_merge_library_settings,
};

use super::AppState;
use crate::{
    AppClock, RimrFileSerializer, current,
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
    error::{AppError, AppErrorCode, AppResult},
    services::{
        create_mod_list, delete_mod_list, import_mod_list, load_library, save_mod_list,
        set_current_mod_list,
    },
    source::FsModSource,
};

impl AppState {
    /// Loads the game configuration into the current session.
    ///
    /// # Errors
    /// Returns an error if paths are missing, the configuration cannot be loaded, or session access fails.
    pub async fn load_active_list(&self) -> AppResult<ActiveListLoadDto> {
        let _operation = self.operations.lock().await;
        tracing::info!("loading active mod list");
        let roots = self.source_roots()?;
        let source = FsModSource::new(roots);
        let catalog = self.read_state()?.workspace.catalog().cloned();
        let result = crate::services::load_active_list(&source, catalog.as_ref()).await?;
        let dto = dto::active_load(&result);
        tracing::info!(
            active_mods = dto.active_mods.len(),
            "active mod list loaded"
        );
        let mut state = self.write_state()?;
        state.workspace.replace_game_config(result.config);
        Ok(dto)
    }

    /// Validates the requested order against the current catalog.
    ///
    /// # Errors
    /// Returns an error if session access fails or the catalog is unavailable.
    pub fn validate_active_order(
        &self,
        request: ValidateActiveOrderRequest,
    ) -> AppResult<ValidateOrderDto> {
        tracing::info!(
            active_mods = request.active_mods.len(),
            "validating active order"
        );
        let result = self
            .read_state()?
            .workspace
            .validate_active_order(request.active_mods)?;
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
    pub async fn load_library(&self) -> AppResult<LibraryDto> {
        let _operation = self.operations.lock().await;
        let data_dir = self.rimr_data_dir()?;
        let (active, catalog) = {
            let state = self.read_state()?;
            (
                state
                    .workspace
                    .active_mods()
                    .map(|list| dto::packages(list.as_slice())),
                state.workspace.catalog().cloned(),
            )
        };
        let mut candidate = current::load_library(&data_dir)?;
        let was_empty = candidate.mod_lists.is_empty();
        let library = load_library(&mut candidate, active.as_deref(), catalog.as_ref())?;
        if was_empty {
            current::save_library(&data_dir, &candidate)?;
        }
        Ok(dto::library_from_core(
            &library,
            &data_dir.display().to_string(),
        ))
    }

    /// # Errors
    /// Returns a conflict for stale settings or an error if committing the snapshot fails.
    pub async fn save_library_settings(
        &self,
        request: SaveLibrarySettingsRequest,
    ) -> AppResult<LibrarySettingsDto> {
        let _operation = self.operations.lock().await;
        let data_dir = self.rimr_data_dir()?;
        let mut candidate = current::load_library(&data_dir)?;
        let mut settings = dto::library_settings_to_core(&request.settings)?;
        if settings.revision != candidate.settings.revision {
            return Err(AppError::new(
                AppErrorCode::Conflict,
                "library settings have changed; reload before saving",
            ));
        }
        settings.revision = settings
            .revision
            .checked_add(1)
            .ok_or_else(|| AppError::new(AppErrorCode::Internal, "settings revision exhausted"))?;
        candidate.settings = settings.clone();
        current::save_library(&data_dir, &candidate)?;
        Ok(dto::library_settings_from_core(&settings))
    }

    /// # Errors
    /// Returns a source, parsing, validation, or state error if the operation cannot complete.
    pub async fn create_mod_list(&self, request: CreateModListRequest) -> AppResult<ModListDto> {
        let _operation = self.operations.lock().await;
        let data_dir = self.rimr_data_dir()?;
        let catalog = self.read_state()?.workspace.catalog().cloned();
        let mut candidate = current::load_library(&data_dir)?;
        let base = request
            .base_mod_list
            .map(|list| dto::mod_list_to_core(&list))
            .transpose()?;
        let list = create_mod_list(&mut candidate, request.name, base, catalog.as_ref());
        current::save_library(&data_dir, &candidate)?;
        Ok(dto::mod_list_from_core(&list))
    }

    /// # Errors
    /// Returns a source, parsing, validation, or state error if the operation cannot complete.
    pub async fn save_mod_list(&self, request: SaveModListRequest) -> AppResult<ModListDto> {
        let _operation = self.operations.lock().await;
        let data_dir = self.rimr_data_dir()?;
        let mut candidate = current::load_library(&data_dir)?;
        let list = save_mod_list(&mut candidate, dto::mod_list_to_core(&request.mod_list)?)?;
        current::save_library(&data_dir, &candidate)?;
        Ok(dto::mod_list_from_core(&list))
    }

    /// # Errors
    /// Returns a source, parsing, validation, or state error if the operation cannot complete.
    pub async fn delete_mod_list(
        &self,
        request: DeleteModListRequest,
    ) -> AppResult<ModListIndexDto> {
        let _operation = self.operations.lock().await;
        let data_dir = self.rimr_data_dir()?;
        let mut candidate = current::load_library(&data_dir)?;
        let index = delete_mod_list(&mut candidate, request.mod_list_id.parse()?)?;
        current::save_library(&data_dir, &candidate)?;
        Ok(dto::mod_list_index_from_core(&index))
    }

    /// # Errors
    /// Returns a source, parsing, validation, or state error if the operation cannot complete.
    pub async fn set_current_mod_list(
        &self,
        request: SetCurrentModListRequest,
    ) -> AppResult<ModListDto> {
        let _operation = self.operations.lock().await;
        let data_dir = self.rimr_data_dir()?;
        let mut candidate = current::load_library(&data_dir)?;
        let list = set_current_mod_list(&mut candidate, request.mod_list_id.parse()?)?;
        current::save_library(&data_dir, &candidate)?;
        Ok(dto::mod_list_from_core(&list))
    }

    /// Applies the requested draft order, skipping packages absent from the catalog.
    ///
    /// # Errors
    /// Returns an error if session access, path resolution, or writing the game configuration fails.
    pub async fn apply_mod_list_to_game(
        &self,
        request: ApplyModListRequest,
    ) -> AppResult<ApplyModListDto> {
        tracing::info!(mod_list_id = %request.mod_list.id, "applying mod list to game");
        let _operation = self.operations.lock().await;
        let mod_list = dto::mod_list_to_core(&request.mod_list)?;
        let projection = {
            let state = self.read_state()?;
            let catalog = state.workspace.catalog().ok_or_else(|| {
                AppError::new(AppErrorCode::StateMissing, "catalog is not loaded")
            })?;
            apply_projection(&flatten_active_mods(&mod_list.entries), catalog)
        };
        let saved = self
            .write_active_list_to_game(dto::active_list_from_strings(projection.active_mods))
            .await?;
        tracing::info!(
            mod_list_id = %mod_list.id,
            active_mods = saved.active_mods.len(),
            "mod list applied to game"
        );
        Ok(ApplyModListDto {
            mod_list_id: mod_list.id.to_string(),
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
    ) -> AppResult<ExportGameConfigBackupDto> {
        tracing::info!(
            has_output_path = request.output_path.is_some(),
            "exporting game config backup"
        );
        let (list, config) = {
            let state = self.read_state()?;
            let list = state.workspace.active_mods().cloned().ok_or_else(|| {
                AppError::new(AppErrorCode::StateMissing, "active mod list is not loaded")
            })?;
            let config = state.workspace.mods_config().cloned().ok_or_else(|| {
                AppError::new(AppErrorCode::StateMissing, "ModsConfig.xml is not loaded")
            })?;
            (list, config)
        };
        let serializer = RimrFileSerializer::new(&AppClock);
        let result = serializer.export_game_config_backup(&list, &config, request.note)?;
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
    ) -> AppResult<ImportGameConfigBackupDto> {
        tracing::info!(
            has_input_path = request.input_path.is_some(),
            has_json = request.json.is_some(),
            "importing game config backup"
        );
        let bytes = if let Some(json) = request.json {
            json.into_bytes()
        } else if let Some(path) = request.input_path {
            tokio::fs::read(&path).await.map_err(|error| {
                AppError::new(AppErrorCode::BackupInvalid, "operation failed")
                    .with_source(error)
                    .with_path(path)
            })?
        } else {
            return Err(AppError::new(
                AppErrorCode::BackupInvalid,
                "inputPath or json is required",
            ));
        };
        let serializer = RimrFileSerializer::new(&AppClock);
        let file = serializer.import_game_config_backup(&bytes)?;
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
    ) -> AppResult<ExportModListFileDto> {
        tracing::info!(
            mod_list_id = ?request.mod_list_id,
            has_output_path = request.output_path.is_some(),
            "exporting mod list file"
        );
        let _operation = self.operations.lock().await;
        let data_dir = self.rimr_data_dir()?;
        let snapshot = current::load_library(&data_dir)?;
        let index = snapshot.index();
        let mod_list_id = request
            .mod_list_id
            .map(|id| id.parse())
            .transpose()?
            .or(index.current_mod_list_id)
            .or_else(|| index.mod_lists.first().map(|s| s.id))
            .ok_or_else(|| AppError::new(AppErrorCode::StateMissing, "no mod list exists"))?;
        let mod_list = snapshot
            .mod_lists
            .iter()
            .find(|list| list.id == mod_list_id)
            .ok_or_else(|| {
                AppError::new(AppErrorCode::StateMissing, "mod list no longer exists")
            })?;
        let game_version = self
            .read_state()?
            .workspace
            .mods_config()
            .map(|config| config.version.to_string());
        let serializer = RimrFileSerializer::new(&AppClock);
        let exported = serializer.export_mod_list(mod_list, game_version)?;
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
    ) -> AppResult<ModListDto> {
        let _operation = self.operations.lock().await;
        tracing::info!(
            has_input_path = request.input_path.is_some(),
            has_json = request.json.is_some(),
            "importing mod list file"
        );
        let bytes = read_import_input(request.input_path, request.json).await?;
        let serializer = RimrFileSerializer::new(&AppClock);
        let file = serializer.import_mod_list(&bytes)?;
        let data_dir = self.rimr_data_dir()?;
        let mut candidate = current::load_library(&data_dir)?;
        let imported = import_mod_list(&mut candidate, file.mod_list);
        current::save_library(&data_dir, &candidate)?;
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
    ) -> AppResult<ExportLibrarySettingsFileDto> {
        tracing::info!(
            has_output_path = request.output_path.is_some(),
            "exporting library settings file"
        );
        let _operation = self.operations.lock().await;
        let data_dir = self.rimr_data_dir()?;
        let settings = current::load_library(&data_dir)?.settings;
        let serializer = RimrFileSerializer::new(&AppClock);
        let exported = serializer.export_library_settings(&settings)?;
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
    ) -> AppResult<LibrarySettingsDto> {
        let _operation = self.operations.lock().await;
        tracing::info!(
            has_input_path = request.input_path.is_some(),
            has_json = request.json.is_some(),
            "importing library settings file"
        );
        let bytes = read_import_input(request.input_path, request.json).await?;
        let serializer = RimrFileSerializer::new(&AppClock);
        let file = serializer.import_library_settings(&bytes)?;
        let data_dir = self.rimr_data_dir()?;
        let mut candidate = current::load_library(&data_dir)?;
        let mut merged = core_merge_library_settings(candidate.settings.clone(), file.settings);
        merged.revision =
            candidate.settings.revision.checked_add(1).ok_or_else(|| {
                AppError::new(AppErrorCode::Internal, "settings revision exhausted")
            })?;
        candidate.settings = merged.clone();
        current::save_library(&data_dir, &candidate)?;
        tracing::info!(aliases = merged.aliases.len(), "library settings imported");
        Ok(dto::library_settings_from_core(&merged))
    }

    async fn write_active_list_to_game(
        &self,
        list: ActiveModList,
    ) -> AppResult<ActiveListWriteDto> {
        tracing::info!(
            active_mods = list.as_slice().len(),
            "writing active list to game"
        );
        let roots = self.source_roots()?;
        let source = FsModSource::new(roots);
        let config = crate::services::write_active_list(&source, &list).await?;
        tracing::info!("mods config written");

        let dto = ActiveListWriteDto {
            active_mods: dto::packages(list.as_slice()),
            config: dto::mods_config(&config),
        };
        let mut state = self.write_state()?;
        state.workspace.replace_game_config(config);
        Ok(dto)
    }
}

#[derive(Debug, Clone)]
struct ApplyProjection {
    active_mods: Vec<String>,
    skipped_missing_packages: Vec<String>,
}

fn apply_projection(active_mods: &[String], catalog: &ModCatalog) -> ApplyProjection {
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
) -> AppResult<Vec<u8>> {
    if let Some(json) = json {
        return Ok(json.into_bytes());
    }
    if let Some(path) = input_path {
        return tokio::fs::read(&path).await.map_err(|error| {
            AppError::new(AppErrorCode::Json, "operation failed")
                .with_source(error)
                .with_path(path)
        });
    }
    Err(AppError::new(
        AppErrorCode::Json,
        "inputPath or json is required",
    ))
}

async fn write_text(path: &Path, text: &str) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|error| {
            AppError::new(AppErrorCode::BackupInvalid, "operation failed")
                .with_source(error)
                .with_path(parent.to_path_buf())
        })?;
    }
    tokio::fs::write(path, text).await.map_err(|error| {
        AppError::new(AppErrorCode::BackupInvalid, "operation failed")
            .with_source(error)
            .with_path(path.to_path_buf())
    })
}

#[cfg(test)]
mod tests;
