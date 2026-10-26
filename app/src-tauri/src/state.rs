use std::{collections::HashMap, path::PathBuf, sync::RwLock};

use rimr_core::WorkspaceSession;

use crate::{
    app_config::{
        AppConfig, ConfigFileError, default_config_path, default_data_dir, load_config_from_file,
        save_config_to_file,
    },
    error::{CommandError, CommandErrorCode, CommandResult},
    mod_file_info::{CachedModFolderSize, CachedModPreview},
    paths,
    source::SourceRoots,
};

mod library;
mod logs;
mod mods;

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
struct CanonicalSourceRoots {
    roots: Vec<PathBuf>,
}

impl AppState {
    pub fn from_default_config_path() -> Self {
        let config_path =
            default_config_path().unwrap_or_else(|| PathBuf::from("rimr-config.json"));
        Self::new(config_path).unwrap_or_else(|_| Self::empty(PathBuf::from("rimr-config.json")))
    }

    /// Creates an application session from saved configuration.
    ///
    /// # Errors
    /// Returns an error if the configuration cannot be read, parsed, or migrated.
    pub fn new(config_path: PathBuf) -> Result<Self, ConfigFileError> {
        let config = load_config_from_file(&config_path)?;
        Ok(Self::with_config(config_path, config))
    }

    pub fn empty(config_path: PathBuf) -> Self {
        Self::with_config(config_path, AppConfig::default())
    }

    /// Saves configuration and invalidates caches when source paths change.
    ///
    /// # Errors
    /// Returns an error if saving fails or the session lock is poisoned.
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

    /// Returns the current configuration.
    ///
    /// # Errors
    /// Returns an error if the session lock is poisoned.
    pub fn get_config(&self) -> CommandResult<AppConfig> {
        tracing::debug!("reading app config");
        Ok(self.read_state()?.config.clone())
    }

    /// Drops the catalog, active list, and mod file caches.
    ///
    /// # Errors
    /// Returns an error if the session lock is poisoned.
    pub fn clear_session_cache(&self) -> CommandResult<()> {
        tracing::info!("clearing session cache");
        let mut state = self.write_state()?;
        state.workspace.clear();
        state.canonical_source_roots = None;
        state.mod_previews.clear();
        state.mod_folder_sizes.clear();
        Ok(())
    }

    /// Detects game paths and saves them in the current configuration.
    ///
    /// # Errors
    /// Returns an error if detection, saving, or session access fails.
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

    fn read_state(&self) -> CommandResult<std::sync::RwLockReadGuard<'_, SessionState>> {
        self.inner.read().map_err(|_poisoned| {
            CommandError::new(
                CommandErrorCode::Internal,
                "application state lock is poisoned",
            )
        })
    }

    fn write_state(&self) -> CommandResult<std::sync::RwLockWriteGuard<'_, SessionState>> {
        self.inner.write().map_err(|_poisoned| {
            CommandError::new(
                CommandErrorCode::Internal,
                "application state lock is poisoned",
            )
        })
    }
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
        },
        ConfigFileError::Parse { path, source } => {
            CommandError::new(CommandErrorCode::ConfigReadFailed, source.to_string())
                .with_path(path)
        },
        ConfigFileError::Write { path, source } => {
            CommandError::new(CommandErrorCode::ConfigWriteFailed, source.to_string())
                .with_path(path)
        },
        ConfigFileError::Serialize(error) => {
            CommandError::new(CommandErrorCode::ConfigWriteFailed, error.to_string())
        },
        ConfigFileError::Migrate { path, source } => {
            CommandError::new(CommandErrorCode::ConfigReadFailed, source.to_string())
                .with_path(path)
        },
    }
}
