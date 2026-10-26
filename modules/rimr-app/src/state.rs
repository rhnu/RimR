//! Shared session state and the coordination boundary for configuration and writes.
use std::{collections::HashMap, path::PathBuf, sync::RwLock};

use crate::{
    WorkspaceSession,
    app_config::{AppConfig, UiConfig, default_config_path},
    bootstrap, current,
    error::{AppError, AppErrorCode, AppResult},
    mod_file_info::{CachedModFolderSize, CachedModPreview},
    paths,
    source::SourceRoots,
};

mod library;
mod logs;
mod mods;

#[derive(Debug)]
pub struct AppState {
    config_path: Option<PathBuf>,
    bootstrap_error: Option<AppError>,
    imported_preferences: Option<UiConfig>,
    migrated: bool,
    operations: tokio::sync::Mutex<()>,
    inner: RwLock<SessionState>,
}

#[derive(Debug, Clone)]
struct SessionState {
    config: AppConfig,
    generation: u64,
    workspace: WorkspaceSession,
    canonical_source_roots: Option<CanonicalSourceRoots>,
    mod_previews: HashMap<String, CachedModPreview>,
    mod_folder_sizes: HashMap<String, CachedModFolderSize>,
}

#[derive(Debug, Clone)]
struct CanonicalSourceRoots {
    roots: Vec<PathBuf>,
}

pub enum BootstrapStatus {
    Ready {
        config: AppConfig,
        imported_preferences: Option<UiConfig>,
        migrated: bool,
    },
    RecoveryRequired {
        error: AppError,
    },
}

impl AppState {
    pub fn from_default_config_path() -> Self {
        match default_config_path() {
            Some(path) => match Self::new(&path) {
                Ok(state) => state,
                Err(error) => Self::failed(error),
            },
            None => Self::failed(AppError::new(
                AppErrorCode::RecoveryRequired,
                "configuration directory is unavailable",
            )),
        }
    }

    /// # Errors
    /// Returns a source, parsing, validation, or state error if the operation cannot complete.
    pub fn new(legacy_path: &std::path::Path) -> AppResult<Self> {
        let ready = bootstrap::run(legacy_path)?;
        Ok(Self::with_config(
            Some(ready.config_path),
            ready.config,
            None,
            ready.imported_preferences,
            ready.migrated,
        ))
    }

    pub fn bootstrap_status(&self) -> BootstrapStatus {
        match self.get_config() {
            Ok(config) => BootstrapStatus::Ready {
                config,
                imported_preferences: self.imported_preferences.clone(),
                migrated: self.migrated,
            },
            Err(error) => BootstrapStatus::RecoveryRequired { error },
        }
    }

    /// # Errors
    /// Returns a source, parsing, validation, or state error if the operation cannot complete.
    pub fn replace_config(&self, config: AppConfig) -> AppResult<AppConfig> {
        let _operation = self
            .operations
            .try_lock()
            .map_err(|source| conflict().with_source(source))?;
        let mut state = self.write_state()?;
        let data_dir = bootstrap::data_dir(&config)?;
        bootstrap::prepare_library(&data_dir)?;
        let path = self.config_path.as_ref().ok_or_else(|| {
            AppError::new(
                AppErrorCode::RecoveryRequired,
                "configuration is not initialized",
            )
        })?;
        current::save_config(path, &config)?;
        let paths_changed = state.config.paths_changed(&config);
        state.config = config.clone();
        if paths_changed {
            invalidate(&mut state);
        }
        Ok(config)
    }

    /// # Errors
    /// Returns a source, parsing, validation, or state error if the operation cannot complete.
    pub fn get_config(&self) -> AppResult<AppConfig> { Ok(self.read_state()?.config.clone()) }

    /// # Errors
    /// Returns a source, parsing, validation, or state error if the operation cannot complete.
    pub fn clear_session_cache(&self) -> AppResult<()> {
        let _operation = self
            .operations
            .try_lock()
            .map_err(|source| conflict().with_source(source))?;
        let mut state = self.write_state()?;
        invalidate(&mut state);
        Ok(())
    }

    /// # Errors
    /// Returns a source, parsing, validation, or state error if the operation cannot complete.
    pub fn apply_detected_paths(&self) -> AppResult<paths::DetectedPaths> {
        let detected = paths::autodetect_paths().map_err(|source| {
            AppError::new(AppErrorCode::PathAutodetectFailed, "path detection failed")
                .with_source(source)
        })?;
        let mut config = self.get_config()?;
        config.paths.game_dir = Some(detected.game_dir.clone());
        config.paths.game_data_dir = Some(detected.game_data_dir.clone());
        config.paths.local_mods_dir = Some(detected.local_mods_dir.clone());
        config.paths.workshop_mods_dir = Some(detected.workshop_mods_dir.clone());
        self.replace_config(config)?;
        Ok(detected)
    }

    fn failed(error: AppError) -> Self {
        Self::with_config(None, AppConfig::default(), Some(error), None, false)
    }

    fn with_config(
        config_path: Option<PathBuf>,
        config: AppConfig,
        bootstrap_error: Option<AppError>,
        imported_preferences: Option<UiConfig>,
        migrated: bool,
    ) -> Self {
        Self {
            config_path,
            bootstrap_error,
            imported_preferences,
            migrated,
            operations: tokio::sync::Mutex::new(()),
            inner: RwLock::new(SessionState {
                config,
                generation: 0,
                workspace: WorkspaceSession::default(),
                canonical_source_roots: None,
                mod_previews: HashMap::new(),
                mod_folder_sizes: HashMap::new(),
            }),
        }
    }

    fn source_roots(&self) -> AppResult<SourceRoots> {
        let config = self.get_config()?;
        Ok(SourceRoots {
            game_dir: required_path(config.paths.game_dir, "gameDir")?,
            data_dir: required_path(config.paths.game_data_dir, "gameDataDir")?,
            local_mods_dir: config.paths.local_mods_dir,
            workshop_mods_dir: config.paths.workshop_mods_dir,
        })
    }

    fn rimr_data_dir(&self) -> AppResult<PathBuf> { bootstrap::data_dir(&self.get_config()?) }

    fn read_state(&self) -> AppResult<std::sync::RwLockReadGuard<'_, SessionState>> {
        if let Some(error) = &self.bootstrap_error {
            return Err(error.clone());
        }
        self.inner.read().map_err(|_poisoned| {
            AppError::new(AppErrorCode::Internal, "application state lock is poisoned")
        })
    }

    fn write_state(&self) -> AppResult<std::sync::RwLockWriteGuard<'_, SessionState>> {
        if let Some(error) = &self.bootstrap_error {
            return Err(error.clone());
        }
        self.inner.write().map_err(|_poisoned| {
            AppError::new(AppErrorCode::Internal, "application state lock is poisoned")
        })
    }
}

fn invalidate(state: &mut SessionState) {
    state.generation += 1;
    state.workspace.clear();
    state.canonical_source_roots = None;
    state.mod_previews.clear();
    state.mod_folder_sizes.clear();
}

fn conflict() -> AppError {
    AppError::new(
        AppErrorCode::Conflict,
        "another operation is using the current paths; retry after it completes",
    )
}

fn required_path(path: Option<PathBuf>, field: &str) -> AppResult<PathBuf> {
    path.ok_or_else(|| {
        AppError::new(
            AppErrorCode::PathNotConfigured,
            format!("{field} is not configured"),
        )
    })
}
