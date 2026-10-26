pub use rimr_bindings::app_config::*;

use rimr_core::migrations::{DocumentKind, migrate_document};
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigFileError {
    #[error("failed to read config {path}: {source}")]
    Read {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("failed to parse config {path}: {source}")]
    Parse {
        path: PathBuf,
        source: serde_json::Error,
    },
    #[error("failed to write config {path}: {source}")]
    Write {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("failed to serialize config: {0}")]
    Serialize(serde_json::Error),

    #[error("failed to migrate config {path}: {source}")]
    Migrate {
        path: PathBuf,
        source: rimr_core::migrations::MigrationError,
    },
}

pub fn load_config_from_file(path: &Path) -> Result<AppConfig, ConfigFileError> {
    tracing::debug!(path = ?path, "loading app config");
    if !path.exists() {
        tracing::debug!(path = ?path, "app config not found, using defaults");
        return Ok(AppConfig::default());
    }
    let bytes = std::fs::read(path).map_err(|source| ConfigFileError::Read {
        path: path.to_path_buf(),
        source,
    })?;

    let mut value: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|source| ConfigFileError::Parse {
            path: path.to_path_buf(),
            source,
        })?;

    migrate_document(DocumentKind::AppConfig, &mut value).map_err(|source| {
        ConfigFileError::Migrate {
            path: path.to_path_buf(),
            source,
        }
    })?;

    serde_json::from_value(value).map_err(|source| ConfigFileError::Parse {
        path: path.to_path_buf(),
        source,
    })
}

pub fn save_config_to_file(path: &Path, config: &AppConfig) -> Result<(), ConfigFileError> {
    tracing::debug!(path = ?path, "saving app config");
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|source| ConfigFileError::Write {
            path: parent.to_path_buf(),
            source,
        })?;
    }
    let bytes = serde_json::to_vec_pretty(config).map_err(ConfigFileError::Serialize)?;
    std::fs::write(path, bytes).map_err(|source| ConfigFileError::Write {
        path: path.to_path_buf(),
        source,
    })
}

pub fn default_config_path() -> Option<PathBuf> {
    directories::ProjectDirs::from("dev", "rimr", "RimR")
        .map(|dirs| dirs.config_dir().join("config.json"))
}
