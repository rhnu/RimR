//! Application configuration and platform defaults.
use std::path::PathBuf;

pub use rimr_bindings::app_config::UiConfig;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PathsConfig {
    #[serde(default)]
    pub game_dir: Option<PathBuf>,
    #[serde(default)]
    pub game_data_dir: Option<PathBuf>,
    #[serde(default)]
    pub local_mods_dir: Option<PathBuf>,
    #[serde(default)]
    pub workshop_mods_dir: Option<PathBuf>,
    #[serde(default)]
    pub rimr_data_dir: Option<PathBuf>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AppConfig {
    pub paths: PathsConfig,
}

impl AppConfig {
    pub fn paths_changed(&self, other: &Self) -> bool { self.paths != other.paths }

    /// # Errors
    /// Returns an invalid-path error for an explicitly configured empty path.
    pub fn validate(&self) -> crate::AppResult<()> {
        for (name, path) in [
            ("gameDir", &self.paths.game_dir),
            ("gameDataDir", &self.paths.game_data_dir),
            ("localModsDir", &self.paths.local_mods_dir),
            ("workshopModsDir", &self.paths.workshop_mods_dir),
            ("rimrDataDir", &self.paths.rimr_data_dir),
        ] {
            if path
                .as_ref()
                .is_some_and(|path| path.as_os_str().is_empty())
            {
                return Err(crate::AppError::new(
                    crate::AppErrorCode::PathInvalid,
                    format!("{name} cannot be an empty path"),
                ));
            }
        }
        Ok(())
    }
}

impl From<rimr_bindings::app_config::AppConfig> for AppConfig {
    fn from(config: rimr_bindings::app_config::AppConfig) -> Self {
        Self {
            paths: PathsConfig {
                game_dir: config.paths.game_dir,
                game_data_dir: config.paths.game_data_dir,
                local_mods_dir: config.paths.local_mods_dir,
                workshop_mods_dir: config.paths.workshop_mods_dir,
                rimr_data_dir: config.paths.rimr_data_dir,
            },
        }
    }
}

impl From<AppConfig> for rimr_bindings::app_config::AppConfig {
    fn from(config: AppConfig) -> Self {
        Self {
            paths: rimr_bindings::app_config::PathsConfig {
                game_dir: config.paths.game_dir,
                game_data_dir: config.paths.game_data_dir,
                local_mods_dir: config.paths.local_mods_dir,
                workshop_mods_dir: config.paths.workshop_mods_dir,
                rimr_data_dir: config.paths.rimr_data_dir,
            },
        }
    }
}

pub fn default_config_path() -> Option<PathBuf> {
    directories::ProjectDirs::from("dev", "rimr", "RimR")
        .map(|dirs| dirs.config_dir().join("config.json"))
}

pub fn default_data_dir() -> Option<PathBuf> {
    directories::UserDirs::new()
        .and_then(|dirs| dirs.document_dir().map(|path| path.join("RimR")))
        .or_else(|| directories::UserDirs::new().map(|dirs| dirs.home_dir().join("RimR")))
}
