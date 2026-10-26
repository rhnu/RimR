//! Startup coordinates legacy decoding and current-format commits.

use std::path::{Path, PathBuf};

use crate::{
    app_config::{AppConfig, UiConfig, default_data_dir},
    current,
    error::{AppError, AppErrorCode, AppResult},
    legacy,
};

pub struct BootstrapReady {
    pub config: AppConfig,
    pub imported_preferences: Option<UiConfig>,
    pub migrated: bool,
    pub config_path: PathBuf,
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn run(legacy_config_path: &Path) -> AppResult<BootstrapReady> {
    let config_path = current::config_path(legacy_config_path)?;
    let preferences_path = config_path.with_file_name("imported-preferences.json");
    if exists(&config_path)? {
        let config = current::load_config(&config_path)?;
        let data_dir = data_dir(&config)?;
        current::load_library(&data_dir)?;
        let imported_preferences = if exists(&preferences_path)? {
            Some(current::read_json(&preferences_path)?)
        } else {
            None
        };
        return Ok(BootstrapReady {
            config,
            imported_preferences,
            migrated: false,
            config_path,
        });
    }
    let has_legacy = exists(legacy_config_path)?;
    let (mut config, preferences) = if has_legacy {
        let (config, preferences) = legacy::config(legacy_config_path)?;
        (config, Some(preferences))
    } else {
        (AppConfig::default(), None)
    };
    if config.paths.rimr_data_dir.is_none() {
        config.paths.rimr_data_dir = default_data_dir();
    }
    let data_dir = data_dir(&config)?;
    // A prior run may have committed the library before the config on another volume.
    prepare_library(&data_dir)?;
    if let Some(preferences) = &preferences {
        current::create_json(&preferences_path, preferences)?;
    }
    let config = current::create_config(&config_path, &config)?;
    current::load_library(&self::data_dir(&config)?)?;
    let imported_preferences = if exists(&preferences_path)? {
        Some(current::read_json(&preferences_path)?)
    } else {
        None
    };
    Ok(BootstrapReady {
        config,
        imported_preferences,
        migrated: has_legacy,
        config_path,
    })
}

/// Used by startup and explicit data-directory changes, never by normal reads.
/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn prepare_library(data_dir: &Path) -> AppResult<current::LibrarySnapshot> {
    if exists(&current::library_path(data_dir))? {
        current::load_library(data_dir)
    } else {
        let candidate = legacy::library(data_dir)?;
        current::create_library(data_dir, &candidate)
    }
}

/// # Errors
/// Returns a source, parsing, validation, or state error if the operation cannot complete.
pub fn data_dir(config: &AppConfig) -> AppResult<PathBuf> {
    config.validate()?;
    config
        .paths
        .rimr_data_dir
        .clone()
        .or_else(default_data_dir)
        .ok_or_else(|| {
            AppError::new(
                AppErrorCode::PathNotConfigured,
                "RimR data directory is unavailable",
            )
        })
}

fn exists(path: &Path) -> AppResult<bool> {
    path.try_exists()
        .map_err(|source| AppError::io(AppErrorCode::ConfigReadFailed, path, source))
}

#[cfg(test)]
mod tests;
