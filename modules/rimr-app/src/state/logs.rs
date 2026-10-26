use std::{collections::HashMap, path::PathBuf};

use rimr_core::SourceKind;
use rimr_steam::{appworkshop_acf_path, parse_appworkshop_acf, workshop_file_id_from_mod_path};

use super::AppState;
use crate::{
    dto::{
        LoadPlayerLogRequest, LogEntryDto, LogLevelDto, LogSourceDto, PlayerLogDto,
        SteamWorkshopLogDto, SteamWorkshopLogEntryDto,
    },
    error::{AppError, AppErrorCode, AppResult},
};

impl AppState {
    /// Loads Workshop installation metadata and adds names from the catalog.
    ///
    /// # Errors
    /// Returns an error if session access fails or an existing manifest cannot be read or parsed.
    pub async fn load_steam_workshop_log(&self) -> AppResult<SteamWorkshopLogDto> {
        tracing::info!("loading Steam workshop log");

        let Some(acf_path) = self.workshop_manifest_path()? else {
            tracing::info!("no Steam library with RimWorld found");
            return Ok(SteamWorkshopLogDto {
                entries: Vec::new(),
                acf_path: String::new(),
                total_installed: 0,
                found: false,
            });
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
            },
            Err(e) => {
                return Err(
                    AppError::new(AppErrorCode::SourceIo, "failed to read ACF file")
                        .with_source(e)
                        .with_path(acf_path),
                );
            },
        };

        let entries = parse_appworkshop_acf(&content).map_err(|e| {
            AppError::new(AppErrorCode::Internal, "failed to parse ACF").with_source(e)
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

        let total_installed = u32::try_from(entries.len()).unwrap_or(u32::MAX);
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

    fn workshop_manifest_path(&self) -> AppResult<Option<PathBuf>> {
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

        Ok(acf_path)
    }

    /// Loads and parses the requested player log.
    ///
    /// # Errors
    /// Returns an error if the data directory is missing, the log cannot be read, or its background task fails.
    pub async fn load_player_log(&self, request: LoadPlayerLogRequest) -> AppResult<PlayerLogDto> {
        use crate::player_log::{self, LogSource};

        let source = match request.source {
            LogSourceDto::PlayerLog => LogSource::PlayerLog,
            LogSourceDto::PlayerPrevLog => LogSource::PlayerPrevLog,
        };

        tracing::info!(source = source.file_name(), "loading player log");

        let game_data_dir = self.get_config()?.paths.game_data_dir.ok_or_else(|| {
            AppError::new(
                AppErrorCode::PathNotConfigured,
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
        .map_err(|e| AppError::new(AppErrorCode::Internal, "operation failed").with_source(e))?
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                AppError::new(
                    AppErrorCode::PathInvalid,
                    format!("{} not found", source.file_name()),
                )
                .with_path(log_path.clone())
            } else {
                AppError::new(AppErrorCode::SourceIo, "operation failed")
                    .with_source(e)
                    .with_path(log_path.clone())
            }
        })?;

        let file_size_bytes = metadata.len();
        let modified_at_ms = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(u64::MAX));

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
}
